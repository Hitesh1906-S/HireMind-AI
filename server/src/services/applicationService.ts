import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from '../validations/applicationValidations.js';
import { UserRoleType, USER_ROLES } from '../constants/roles.js';
import { JobMatchService } from './jobMatch.service.js';
import { NotificationService } from './notificationService.js';

export class ApplicationService {
  /**
   * Submit job application (Candidate only)
   */
  static async applyForJob(candidateId: string, input: CreateApplicationInput) {
    const job = await prisma.job.findUnique({
      where: { id: input.jobId },
      include: {
        recruiter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!job) {
      throw ApiError.notFound('Job opening not found');
    }

    if (job.status !== 'ACTIVE') {
      throw ApiError.badRequest('This job opening is not accepting new applications');
    }

    // Check existing application
    const existing = await prisma.application.findUnique({
      where: {
        jobId_candidateId: {
          jobId: input.jobId,
          candidateId,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('You have already applied for this job requisition');
    }

    // Fetch candidate details
    const candidateUser = await prisma.user.findUnique({
      where: { id: candidateId },
      select: { id: true, name: true, email: true, phone: true },
    });

    // Optionally update user phone if provided
    if (input.phone) {
      await prisma.user.update({
        where: { id: candidateId },
        data: { phone: input.phone },
      });
    }

    const application = await prisma.application.create({
      data: {
        jobId: input.jobId,
        candidateId,
        resumeUrl: input.resumeUrl || null,
        coverLetter: input.coverLetter || null,
        status: 'APPLIED',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            location: true,
            employmentType: true,
            salaryRange: true,
          },
        },
      },
    });

    // Automatically trigger AI Resume-to-Job Matching in background
    JobMatchService.getOrCalculateMatch(input.jobId, candidateId).catch((err) => {
      console.warn('[ApplicationService] Background match calculation deferred:', err.message);
    });

    // Dispatch Candidate & Recruiter Notifications
    if (candidateUser) {
      NotificationService.notifyApplicationSubmitted(
        { id: candidateUser.id, name: candidateUser.name, email: candidateUser.email },
        { id: job.id, title: job.title },
        { id: application.id }
      ).catch((e) => console.warn('[Notification Error]', e));

      if (job.recruiter) {
        NotificationService.notifyNewApplication(
          { id: job.recruiter.id, name: job.recruiter.name, email: job.recruiter.email },
          { name: candidateUser.name, email: candidateUser.email },
          { id: job.id, title: job.title },
          { id: application.id }
        ).catch((e) => console.warn('[Notification Error]', e));
      }
    }

    return application;
  }

  /**
   * Get all applications submitted by candidate
   */
  static async getMyApplications(candidateId: string) {
    const applications = await prisma.application.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            recruiter: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return applications;
  }

  /**
   * Get application details
   */
  static async getApplicationById(id: string, userId: string, userRole: UserRoleType) {
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            recruiter: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            headline: true,
            bio: true,
            phone: true,
          },
        },
      },
    });

    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    // Authorization guard: Candidate who submitted, or Job Recruiter, or Admin
    const isOwnerCandidate = application.candidateId === userId;
    const isJobRecruiter = application.job.recruiterId === userId;
    const isAdmin = userRole === USER_ROLES.ADMIN;

    if (!isOwnerCandidate && !isJobRecruiter && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to view this application');
    }

    return application;
  }

  /**
   * Update application status (Recruiter / Admin only)
   */
  static async updateStatus(
    id: string,
    userId: string,
    userRole: UserRoleType,
    input: UpdateApplicationStatusInput
  ) {
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });

    if (!application) {
      throw ApiError.notFound('Application not found');
    }

    if (userRole !== USER_ROLES.ADMIN && application.job.recruiterId !== userId) {
      throw ApiError.forbidden('You can only update candidates for your own job requisitions');
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Notify candidate of status update
    if (updated.candidate && updated.job && input.status !== application.status) {
      NotificationService.notifyApplicationStatusChanged(
        { id: updated.candidate.id, name: updated.candidate.name, email: updated.candidate.email },
        { id: updated.job.id, title: updated.job.title },
        application.status,
        input.status,
        input.notes || undefined
      ).catch((e) => console.warn('[Notification Error]', e));
    }

    return updated;
  }
}
