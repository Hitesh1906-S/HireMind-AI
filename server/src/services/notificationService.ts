import { prisma } from '../config/prisma.js';
import { EmailService } from './email/emailService.js';
import {
  applicationSubmittedTemplate,
  applicationStatusChangedTemplate,
  interviewScheduledTemplate,
  interviewReminderTemplate,
  interviewCompletedTemplate,
  resultsAvailableTemplate,
  newApplicationTemplate,
  candidateCompletedInterviewTemplate,
  recruiterInterviewReminderTemplate,
  reportReadyTemplate,
} from './email/templates/emailTemplates.js';

export interface CreateInAppNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
}

export class NotificationService {
  // ==========================================
  // IN-APP NOTIFICATIONS OPERATIONS
  // ==========================================

  static async getNotifications(userId: string, unreadOnly: boolean = false, limit: number = 30) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  static async markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    });
  }

  static async deleteNotification(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  static async createInAppNotification(dto: CreateInAppNotificationDto) {
    return prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type || 'INFO',
        link: dto.link || null,
        read: false,
      },
    });
  }

  // ==========================================
  // CANDIDATE EVENT DISPATCHERS
  // ==========================================

  /**
   * Candidate Event 1: Application submitted
   */
  static async notifyApplicationSubmitted(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    application: { id: string }
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: 'Application Received',
      message: `Your application for ${job.title} has been received successfully.`,
      type: 'APPLICATION',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = applicationSubmittedTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      applicationId: application.id,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Candidate Event 2: Application status changed
   */
  static async notifyApplicationStatusChanged(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    oldStatus: string,
    newStatus: string,
    notes?: string
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: `Application Update: ${job.title}`,
      message: `Your application status for ${job.title} was updated to ${newStatus.replace('_', ' ')}.`,
      type: 'APPLICATION',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = applicationStatusChangedTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      oldStatus,
      newStatus,
      notes,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Candidate Event 3: Interview scheduled
   */
  static async notifyInterviewScheduled(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    interview: { id: string; scheduledAt: Date | string; durationMins: number; chamberRoomId?: string }
  ) {
    const scheduledDateStr = new Date(interview.scheduledAt).toLocaleString();

    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: 'Interview Scheduled',
      message: `Your technical interview for ${job.title} is scheduled for ${scheduledDateStr}.`,
      type: 'INTERVIEW',
      link: `/interview/${interview.id}`,
    });

    // 2. Email notification
    const emailData = interviewScheduledTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
      scheduledAt: new Date(interview.scheduledAt).toISOString(),
      durationMins: interview.durationMins,
      chamberRoomId: interview.chamberRoomId,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Candidate Event 4: Interview reminder
   */
  static async notifyInterviewReminder(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    interview: { id: string; scheduledAt: Date | string },
    reminderType: '24h' | '1h' = '24h'
  ) {
    const timeframe = reminderType === '1h' ? 'in 1 hour' : 'tomorrow';

    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: 'Interview Reminder',
      message: `Reminder: Your interview for ${job.title} is starting ${timeframe}.`,
      type: 'INTERVIEW',
      link: `/interview/${interview.id}`,
    });

    // 2. Email notification
    const emailData = interviewReminderTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
      scheduledAt: new Date(interview.scheduledAt).toISOString(),
      reminderType,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Candidate Event 5: Interview completed
   */
  static async notifyInterviewCompleted(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    interview: { id: string }
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: 'Interview Completed',
      message: `Your interview session for ${job.title} was submitted successfully. Our team will review the results.`,
      type: 'SUCCESS',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = interviewCompletedTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Candidate Event 6: Results available
   */
  static async notifyResultsAvailable(
    candidate: { id: string; name: string; email: string },
    job: { id: string; title: string },
    interview: { id: string },
    score?: number
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: candidate.id,
      title: 'Interview Results Available',
      message: `Your evaluation summary for ${job.title} is now available in your candidate portal.`,
      type: 'INFO',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = resultsAvailableTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
      score,
    });

    await EmailService.sendEmail({
      to: candidate.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  // ==========================================
  // RECRUITER EVENT DISPATCHERS
  // ==========================================

  /**
   * Recruiter Event 1: New application
   */
  static async notifyNewApplication(
    recruiter: { id: string; name: string; email: string },
    candidate: { name: string; email: string },
    job: { id: string; title: string },
    application: { id: string; matchScore?: number }
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: recruiter.id,
      title: `New Candidate: ${candidate.name}`,
      message: `${candidate.name} submitted an application for ${job.title}${application.matchScore ? ` (${application.matchScore}% fit)` : ''}.`,
      type: 'APPLICATION',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = newApplicationTemplate({
      recruiterName: recruiter.name,
      candidateName: candidate.name,
      jobTitle: job.title,
      applicationId: application.id,
      matchScore: application.matchScore,
    });

    await EmailService.sendEmail({
      to: recruiter.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Recruiter Event 2: Candidate completed interview
   */
  static async notifyCandidateCompletedInterview(
    recruiter: { id: string; name: string; email: string },
    candidate: { name: string },
    job: { id: string; title: string },
    interview: { id: string }
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: recruiter.id,
      title: `Interview Finished: ${candidate.name}`,
      message: `${candidate.name} has concluded their interview for ${job.title}. Code execution and telemetry recorded.`,
      type: 'INTERVIEW',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = candidateCompletedInterviewTemplate({
      recruiterName: recruiter.name,
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
    });

    await EmailService.sendEmail({
      to: recruiter.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Recruiter Event 3: Interview reminder
   */
  static async notifyRecruiterInterviewReminder(
    recruiter: { id: string; name: string; email: string },
    candidate: { name: string },
    job: { id: string; title: string },
    interview: { id: string; scheduledAt: Date | string }
  ) {
    const timeFormatted = new Date(interview.scheduledAt).toLocaleString();

    // 1. In-app notification
    await this.createInAppNotification({
      userId: recruiter.id,
      title: `Interview Reminder: ${candidate.name}`,
      message: `You have an interview with ${candidate.name} for ${job.title} scheduled on ${timeFormatted}.`,
      type: 'INTERVIEW',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = recruiterInterviewReminderTemplate({
      recruiterName: recruiter.name,
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
      scheduledAt: new Date(interview.scheduledAt).toISOString(),
    });

    await EmailService.sendEmail({
      to: recruiter.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }

  /**
   * Recruiter Event 4: Report ready
   */
  static async notifyReportReady(
    recruiter: { id: string; name: string; email: string },
    candidate: { name: string },
    job: { id: string; title: string },
    interview: { id: string },
    overallScore: number,
    recommendation: string
  ) {
    // 1. In-app notification
    await this.createInAppNotification({
      userId: recruiter.id,
      title: `Evaluation Report Ready: ${candidate.name}`,
      message: `15-dimension report and PDF ready for ${candidate.name} (${overallScore}/100 - ${recommendation.replace('_', ' ')}).`,
      type: 'SUCCESS',
      link: '/dashboard',
    });

    // 2. Email notification
    const emailData = reportReadyTemplate({
      recruiterName: recruiter.name,
      candidateName: candidate.name,
      jobTitle: job.title,
      interviewId: interview.id,
      overallScore,
      recommendation,
    });

    await EmailService.sendEmail({
      to: recruiter.email,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }
}
