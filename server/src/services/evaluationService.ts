import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import { getAiEvaluationEngine } from './ai/index.js';
import {
  EvaluationContext,
  EvaluationQuestionContext,
} from './ai/evaluationEngine.interface.js';
import {
  RecruiterOverrideInput,
  recruiterOverrideSchema,
} from '../validations/evaluationValidations.js';
import { ProctoringService } from './proctoringService.js';
import { NotificationService } from './notificationService.js';

export class EvaluationService {
  public static readonly DECISION_SUPPORT_DISCLAIMER =
    'This evaluation is an AI-assisted decision-support summary designed to assist human recruiters and hiring managers. It does not constitute an automated or irreversible hiring decision.';

  /**
   * Retrieve cached interview evaluation or compute it if not yet generated.
   */
  static async getOrGenerateEvaluation(
    interviewId: string,
    requesterId: string,
    forceRefresh: boolean = false
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        job: true,
        candidate: {
          include: {
            candidateProfile: {
              include: {
                skills: true,
              },
            },
            resumes: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        responses: true,
        evaluation: true,
        proctoringEvents: true,
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    // Return cached evaluation if it exists and forceRefresh is false
    if (interview.evaluation && !forceRefresh) {
      return interview.evaluation;
    }

    // Build Candidate Context
    const candidateSkills: string[] = [];
    if (interview.candidate.candidateProfile?.skills) {
      candidateSkills.push(
        ...interview.candidate.candidateProfile.skills.map((s) => s.name)
      );
    }
    const parsedResumeSkills = (interview.candidate.resumes[0]?.parsedData as any)?.skills;
    if (Array.isArray(parsedResumeSkills)) {
      candidateSkills.push(...parsedResumeSkills);
    }

    const uniqueCandidateSkills = Array.from(new Set(candidateSkills));

    // Map Questions and Responses
    const responseByQuestionId = new Map(
      interview.responses.map((r) => [r.questionId, r])
    );

    const mappedQuestions: EvaluationQuestionContext[] = interview.questions.map((q) => {
      const resp = responseByQuestionId.get(q.id);
      return {
        id: q.id,
        question: q.description || q.title,
        category: q.category,
        difficulty: q.difficulty,
        expectedTopics: q.expectedTopics || [],
        evaluationCriteria: q.evaluationCriteria || [],
        response: resp
          ? {
              answerText: resp.answerText,
              codeAnswer: resp.codeAnswer,
              codeLanguage: resp.codeLanguage,
              executionResults: resp.executionResults,
              speakingDurationSeconds: resp.speakingDurationSeconds,
              speakingWpm: (resp.communicationMetrics as any)?.speakingWpm,
              fillerWordCount: resp.fillerWordCount,
              answerRelevanceScore: resp.answerRelevanceScore,
              responseCompletenessScore: resp.responseCompletenessScore,
              isSubmitted: resp.isSubmitted,
            }
          : undefined,
      };
    });

    // Proctoring context
    let proctoringContext = undefined;
    try {
      const timeline = await ProctoringService.getInterviewTimeline(
        interviewId,
        requesterId
      );
      proctoringContext = {
        totalEvents: timeline.totalEvents,
        cleanTimePercentage: timeline.cleanTimePercentage,
        integrityRating: timeline.integrityRating,
        counts: timeline.eventCounts,
      };
    } catch {
      // Non-blocking if proctoring not recorded
    }

    const evalContext: EvaluationContext = {
      interviewTitle: interview.title,
      interviewType: interview.type,
      interviewDifficulty: interview.difficulty,
      durationMinutes: interview.durationMins,
      candidate: {
        id: interview.candidate.id,
        name: interview.candidate.name,
        email: interview.candidate.email,
        skills: uniqueCandidateSkills,
      },
      job: {
        id: interview.job.id,
        title: interview.job.title,
        description: interview.job.description,
        requiredSkills: interview.job.requiredSkills || [],
        preferredSkills: interview.job.preferredSkills || [],
        experienceLevel: interview.job.experienceLevel || 'Mid-Level',
      },
      questions: mappedQuestions,
      proctoring: proctoringContext,
    };

    // Generate evaluation from AI Engine
    const aiEngine = getAiEvaluationEngine();
    const evaluationOutput = await aiEngine.evaluateInterview(evalContext);

    // Persist permanently in PostgreSQL
    const savedEvaluation = await prisma.interviewEvaluation.upsert({
      where: { interviewId },
      create: {
        interviewId,
        evaluatorId: requesterId,
        overallScore: evaluationOutput.overallScore,
        technicalScore: evaluationOutput.technicalScore,
        problemSolvingScore: evaluationOutput.problemSolvingScore,
        codingScore: evaluationOutput.codingScore,
        codeQualityScore: evaluationOutput.codingScore,
        communicationScore: evaluationOutput.communicationScore,
        answerRelevanceScore: evaluationOutput.answerRelevanceScore,
        skillAlignmentScore: evaluationOutput.skillAlignmentScore,
        recommendation: evaluationOutput.recommendation,
        summary: evaluationOutput.summary,
        strengths: evaluationOutput.strengths,
        weaknesses: evaluationOutput.weaknesses,
        missingSkills: evaluationOutput.missingSkills,
        technicalSummary: evaluationOutput.technicalSummary,
        communicationSummary: evaluationOutput.communicationSummary,
        improvementAreas: evaluationOutput.improvementAreas,
        growthAreas: evaluationOutput.improvementAreas,
        decisionSupportDisclaimer: this.DECISION_SUPPORT_DISCLAIMER,
      },
      update: {
        evaluatorId: requesterId,
        overallScore: evaluationOutput.overallScore,
        technicalScore: evaluationOutput.technicalScore,
        problemSolvingScore: evaluationOutput.problemSolvingScore,
        codingScore: evaluationOutput.codingScore,
        codeQualityScore: evaluationOutput.codingScore,
        communicationScore: evaluationOutput.communicationScore,
        answerRelevanceScore: evaluationOutput.answerRelevanceScore,
        skillAlignmentScore: evaluationOutput.skillAlignmentScore,
        recommendation: evaluationOutput.recommendation,
        summary: evaluationOutput.summary,
        strengths: evaluationOutput.strengths,
        weaknesses: evaluationOutput.weaknesses,
        missingSkills: evaluationOutput.missingSkills,
        technicalSummary: evaluationOutput.technicalSummary,
        communicationSummary: evaluationOutput.communicationSummary,
        improvementAreas: evaluationOutput.improvementAreas,
        growthAreas: evaluationOutput.improvementAreas,
        decisionSupportDisclaimer: this.DECISION_SUPPORT_DISCLAIMER,
      },
    });

    // Dispatch Recruiter & Candidate Notifications
    const recruiterUser = interview.recruiterId
      ? await prisma.user.findUnique({
          where: { id: interview.recruiterId },
          select: { id: true, name: true, email: true },
        })
      : null;

    if (recruiterUser) {
      NotificationService.notifyReportReady(
        recruiterUser,
        { name: interview.candidate.name },
        { id: interview.job.id, title: interview.job.title },
        { id: interviewId },
        Math.round(savedEvaluation.overallScore),
        savedEvaluation.recommendation
      ).catch((e) => console.warn('[Notification Error]', e));
    }

    NotificationService.notifyResultsAvailable(
      { id: interview.candidate.id, name: interview.candidate.name, email: interview.candidate.email },
      { id: interview.job.id, title: interview.job.title },
      { id: interviewId },
      Math.round(savedEvaluation.overallScore)
    ).catch((e) => console.warn('[Notification Error]', e));

    return savedEvaluation;
  }

  /**
   * Recruiter manual override of evaluation recommendation and personal hiring notes.
   */
  static async overrideEvaluation(
    interviewId: string,
    recruiterId: string,
    input: RecruiterOverrideInput
  ) {
    const parsed = recruiterOverrideSchema.parse(input);

    const existing = await prisma.interviewEvaluation.findUnique({
      where: { interviewId },
    });

    if (!existing) {
      // If no evaluation generated yet, generate first before overriding
      await this.getOrGenerateEvaluation(interviewId, recruiterId);
    }

    const updated = await prisma.interviewEvaluation.update({
      where: { interviewId },
      data: {
        recruiterRecommendation: parsed.recommendation,
        recruiterNotes: parsed.recruiterNotes?.trim() || null,
        isOverridden: true,
        overriddenAt: new Date(),
        overriddenById: recruiterId,
      },
      include: {
        interview: {
          include: {
            candidate: true,
            job: true,
          },
        },
      },
    });

    return updated;
  }
}
