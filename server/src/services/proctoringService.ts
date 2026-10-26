import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import {
  ProctoringEventType,
} from '../validations/proctoringValidations.js';

export interface ProctoringTimelineSummary {
  interviewId: string;
  totalEvents: number;
  integrityScore: number; // 0 - 100
  integrityRating: 'HIGH' | 'MODERATE' | 'REVIEW_RECOMMENDED';
  cleanTimePercentage: number;
  eventCounts: Record<ProctoringEventType, number>;
  totalAwayTimeSeconds: number;
  totalTabHiddenTimeSeconds: number;
  disclaimer: string;
  events: Array<{
    id: string;
    eventType: string;
    timestamp: Date;
    durationMs: number | null;
    metadata: any;
  }>;
}

export class ProctoringService {
  private static readonly DISCLAIMER =
    'Integrity signals provide timeline context (such as tab switching, temporary absence, or multi-face presence) for human review. They do NOT prove cheating or establish malicious intent.';

  /**
   * Ingest single or batch proctoring events from the candidate browser
   */
  static async recordEvents(
    candidateId: string,
    interviewId: string,
    events: Array<{
      eventType: ProctoringEventType;
      timestamp?: string;
      durationMs?: number;
      metadata?: any;
    }>
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { session: true },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.candidateId !== candidateId) {
      throw ApiError.forbidden('You are not authorized to submit integrity signals for this interview');
    }

    const createdEvents = await prisma.$transaction(
      events.map((e) =>
        prisma.proctoringEvent.create({
          data: {
            interviewId,
            eventType: e.eventType,
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
            durationMs: e.durationMs || null,
            metadata: e.metadata || {},
          },
        })
      )
    );

    // Also update session proctorLogs count if session exists
    if (interview.session) {
      await prisma.interviewSession.update({
        where: { id: interview.session.id },
        data: {
          lastActiveAt: new Date(),
        },
      }).catch((err) => console.warn('[ProctoringService] Session ping deferred:', err));
    }

    return {
      recordedCount: createdEvents.length,
      events: createdEvents,
    };
  }

  /**
   * Retrieve timeline of integrity signals and compute summary statistics for recruiters
   */
  static async getInterviewTimeline(
    interviewId: string,
    _userId: string
  ): Promise<ProctoringTimelineSummary> {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        proctoringEvents: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    const events = interview.proctoringEvents;

    // Initialize counts for all 6 canonical types
    const eventCounts: Record<ProctoringEventType, number> = {
      NO_FACE_DETECTED: 0,
      MULTIPLE_FACES: 0,
      LOOKING_AWAY: 0,
      CAMERA_DISCONNECTED: 0,
      TAB_HIDDEN: 0,
      FULLSCREEN_EXIT: 0,
    };

    let totalAwayTimeMs = 0;
    let totalTabHiddenTimeMs = 0;

    for (const ev of events) {
      const type = ev.eventType as ProctoringEventType;
      if (type in eventCounts) {
        eventCounts[type]++;
      }

      if (type === 'NO_FACE_DETECTED' && ev.durationMs) {
        totalAwayTimeMs += ev.durationMs;
      }
      if (type === 'TAB_HIDDEN' && ev.durationMs) {
        totalTabHiddenTimeMs += ev.durationMs;
      }
    }

    // Calculate integrity score (starts at 100, bounded deductions based on signals)
    // Small penalties: Looking away (-1), Fullscreen exit (-3), Tab switch (-4), Absence/Multiple faces (-6)
    let deductions = 0;
    deductions += eventCounts.LOOKING_AWAY * 1;
    deductions += eventCounts.FULLSCREEN_EXIT * 3;
    deductions += eventCounts.TAB_HIDDEN * 4;
    deductions += eventCounts.NO_FACE_DETECTED * 4;
    deductions += eventCounts.MULTIPLE_FACES * 6;
    deductions += eventCounts.CAMERA_DISCONNECTED * 8;

    const integrityScore = Math.max(25, Math.min(100, Math.round(100 - deductions)));

    let integrityRating: 'HIGH' | 'MODERATE' | 'REVIEW_RECOMMENDED' = 'HIGH';
    if (integrityScore < 70) {
      integrityRating = 'REVIEW_RECOMMENDED';
    } else if (integrityScore < 85) {
      integrityRating = 'MODERATE';
    }

    // Estimate clean time percentage based on total scheduled duration vs total away/hidden time
    const durationSeconds = (interview.durationMins || 60) * 60;
    const totalDistractedSeconds = Math.round((totalAwayTimeMs + totalTabHiddenTimeMs) / 1000);
    const cleanTimePercentage = Math.max(
      0,
      Math.min(100, Math.round(((durationSeconds - totalDistractedSeconds) / durationSeconds) * 100))
    );

    return {
      interviewId,
      totalEvents: events.length,
      integrityScore,
      integrityRating,
      cleanTimePercentage,
      eventCounts,
      totalAwayTimeSeconds: Math.round(totalAwayTimeMs / 1000),
      totalTabHiddenTimeSeconds: Math.round(totalTabHiddenTimeMs / 1000),
      disclaimer: this.DISCLAIMER,
      events: events.map((ev) => ({
        id: ev.id,
        eventType: ev.eventType,
        timestamp: ev.timestamp,
        durationMs: ev.durationMs,
        metadata: ev.metadata,
      })),
    };
  }
}
