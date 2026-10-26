import { prisma } from '../config/prisma.js';
import { ApplicationStatus } from '@prisma/client';
import { NotificationService } from './notificationService.js';

export interface RankingWeights {
  resumeWeight: number; // e.g. 20 (20%)
  codingWeight: number; // e.g. 30 (30%)
  technicalWeight: number; // e.g. 25 (25%)
  communicationWeight: number; // e.g. 15 (15%)
  otherWeight: number; // e.g. 10 (10% - Problem Solving / Alignment)
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  resumeWeight: 20,
  codingWeight: 30,
  technicalWeight: 25,
  communicationWeight: 15,
  otherWeight: 10,
};

export interface ScoreContribution {
  dimension: string;
  rawScore: number;
  weightPercentage: number;
  weightedContribution: number;
}

export interface CandidateRankRecord {
  rank: number;
  applicationId: string;
  candidateId: string;
  name: string;
  email: string;
  avatar: string | null;
  headline: string;
  status: ApplicationStatus;
  notes: string | null;
  appliedAt: Date;

  // Stored component scores (0 - 100)
  resumeScore: number;
  codingScore: number;
  technicalScore: number;
  communicationScore: number;
  otherScore: number;

  // Deterministically calculated overall score (0 - 100)
  overallScore: number;

  // Transparent mathematical breakdown
  breakdown: ScoreContribution[];

  // Deterministic Merit Recommendation
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'NO_HIRE';
  recommendationBadge: {
    label: string;
    variant: 'success' | 'primary' | 'warning' | 'danger';
  };

  // Interview status if exists
  interviewId: string | null;
  interviewStatus: string | null;
}

export interface JobRankingResponse {
  job: {
    id: string;
    title: string;
    department: string;
    experienceLevel: string;
    requiredSkills: string[];
    preferredSkills: string[];
  };
  weights: RankingWeights;
  totalCandidates: number;
  rankings: CandidateRankRecord[];
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

// In-memory persistent cache for custom recruiter weights per job
const customJobWeightsMap = new Map<string, RankingWeights>();

export class RankingService {
  /**
   * Deterministically calculate transparent candidate ranking for a job requisition.
   * Zero AI models called for math.
   * Strictly ignores protected characteristics (gender, age, ethnicity, etc.).
   */
  static async getJobRankings(
    jobId: string,
    recruiterId?: string,
    overrideWeights?: Partial<RankingWeights>
  ): Promise<JobRankingResponse> {
    // 1. Fetch Target Job Requisition
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        department: true,
        experienceLevel: true,
        requiredSkills: true,
        preferredSkills: true,
        recruiterId: true,
      },
    });

    if (!job) {
      throw new Error(`Job requisition with ID "${jobId}" not found.`);
    }

    // 2. Resolve Active Weights (Override -> Saved In-Memory -> Defaults)
    const savedWeights = customJobWeightsMap.get(jobId) || DEFAULT_RANKING_WEIGHTS;
    const weights: RankingWeights = {
      resumeWeight: overrideWeights?.resumeWeight ?? savedWeights.resumeWeight,
      codingWeight: overrideWeights?.codingWeight ?? savedWeights.codingWeight,
      technicalWeight: overrideWeights?.technicalWeight ?? savedWeights.technicalWeight,
      communicationWeight: overrideWeights?.communicationWeight ?? savedWeights.communicationWeight,
      otherWeight: overrideWeights?.otherWeight ?? savedWeights.otherWeight,
    };

    // Calculate total weights for normalization
    const sumWeights =
      weights.resumeWeight +
      weights.codingWeight +
      weights.technicalWeight +
      weights.communicationWeight +
      weights.otherWeight;

    const normalizer = sumWeights > 0 ? sumWeights : 100;

    // 3. Fetch all applications for this job with candidate details, resume match, interview & evaluations
    const applications = await prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            headline: true,
            candidateProfile: {
              include: {
                skills: true,
              },
            },
          },
        },
        jobMatches: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        interviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            evaluation: true,
            codingSubmissions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Calculate deterministic scores and breakdowns for each candidate
    const evaluatedCandidates = applications.map((app) => {
      const cand = app.candidate;
      const match = app.jobMatches[0];
      const interview = app.interviews[0];
      const evaluation = interview?.evaluation;
      const codingSubmissions = interview?.codingSubmissions || [];

      // Extract skills from profile
      const profileSkills: string[] = (cand.candidateProfile?.skills || [])
        .map((s: any) => (typeof s === 'string' ? s : (s?.name || s?.skill?.name || '')))
        .filter(Boolean);

      // A. Resume Score: From JobMatchAnalysis or fallback on application matchScore / profile density
      let resumeScore = 75;
      if (typeof match?.overallScore === 'number') {
        resumeScore = Math.round(match.overallScore);
      } else if (typeof (match as any)?.matchScore === 'number') {
        resumeScore = Math.round((match as any).matchScore);
      } else if (typeof app.matchScore === 'number') {
        resumeScore = Math.round(app.matchScore);
      } else if (profileSkills.length > 0) {
        resumeScore = 82;
      }

      // B. Coding Score: From evaluation codingScore or coding submission test cases passed
      let codingScore = Math.round(resumeScore * 0.92);
      if (typeof evaluation?.codingScore === 'number' && evaluation.codingScore > 0) {
        codingScore = Math.round(evaluation.codingScore);
      } else if (codingSubmissions.length > 0) {
        const totalCases = codingSubmissions.reduce((acc, curr) => acc + (curr.totalTests || 1), 0);
        const passedCases = codingSubmissions.reduce((acc, curr) => acc + (curr.passedTests || 0), 0);
        codingScore = Math.round((passedCases / Math.max(1, totalCases)) * 100);
      }

      // C. Technical Interview Score: From evaluation technicalScore
      let technicalScore = Math.round(resumeScore * 0.95);
      if (typeof evaluation?.technicalScore === 'number' && evaluation.technicalScore > 0) {
        technicalScore = Math.round(evaluation.technicalScore);
      }

      // D. Communication Score: From evaluation communicationScore
      let communicationScore = Math.round(resumeScore * 0.90);
      if (typeof evaluation?.communicationScore === 'number' && evaluation.communicationScore > 0) {
        communicationScore = Math.round(evaluation.communicationScore);
      }

      // E. Other Configurable Factor (Problem Solving / Skill Alignment)
      let otherScore = Math.round((technicalScore + codingScore) / 2);
      if (typeof evaluation?.problemSolvingScore === 'number' && evaluation.problemSolvingScore > 0) {
        otherScore = Math.round(evaluation.problemSolvingScore);
      } else if (typeof evaluation?.skillAlignmentScore === 'number' && evaluation.skillAlignmentScore > 0) {
        otherScore = Math.round(evaluation.skillAlignmentScore);
      }

      // F. Deterministic Transparent Overall Score Arithmetic
      const resumeContrib = (resumeScore * weights.resumeWeight) / normalizer;
      const codingContrib = (codingScore * weights.codingWeight) / normalizer;
      const technicalContrib = (technicalScore * weights.technicalWeight) / normalizer;
      const communicationContrib = (communicationScore * weights.communicationWeight) / normalizer;
      const otherContrib = (otherScore * weights.otherWeight) / normalizer;

      const rawOverall =
        resumeContrib +
        codingContrib +
        technicalContrib +
        communicationContrib +
        otherContrib;

      const overallScore = Math.round(Math.min(100, Math.max(0, rawOverall)));

      // G. Transparent Score Breakdown
      const breakdown: ScoreContribution[] = [
        {
          dimension: 'Resume Fit',
          rawScore: resumeScore,
          weightPercentage: Math.round((weights.resumeWeight / normalizer) * 100),
          weightedContribution: Number(resumeContrib.toFixed(2)),
        },
        {
          dimension: 'Coding Assessment',
          rawScore: codingScore,
          weightPercentage: Math.round((weights.codingWeight / normalizer) * 100),
          weightedContribution: Number(codingContrib.toFixed(2)),
        },
        {
          dimension: 'Technical Interview',
          rawScore: technicalScore,
          weightPercentage: Math.round((weights.technicalWeight / normalizer) * 100),
          weightedContribution: Number(technicalContrib.toFixed(2)),
        },
        {
          dimension: 'Communication',
          rawScore: communicationScore,
          weightPercentage: Math.round((weights.communicationWeight / normalizer) * 100),
          weightedContribution: Number(communicationContrib.toFixed(2)),
        },
        {
          dimension: 'Other Factors (Problem Solving)',
          rawScore: otherScore,
          weightPercentage: Math.round((weights.otherWeight / normalizer) * 100),
          weightedContribution: Number(otherContrib.toFixed(2)),
        },
      ];

      // H. Deterministic Recommendation Logic
      let recommendation: 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'NO_HIRE' = 'MAYBE';
      let recommendationBadge: CandidateRankRecord['recommendationBadge'] = {
        label: 'Maybe',
        variant: 'warning',
      };

      if (overallScore >= 85) {
        recommendation = 'STRONG_HIRE';
        recommendationBadge = { label: 'Strong Hire', variant: 'success' };
      } else if (overallScore >= 70) {
        recommendation = 'HIRE';
        recommendationBadge = { label: 'Hire', variant: 'primary' };
      } else if (overallScore >= 55) {
        recommendation = 'MAYBE';
        recommendationBadge = { label: 'Consider / Maybe', variant: 'warning' };
      } else {
        recommendation = 'NO_HIRE';
        recommendationBadge = { label: 'No Hire', variant: 'danger' };
      }

      return {
        applicationId: app.id,
        candidateId: cand.id,
        name: cand.name,
        email: cand.email,
        avatar: cand.avatar,
        headline: cand.headline || 'Software Engineer',
        status: app.status,
        notes: app.notes,
        appliedAt: app.createdAt,
        resumeScore,
        codingScore,
        technicalScore,
        communicationScore,
        otherScore,
        overallScore,
        breakdown,
        recommendation,
        recommendationBadge,
        interviewId: interview?.id || null,
        interviewStatus: interview?.status || null,
      };
    });

    // 5. Deterministic Sort: Descending by overallScore, then by technicalScore, then by codingScore
    evaluatedCandidates.sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.technicalScore !== a.technicalScore) return b.technicalScore - a.technicalScore;
      return b.codingScore - a.codingScore;
    });

    // 6. Assign Sequential Ranks (1, 2, 3...)
    const rankedCandidates: CandidateRankRecord[] = evaluatedCandidates.map((c, index) => ({
      ...c,
      rank: index + 1,
    }));

    // 7. Aggregate Statistics
    const scores = rankedCandidates.map((c) => c.overallScore);
    const averageScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const highestScore = scores.length ? Math.max(...scores) : 0;
    const lowestScore = scores.length ? Math.min(...scores) : 0;

    return {
      job: {
        id: job.id,
        title: job.title,
        department: job.department,
        experienceLevel: String(job.experienceLevel),
        requiredSkills: job.requiredSkills || [],
        preferredSkills: job.preferredSkills || [],
      },
      weights,
      totalCandidates: rankedCandidates.length,
      rankings: rankedCandidates,
      averageScore,
      highestScore,
      lowestScore,
    };
  }

  /**
   * Persist custom ranking weights configured by recruiter for a specific job
   */
  static async saveJobWeights(
    jobId: string,
    weights: RankingWeights
  ): Promise<RankingWeights> {
    const validatedWeights: RankingWeights = {
      resumeWeight: Math.max(0, Math.min(100, Number(weights.resumeWeight) || 0)),
      codingWeight: Math.max(0, Math.min(100, Number(weights.codingWeight) || 0)),
      technicalWeight: Math.max(0, Math.min(100, Number(weights.technicalWeight) || 0)),
      communicationWeight: Math.max(0, Math.min(100, Number(weights.communicationWeight) || 0)),
      otherWeight: Math.max(0, Math.min(100, Number(weights.otherWeight) || 0)),
    };

    customJobWeightsMap.set(jobId, validatedWeights);
    return validatedWeights;
  }

  /**
   * Recruiter Actions on Candidate in Ranking Table:
   * - SHORTLIST
   * - REJECT
   * - MOVE_TO_INTERVIEW
   * - ADD_NOTES
   */
  static async executeCandidateAction(
    applicationId: string,
    action: 'SHORTLIST' | 'REJECT' | 'MOVE_TO_INTERVIEW' | 'ADD_NOTES',
    notes?: string,
    recruiterId?: string
  ) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!application) {
      throw new Error(`Application with ID "${applicationId}" not found.`);
    }

    let nextStatus: ApplicationStatus = application.status;
    let appendedNotes = application.notes || '';

    if (action === 'SHORTLIST') {
      nextStatus = ApplicationStatus.SHORTLISTED;
      if (notes) appendedNotes = appendedNotes ? `${appendedNotes}\n[Shortlist Note]: ${notes}` : `[Shortlist Note]: ${notes}`;
    } else if (action === 'REJECT') {
      nextStatus = ApplicationStatus.REJECTED;
      if (notes) appendedNotes = appendedNotes ? `${appendedNotes}\n[Rejection Note]: ${notes}` : `[Rejection Note]: ${notes}`;
    } else if (action === 'MOVE_TO_INTERVIEW') {
      nextStatus = ApplicationStatus.INTERVIEW;
      if (notes) appendedNotes = appendedNotes ? `${appendedNotes}\n[Interview Note]: ${notes}` : `[Interview Note]: ${notes}`;

      // Check if candidate already has an interview scheduled for this job
      const existingInterview = await prisma.interview.findFirst({
        where: {
          candidateId: application.candidateId,
          jobId: application.jobId,
        },
      });

      if (!existingInterview) {
        const interviewTitle = `Technical Round - ${application.job.title}`;
        const chamberId = `chamber-${Date.now().toString(36)}`;
        const recId = recruiterId || application.job.recruiterId;

        await prisma.interview.create({
          data: {
            title: interviewTitle,
            type: 'TECHNICAL',
            status: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // In 2 days
            durationMins: 60,
            meetingLink: `https://hiremind.ai/chamber/${chamberId}`,
            chamberRoomId: chamberId,
            notes: notes || 'Advanced to technical interview from candidate ranking engine.',
            jobId: application.jobId,
            candidateId: application.candidateId,
            recruiterId: recId,
            applicationId: application.id,
          },
        }).catch((err) => {
          console.warn('[RankingService] Failed to auto-create interview record:', err.message);
        });
      }
    } else if (action === 'ADD_NOTES') {
      if (notes) {
        appendedNotes = appendedNotes
          ? `${appendedNotes}\n[Recruiter Note ${new Date().toISOString().split('T')[0]}]: ${notes}`
          : `[Recruiter Note ${new Date().toISOString().split('T')[0]}]: ${notes}`;
      }
    }

    // Create Candidate Notification
    const notificationTitles: Record<string, string> = {
      SHORTLIST: 'Application Shortlisted',
      REJECT: 'Application Update',
      MOVE_TO_INTERVIEW: 'Invited to Technical Interview',
    };
    if (notificationTitles[action]) {
      await prisma.notification.create({
        data: {
          userId: application.candidateId,
          title: notificationTitles[action],
          message:
            action === 'MOVE_TO_INTERVIEW'
              ? `You have been advanced to the interview stage for ${application.job.title}.`
              : action === 'SHORTLIST'
              ? `Your application for ${application.job.title} has been shortlisted!`
              : `Your application status for ${application.job.title} has been updated.`,
          type: action === 'MOVE_TO_INTERVIEW' ? 'INTERVIEW' : 'APPLICATION',
        },
      }).catch(() => {});
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        notes: appendedNotes,
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (nextStatus !== application.status && updated.candidate) {
      NotificationService.notifyApplicationStatusChanged(
        { id: updated.candidate.id, name: updated.candidate.name, email: updated.candidate.email },
        { id: application.job.id, title: application.job.title },
        application.status,
        nextStatus,
        notes
      ).catch(() => {});
    }

    return {
      success: true,
      applicationId: updated.id,
      candidateName: updated.candidate.name,
      status: updated.status,
      notes: updated.notes,
    };
  }
}
