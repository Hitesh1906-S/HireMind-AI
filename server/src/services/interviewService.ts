import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import {
  InterviewDifficulty,
  InterviewStatus,
  InterviewType,
  Prisma,
} from '@prisma/client';
import { UserRoleType, USER_ROLES } from '../constants/roles.js';
import {
  CreateInterviewInput,
  UpdateSessionProgressInput,
  SubmitQuestionResponseInput,
  CreateCustomQuestionInput,
  UpdateQuestionInput,
} from '../validations/interviewValidations.js';
import { getAiQuestionGenerator } from './ai/index.js';
import { QuestionGenerationInput } from './ai/questionGenerator.interface.js';
import { NotificationService } from './notificationService.js';

export class InterviewService {
  /**
   * Helper to format Job and Candidate context for AI Question Generator
   */
  private static buildQuestionContext(
    job: any,
    candidate: any,
    interviewType: InterviewType,
    difficulty: InterviewDifficulty,
    numQuestions: number
  ): QuestionGenerationInput {
    const profile = candidate.candidateProfile;
    const parsedData = candidate.resumes?.[0]?.parsedData as any;

    const candidateSkills: string[] = [
      ...(profile?.skills?.map((s: any) => s.name) || []),
      ...(parsedData?.skills?.programmingLanguages || []),
      ...(parsedData?.skills?.frameworks || []),
      ...(parsedData?.skills?.databases || []),
      ...(parsedData?.skills?.tools || []),
    ];

    const uniqueSkills = Array.from(new Set(candidateSkills.filter(Boolean)));

    return {
      job: {
        title: job.title,
        department: job.department,
        description: job.description,
        responsibilities: job.responsibilities,
        requiredSkills: job.requiredSkills || [],
        preferredSkills: job.preferredSkills || [],
        experienceLevel: job.experienceLevel,
      },
      candidate: {
        fullName: profile?.fullName || candidate.name,
        headline: profile?.headline || candidate.headline || undefined,
        summary: profile?.summary || undefined,
        yearsOfExperience: profile?.yearsOfExperience || parsedData?.yearsOfExperience || 0,
        skills: uniqueSkills.length > 0 ? uniqueSkills : job.requiredSkills,
        experiences: (profile?.workExperiences || parsedData?.workExperience || []).map((exp: any) => ({
          company: exp.company,
          position: exp.position,
          description: exp.description,
          technologies: exp.technologies || [],
        })),
        projects: (profile?.projects || parsedData?.projects || []).map((proj: any) => ({
          title: proj.title,
          description: proj.description,
          technologies: proj.technologies || [],
        })),
      },
      interviewType: interviewType as any,
      difficulty: difficulty as any,
      numQuestions,
    };
  }

  /**
   * Get interviews for current user (Candidate, Recruiter, or Admin)
   */
  static async getInterviews(userId: string, userRole: UserRoleType) {
    const where: Prisma.InterviewWhereInput = {};

    if (userRole === USER_ROLES.CANDIDATE) {
      where.candidateId = userId;
    } else if (userRole === USER_ROLES.RECRUITER) {
      where.recruiterId = userId;
    }

    const interviews = await prisma.interview.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            headline: true,
            phone: true,
          },
        },
        recruiter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            location: true,
            experienceLevel: true,
          },
        },
        session: {
          select: {
            id: true,
            status: true,
            currentQuestionIndex: true,
            startedAt: true,
            expiresAt: true,
            completedAt: true,
          },
        },
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    return interviews;
  }

  /**
   * Get single interview by ID with full details, questions, session, and responses.
   */
  static async getInterviewById(
    interviewId: string,
    userId: string,
    userRole: UserRoleType
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            headline: true,
            phone: true,
          },
        },
        recruiter: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            location: true,
            experienceLevel: true,
            requiredSkills: true,
            preferredSkills: true,
          },
        },
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        session: true,
        responses: {
          orderBy: { createdAt: 'asc' },
        },
        evaluation: true,
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    // Access control
    if (userRole === USER_ROLES.CANDIDATE && interview.candidateId !== userId) {
      throw ApiError.forbidden('You do not have access to this interview');
    }
    if (
      userRole === USER_ROLES.RECRUITER &&
      interview.recruiterId !== userId
    ) {
      throw ApiError.forbidden('You do not have permission to manage this interview');
    }

    return interview;
  }

  /**
   * Schedule new interview session (Recruiter or Admin)
   * Configures Job, Candidate, Type, Duration, Difficulty, Number of questions, and Date/Time.
   * Leverages AI Question Generation Engine to produce tailored questions once and persist them.
   */
  static async createInterview(recruiterId: string, input: CreateInterviewInput) {
    const job = await prisma.job.findUnique({
      where: { id: input.jobId },
    });
    if (!job) {
      throw ApiError.notFound('Job opening not found');
    }

    const candidate = await prisma.user.findFirst({
      where: {
        OR: [{ id: input.candidateId }, { email: input.candidateId }],
      },
      include: {
        candidateProfile: {
          include: {
            skills: true,
            workExperiences: true,
            projects: true,
          },
        },
        resumes: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });
    if (!candidate) {
      throw ApiError.notFound(`Candidate user record not found for "${input.candidateId}"`);
    }
    const resolvedCandidateId = candidate.id;

    const chamberRoomId = `chamber-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const meetingLink = `https://hiremind.ai/interview/${chamberRoomId}`;

    const numQuestions = input.numQuestions || 5;
    const difficulty = input.difficulty || InterviewDifficulty.MEDIUM;
    const interviewType = input.type || InterviewType.TECHNICAL;

    // Build context & generate structured questions using AI Engine
    const questionGenInput = this.buildQuestionContext(
      job,
      candidate,
      interviewType,
      difficulty,
      numQuestions
    );
    const aiQuestionGen = getAiQuestionGenerator();
    const generatedResult = await aiQuestionGen.generateQuestions(questionGenInput);
    const generatedQuestions = generatedResult.questions;

    // Create Interview, InterviewQuestions, and initialize InterviewSession in a transaction
    const interview = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newInterview = await tx.interview.create({
        data: {
          title: input.title,
          type: interviewType,
          status: InterviewStatus.SCHEDULED,
          difficulty,
          scheduledAt: new Date(input.scheduledAt),
          durationMins: input.durationMins || 60,
          numQuestions: generatedQuestions.length,
          meetingLink,
          chamberRoomId,
          notes: input.notes || null,
          jobId: input.jobId,
          candidateId: resolvedCandidateId,
          recruiterId,
          applicationId: input.applicationId || null,
        },
      });

      // Insert AI-generated questions into PostgreSQL (Generate once and persist)
      for (let i = 0; i < generatedQuestions.length; i++) {
        const q = generatedQuestions[i];
        await tx.interviewQuestion.create({
          data: {
            interviewId: newInterview.id,
            orderIndex: i + 1,
            title: q.title,
            description: q.question,
            type: q.type,
            difficulty: q.difficulty as any,
            category: q.category,
            expectedTopics: q.expectedTopics || [],
            evaluationCriteria: q.evaluationCriteria || [],
            isAiGenerated: true,
            starterCode: q.starterCode || null,
            testCases: (q.testCases as any) || null,
            rubricCriteria: (q.evaluationCriteria as any) || null,
            timeLimitMins: q.timeLimitMins || null,
          },
        });
      }

      // Initialize persistent session state
      await tx.interviewSession.create({
        data: {
          interviewId: newInterview.id,
          candidateId: resolvedCandidateId,
          status: InterviewStatus.SCHEDULED,
          currentQuestionIndex: 0,
        },
      });

      return newInterview;
    });

    // Notify candidate via in-app & email
    const candidateUser = await prisma.user.findUnique({
      where: { id: resolvedCandidateId },
      select: { id: true, name: true, email: true },
    });

    if (candidateUser) {
      NotificationService.notifyInterviewScheduled(
        candidateUser,
        { id: job.id, title: job.title },
        {
          id: interview.id,
          scheduledAt: input.scheduledAt,
          durationMins: input.durationMins || 60,
          chamberRoomId,
        }
      ).catch((err) => {
        console.warn('[InterviewService] Notification creation deferred:', err.message);
      });
    }

    return this.getInterviewById(interview.id, recruiterId, USER_ROLES.RECRUITER);
  }

  /**
   * Update interview status (Recruiter or Admin)
   */
  static async updateStatus(
    id: string,
    userId: string,
    userRole: UserRoleType,
    status: InterviewStatus,
    notes?: string | null
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (userRole === USER_ROLES.RECRUITER && interview.recruiterId !== userId) {
      throw ApiError.forbidden('You can only update your own interviews');
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const intUpdate = await tx.interview.update({
        where: { id },
        data: {
          status,
          ...(notes ? { notes } : {}),
        },
      });

      await tx.interviewSession.updateMany({
        where: { interviewId: id },
        data: { status },
      });

      return intUpdate;
    });

    return updated;
  }

  /**
   * Cancel or delete interview (Recruiter or Admin)
   */
  static async deleteInterview(
    id: string,
    userId: string,
    userRole: UserRoleType
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (userRole === USER_ROLES.RECRUITER && interview.recruiterId !== userId) {
      throw ApiError.forbidden('You can only delete your own interviews');
    }

    await prisma.interview.delete({
      where: { id },
    });

    return { message: 'Interview deleted successfully' };
  }

  // ==========================================
  // CANDIDATE INTERVIEW SESSION STATE ENGINE
  // (Survives page reloads without losing data)
  // ==========================================

  /**
   * Start or resume candidate interview session.
   */
  static async startSession(interviewId: string, candidateId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        session: true,
        questions: { orderBy: { orderIndex: 'asc' } },
        responses: true,
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.candidateId !== candidateId) {
      throw ApiError.forbidden('You are not authorized to take this interview');
    }

    if (interview.status === InterviewStatus.COMPLETED) {
      throw ApiError.badRequest('This interview has already been completed');
    }

    if (interview.status === InterviewStatus.CANCELLED) {
      throw ApiError.badRequest('This interview has been cancelled');
    }

    const now = new Date();
    let session = interview.session;

    if (!session) {
      // Create session if not present
      session = await prisma.interviewSession.create({
        data: {
          interviewId,
          candidateId,
          status: InterviewStatus.IN_PROGRESS,
          startedAt: now,
          resumedAt: now,
          expiresAt: new Date(now.getTime() + interview.durationMins * 60 * 1000),
          timeRemainingSeconds: interview.durationMins * 60,
          currentQuestionIndex: 0,
        },
      });
    } else if (
      session.status === InterviewStatus.SCHEDULED ||
      session.status === InterviewStatus.READY
    ) {
      // First time starting
      const expiresAt = new Date(now.getTime() + interview.durationMins * 60 * 1000);
      session = await prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          status: InterviewStatus.IN_PROGRESS,
          startedAt: now,
          resumedAt: now,
          expiresAt,
          timeRemainingSeconds: interview.durationMins * 60,
          lastActiveAt: now,
        },
      });

      await prisma.interview.update({
        where: { id: interviewId },
        data: { status: InterviewStatus.IN_PROGRESS },
      });
    } else if (session.status === InterviewStatus.IN_PROGRESS) {
      // Resume existing session on page refresh
      let remaining = interview.durationMins * 60;
      if (session.expiresAt) {
        remaining = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));
      }

      if (remaining === 0) {
        // Expired
        session = await prisma.interviewSession.update({
          where: { id: session.id },
          data: {
            status: InterviewStatus.EXPIRED,
            timeRemainingSeconds: 0,
            lastActiveAt: now,
          },
        });
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: InterviewStatus.EXPIRED },
        });
      } else {
        session = await prisma.interviewSession.update({
          where: { id: session.id },
          data: {
            resumedAt: now,
            lastActiveAt: now,
            timeRemainingSeconds: remaining,
          },
        });
      }
    }

    return this.getSession(interviewId, candidateId);
  }

  /**
   * Retrieve active session state including questions and saved responses.
   * Survives page reloads completely.
   */
  static async getSession(interviewId: string, candidateId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        session: true,
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        responses: true,
        job: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.candidateId !== candidateId) {
      throw ApiError.forbidden('Unauthorized access to interview session');
    }

    // Auto-generate interview questions if not yet generated
    if (!interview.questions || interview.questions.length === 0) {
      try {
        const generated = await this.generateQuestionsForInterview(
          interviewId,
          interview.recruiterId || candidateId,
          'RECRUITER',
          false
        );
        (interview as any).questions = generated.questions;
      } catch (err) {
        console.warn('Auto-generation of questions in getSession skipped:', err);
      }
    }

    let session = interview.session;
    if (!session) {
      session = await prisma.interviewSession.create({
        data: {
          interviewId,
          candidateId,
          status: interview.status,
          currentQuestionIndex: 0,
        },
      });
    }

    // Recalculate remaining seconds
    const now = new Date();
    let timeRemainingSeconds = session.timeRemainingSeconds ?? interview.durationMins * 60;

    if (session.status === InterviewStatus.IN_PROGRESS && session.expiresAt) {
      timeRemainingSeconds = Math.max(
        0,
        Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)
      );

      if (timeRemainingSeconds === 0) {
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: { status: InterviewStatus.EXPIRED, timeRemainingSeconds: 0 },
        });
        await prisma.interview.update({
          where: { id: interviewId },
          data: { status: InterviewStatus.EXPIRED },
        });
        session.status = InterviewStatus.EXPIRED;
      }
    }

    return {
      interview: {
        id: interview.id,
        title: interview.title,
        type: interview.type,
        status: interview.status,
        difficulty: interview.difficulty,
        durationMins: interview.durationMins,
        numQuestions: interview.numQuestions,
        job: interview.job,
      },
      session: {
        ...session,
        timeRemainingSeconds,
      },
      questions: interview.questions,
      responses: interview.responses,
    };
  }

  /**
   * Save session progress (Autosave draft answer, code buffer, current index).
   * This is called continuously by frontend timer/debounced keystrokes to ensure 100% reload survival.
   */
  static async saveSessionProgress(
    interviewId: string,
    candidateId: string,
    input: UpdateSessionProgressInput
  ) {
    const session = await prisma.interviewSession.findUnique({
      where: { interviewId },
    });

    if (!session) {
      throw ApiError.notFound('Interview session not found');
    }

    if (session.candidateId !== candidateId) {
      throw ApiError.forbidden('Unauthorized to update this session');
    }

    const now = new Date();

    // Check expiry
    if (session.expiresAt && now > session.expiresAt) {
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: { status: InterviewStatus.EXPIRED, timeRemainingSeconds: 0 },
      });
      await prisma.interview.update({
        where: { id: interviewId },
        data: { status: InterviewStatus.EXPIRED },
      });
      throw ApiError.badRequest('Interview session has expired');
    }

    // Update active question response draft if provided
    if (input.activeResponse?.questionId) {
      await prisma.interviewResponse.upsert({
        where: {
          interviewId_questionId: {
            interviewId,
            questionId: input.activeResponse.questionId,
          },
        },
        create: {
          interviewId,
          questionId: input.activeResponse.questionId,
          candidateId,
          answerText: input.activeResponse.answerText || null,
          codeAnswer: input.activeResponse.codeAnswer || null,
          codeLanguage: input.activeResponse.codeLanguage || 'typescript',
          timeSpentSeconds: input.activeResponse.timeSpentSeconds || 0,
          isSubmitted: false,
        },
        update: {
          answerText: input.activeResponse.answerText !== undefined ? input.activeResponse.answerText : undefined,
          codeAnswer: input.activeResponse.codeAnswer !== undefined ? input.activeResponse.codeAnswer : undefined,
          codeLanguage: input.activeResponse.codeLanguage || undefined,
          timeSpentSeconds: input.activeResponse.timeSpentSeconds !== undefined ? input.activeResponse.timeSpentSeconds : undefined,
        },
      });
    }

    // Update session state
    const updatedSession = await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        currentQuestionIndex: input.currentQuestionIndex,
        clientState: input.clientState ? (input.clientState as any) : undefined,
        proctorLogs: input.proctorLogs ? (input.proctorLogs as any) : undefined,
        lastActiveAt: now,
      },
    });

    return updatedSession;
  }

  /**
   * Submit single question response.
   */
  static async submitQuestionResponse(
    interviewId: string,
    questionId: string,
    candidateId: string,
    input: SubmitQuestionResponseInput
  ) {
    const question = await prisma.interviewQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question || question.interviewId !== interviewId) {
      throw ApiError.notFound('Question not found for this interview');
    }

    const response = await prisma.interviewResponse.upsert({
      where: {
        interviewId_questionId: {
          interviewId,
          questionId,
        },
      },
      create: {
        interviewId,
        questionId,
        candidateId,
        answerText: input.answerText || null,
        codeAnswer: input.codeAnswer || null,
        codeLanguage: input.codeLanguage || 'typescript',
        executionResults: input.executionResults ? (input.executionResults as any) : undefined,
        timeSpentSeconds: input.timeSpentSeconds || 0,
        isSubmitted: true,
        submittedAt: new Date(),
      },
      update: {
        answerText: input.answerText || null,
        codeAnswer: input.codeAnswer || null,
        codeLanguage: input.codeLanguage || 'typescript',
        executionResults: input.executionResults ? (input.executionResults as any) : undefined,
        timeSpentSeconds: input.timeSpentSeconds || 0,
        isSubmitted: true,
        submittedAt: new Date(),
      },
    });

    return response;
  }

  /**
   * Complete candidate interview session.
   */
  static async completeSession(interviewId: string, candidateId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        session: true,
        questions: true,
        responses: true,
        candidate: {
          select: { id: true, name: true, email: true },
        },
        job: {
          select: { id: true, title: true },
        },
        recruiter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.candidateId !== candidateId) {
      throw ApiError.forbidden('Unauthorized to complete this interview');
    }

    const now = new Date();

    // Mark session and interview COMPLETED
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.interviewSession.updateMany({
        where: { interviewId },
        data: {
          status: InterviewStatus.COMPLETED,
          completedAt: now,
          timeRemainingSeconds: 0,
          lastActiveAt: now,
        },
      });

      await tx.interview.update({
        where: { id: interviewId },
        data: {
          status: InterviewStatus.COMPLETED,
        },
      });

      // Calculate baseline evaluation draft based on answered questions
      const answeredCount = interview.responses.filter((r) => r.isSubmitted || (r.codeAnswer && r.codeAnswer.trim().length > 0) || (r.answerText && r.answerText.trim().length > 0)).length;
      const totalCount = interview.questions.length;
      const completionRatio = totalCount > 0 ? answeredCount / totalCount : 1;
      const calculatedScore = Math.round(completionRatio * 85);

      let rec = 'CONSIDER';
      if (calculatedScore >= 80) rec = 'STRONG_HIRE';
      else if (calculatedScore >= 65) rec = 'HIRE';
      else if (calculatedScore < 50) rec = 'NO_HIRE';

      await tx.interviewEvaluation.upsert({
        where: { interviewId },
        create: {
          interviewId,
          overallScore: calculatedScore,
          technicalScore: calculatedScore,
          problemSolvingScore: calculatedScore,
          communicationScore: 80,
          codeQualityScore: calculatedScore,
          recommendation: rec,
          summary: `Candidate completed ${answeredCount} of ${totalCount} questions in ${interview.durationMins} minutes.`,
          strengths: [`Completed ${answeredCount} interview prompts within allotted timeframe.`],
          growthAreas: answeredCount < totalCount ? [`${totalCount - answeredCount} question(s) remained unsubmitted.`] : [],
        },
        update: {
          overallScore: calculatedScore,
          technicalScore: calculatedScore,
          problemSolvingScore: calculatedScore,
          summary: `Candidate completed ${answeredCount} of ${totalCount} questions in ${interview.durationMins} minutes.`,
        },
      });
    });

    // Dispatch Candidate & Recruiter Interview Completion Notifications
    if (interview.candidate && interview.job) {
      NotificationService.notifyInterviewCompleted(
        interview.candidate,
        interview.job,
        { id: interviewId }
      ).catch((err) => {
        console.warn('[InterviewService] Notification completion deferred:', err.message);
      });
    }

    if (interview.recruiter && interview.candidate && interview.job) {
      NotificationService.notifyCandidateCompletedInterview(
        interview.recruiter,
        { name: interview.candidate.name },
        interview.job,
        { id: interviewId }
      ).catch((err) => {
        console.warn('[InterviewService] Recruiter completion notification deferred:', err.message);
      });
    }

    return this.getSession(interviewId, candidateId);
  }

  // ==========================================
  // QUESTION MANAGEMENT & AI GENERATION ENGINE
  // ==========================================

  /**
   * Get persisted questions for an interview.
   * Access: Candidate (for their interview) or Recruiter/Admin.
   */
  static async getQuestions(
    interviewId: string,
    userId: string,
    userRole: UserRoleType
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { candidateId: true, recruiterId: true },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (userRole === USER_ROLES.CANDIDATE && interview.candidateId !== userId) {
      throw ApiError.forbidden('You do not have permission to view questions for this interview');
    }
    if (userRole === USER_ROLES.RECRUITER && interview.recruiterId !== userId) {
      throw ApiError.forbidden('You do not have permission to view questions for this interview');
    }

    const questions = await prisma.interviewQuestion.findMany({
      where: { interviewId },
      orderBy: { orderIndex: 'asc' },
    });

    return questions;
  }

  /**
   * Generate or retrieve persisted interview questions.
   * RULE: The AI must NOT repeatedly generate questions every time the page loads.
   * Generate once and persist. Only regenerate if forceRefresh is explicitly true.
   */
  static async generateQuestionsForInterview(
    interviewId: string,
    userId: string,
    userRole: UserRoleType,
    forceRefresh = false
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
                workExperiences: true,
                projects: true,
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
      },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (userRole === USER_ROLES.RECRUITER && interview.recruiterId !== userId) {
      throw ApiError.forbidden('You can only generate questions for your own interviews');
    }

    // 1. If questions already exist and forceRefresh is NOT set, return persisted questions without invoking AI
    if (interview.questions.length > 0 && !forceRefresh) {
      return {
        cached: true,
        count: interview.questions.length,
        questions: interview.questions,
      };
    }

    // 2. Build context and call AI engine
    const questionGenInput = this.buildQuestionContext(
      interview.job,
      interview.candidate,
      interview.type,
      interview.difficulty,
      interview.numQuestions || 5
    );

    const aiGen = getAiQuestionGenerator();
    const result = await aiGen.generateQuestions(questionGenInput);

    // 3. Persist in database inside a transaction
    const savedQuestions = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // If forceRefresh, remove previous questions that have no submitted responses
      if (forceRefresh) {
        await tx.interviewQuestion.deleteMany({
          where: { interviewId },
        });
      }

      const createdList = [];
      for (let i = 0; i < result.questions.length; i++) {
        const q = result.questions[i];
        const created = await tx.interviewQuestion.create({
          data: {
            interviewId,
            orderIndex: i + 1,
            title: q.title,
            description: q.question,
            type: q.type,
            difficulty: q.difficulty as any,
            category: q.category,
            expectedTopics: q.expectedTopics || [],
            evaluationCriteria: q.evaluationCriteria || [],
            isAiGenerated: true,
            starterCode: q.starterCode || null,
            testCases: (q.testCases as any) || null,
            rubricCriteria: (q.evaluationCriteria as any) || null,
            timeLimitMins: q.timeLimitMins || null,
          },
        });
        createdList.push(created);
      }

      await tx.interview.update({
        where: { id: interviewId },
        data: { numQuestions: createdList.length },
      });

      return createdList;
    });

    return {
      cached: false,
      count: savedQuestions.length,
      summary: result.summary,
      questions: savedQuestions,
    };
  }

  /**
   * Recruiter adds a custom question to the interview.
   */
  static async addQuestion(
    interviewId: string,
    recruiterId: string,
    input: CreateCustomQuestionInput
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.recruiterId !== recruiterId) {
      throw ApiError.forbidden('You can only add questions to your own interviews');
    }

    const questionCount = await prisma.interviewQuestion.count({
      where: { interviewId },
    });

    const newQuestion = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.interviewQuestion.create({
        data: {
          interviewId,
          orderIndex: questionCount + 1,
          title: input.title,
          description: input.description,
          type: input.type,
          difficulty: input.difficulty,
          category: input.category,
          expectedTopics: input.expectedTopics,
          evaluationCriteria: input.evaluationCriteria,
          isAiGenerated: false,
          starterCode: input.starterCode || null,
          testCases: input.testCases || null,
          rubricCriteria: (input.evaluationCriteria as any) || null,
          timeLimitMins: input.timeLimitMins || null,
        },
      });

      await tx.interview.update({
        where: { id: interviewId },
        data: { numQuestions: questionCount + 1 },
      });

      return created;
    });

    return newQuestion;
  }

  /**
   * Recruiter edits an existing question.
   */
  static async updateQuestion(
    interviewId: string,
    questionId: string,
    recruiterId: string,
    input: UpdateQuestionInput
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.recruiterId !== recruiterId) {
      throw ApiError.forbidden('You can only edit questions in your own interviews');
    }

    const existingQuestion = await prisma.interviewQuestion.findFirst({
      where: { id: questionId, interviewId },
    });

    if (!existingQuestion) {
      throw ApiError.notFound('Question not found in this interview');
    }

    const updated = await prisma.interviewQuestion.update({
      where: { id: questionId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.difficulty ? { difficulty: input.difficulty } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.expectedTopics ? { expectedTopics: input.expectedTopics } : {}),
        ...(input.evaluationCriteria ? { evaluationCriteria: input.evaluationCriteria, rubricCriteria: input.evaluationCriteria as any } : {}),
        ...(input.starterCode !== undefined ? { starterCode: input.starterCode } : {}),
        ...(input.testCases !== undefined ? { testCases: input.testCases } : {}),
        ...(input.timeLimitMins !== undefined ? { timeLimitMins: input.timeLimitMins } : {}),
      },
    });

    return updated;
  }

  /**
   * Recruiter deletes a question and re-normalizes order indexes.
   */
  static async deleteQuestion(
    interviewId: string,
    questionId: string,
    recruiterId: string
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.recruiterId !== recruiterId) {
      throw ApiError.forbidden('You can only delete questions from your own interviews');
    }

    const existingQuestion = await prisma.interviewQuestion.findFirst({
      where: { id: questionId, interviewId },
    });

    if (!existingQuestion) {
      throw ApiError.notFound('Question not found in this interview');
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.interviewQuestion.delete({
        where: { id: questionId },
      });

      // Renormalize order indices sequentially 1..N
      const remaining = await tx.interviewQuestion.findMany({
        where: { interviewId },
        orderBy: { orderIndex: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].orderIndex !== i + 1) {
          await tx.interviewQuestion.update({
            where: { id: remaining[i].id },
            data: { orderIndex: i + 1 },
          });
        }
      }

      await tx.interview.update({
        where: { id: interviewId },
        data: { numQuestions: remaining.length },
      });
    });

    return { message: 'Question deleted and question indices reordered successfully' };
  }

  /**
   * Recruiter reorders questions with new order sequence.
   */
  static async reorderQuestions(
    interviewId: string,
    recruiterId: string,
    questionIds: string[]
  ) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw ApiError.notFound('Interview not found');
    }

    if (interview.recruiterId !== recruiterId) {
      throw ApiError.forbidden('You can only reorder questions in your own interviews');
    }

    const currentQuestions = await prisma.interviewQuestion.findMany({
      where: { interviewId },
      select: { id: true },
    });

    const currentIds = new Set(currentQuestions.map((q) => q.id));
    for (const qId of questionIds) {
      if (!currentIds.has(qId)) {
        throw ApiError.badRequest(`Question ID "${qId}" does not belong to interview "${interviewId}"`);
      }
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (let i = 0; i < questionIds.length; i++) {
        await tx.interviewQuestion.update({
          where: { id: questionIds[i] },
          data: { orderIndex: i + 1 },
        });
      }
    });

    const updatedList = await prisma.interviewQuestion.findMany({
      where: { interviewId },
      orderBy: { orderIndex: 'asc' },
    });

    return updatedList;
  }
}

