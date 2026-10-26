import { env } from '../../../config/env.js';

interface BaseTemplateOptions {
  preheader?: string;
  headline: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

/**
 * Renders consistent, responsive HTML master layout for HireMind emails
 */
export function renderMasterLayout({
  preheader = 'HireMind AI Hiring Intelligence',
  headline,
  contentHtml,
  ctaText,
  ctaUrl,
  footerNote,
}: BaseTemplateOptions): string {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const actionButton =
    ctaText && ctaUrl
      ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td align="center">
            <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 44px; text-align: center; text-decoration: none; padding: 0 28px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
              ${ctaText} &rarr;
            </a>
          </td>
        </tr>
      </table>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <!--[if mso]>
  <style>
    table {border-collapse: collapse;}
    td, th {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${preheader}
  </div>
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(180deg, #1e1b4b 0%, #111827 100%); border-bottom: 1px solid #1f2937;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">HIREMIND <span style="color: #818cf8;">AI</span></span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: #1e1b4b; border: 1px solid #3730a3; border-radius: 12px; font-size: 11px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px;">Notification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${headline}
              </h1>
              
              <div style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                ${contentHtml}
              </div>

              ${actionButton}

              ${
                footerNote
                  ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f2937; font-size: 12px; color: #94a3b8; line-height: 1.5;">${footerNote}</div>`
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0f172a; border-top: 1px solid #1f2937; text-align: center; font-size: 11px; color: #64748b;">
              <p style="margin: 0 0 8px 0;">This is an automated notification from HireMind AI Candidate Intelligence Platform.</p>
              <p style="margin: 0;">
                <a href="${appUrl}/dashboard" style="color: #818cf8; text-decoration: none;">Candidate Workspace</a> &bull;
                <a href="${appUrl}/privacy" style="color: #818cf8; text-decoration: none;">Privacy Policy</a> &bull;
                <a href="${appUrl}/settings" style="color: #818cf8; text-decoration: none;">Notification Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ==========================================
// CANDIDATE EVENT TEMPLATES
// ==========================================

export interface CandidateAppSubmittedContext {
  candidateName: string;
  jobTitle: string;
  companyName?: string;
  applicationId: string;
}

export function applicationSubmittedTemplate(ctx: CandidateAppSubmittedContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Application Received: ${ctx.jobTitle}`;
  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>Thank you for submitting your application for the <strong>${ctx.jobTitle}</strong> position${ctx.companyName ? ` at <strong>${ctx.companyName}</strong>` : ''}.</p>
    <div style="background-color: #1e293b; border-left: 4px solid #4f46e5; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; color: #f1f5f9;"><strong>Application Reference:</strong> ${ctx.applicationId.slice(0, 8).toUpperCase()}</p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Our recruitment team and AI evaluation engine are currently parsing your resume qualifications.</p>
    </div>
    <p>You can track your application status and prepare for upcoming technical screening directly from your candidate dashboard.</p>
  `;

  return {
    subject: `Application Confirmed: ${ctx.jobTitle} - HireMind AI`,
    html: renderMasterLayout({
      preheader: `We have received your application for ${ctx.jobTitle}`,
      headline,
      contentHtml,
      ctaText: 'View Application Status',
      ctaUrl: `${appUrl}/dashboard`,
      footerNote: 'Need to update your contact information or resume? You can re-upload assets from your candidate settings.',
    }),
    text: `Hi ${ctx.candidateName},\n\nThank you for applying for the ${ctx.jobTitle} role. Your application reference is ${ctx.applicationId.slice(0, 8).toUpperCase()}.\n\nTrack your application at: ${appUrl}/dashboard`,
  };
}

export interface CandidateStatusChangedContext {
  candidateName: string;
  jobTitle: string;
  oldStatus: string;
  newStatus: string;
  notes?: string;
}

export function applicationStatusChangedTemplate(ctx: CandidateStatusChangedContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Application Update: ${ctx.jobTitle}`;
  const statusBadge =
    ctx.newStatus === 'SHORTLISTED'
      ? '<span style="color: #34d399; font-weight: bold;">SHORTLISTED</span>'
      : ctx.newStatus === 'INTERVIEWING'
      ? '<span style="color: #818cf8; font-weight: bold;">INTERVIEWING</span>'
      : ctx.newStatus === 'REJECTED'
      ? '<span style="color: #f87171; font-weight: bold;">NOT ADVANCED</span>'
      : `<span style="color: #fbbf24; font-weight: bold;">${ctx.newStatus}</span>`;

  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>Your application status for the <strong>${ctx.jobTitle}</strong> position has been updated by the recruitment panel.</p>
    <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">Updated Status</p>
      <p style="margin: 6px 0 0 0; font-size: 18px;">${statusBadge}</p>
      ${
        ctx.notes
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #334155; font-size: 13px; color: #cbd5e1;"><strong>Recruiter Notes:</strong> "${ctx.notes}"</div>`
          : ''
      }
    </div>
    <p>Log in to your workspace to view the complete details and next steps.</p>
  `;

  return {
    subject: `Application Status Updated: ${ctx.jobTitle} (${ctx.newStatus})`,
    html: renderMasterLayout({
      preheader: `Your application status for ${ctx.jobTitle} has changed to ${ctx.newStatus}`,
      headline,
      contentHtml,
      ctaText: 'Open Candidate Portal',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.candidateName},\n\nYour application status for ${ctx.jobTitle} is now: ${ctx.newStatus}.${ctx.notes ? `\n\nNotes: ${ctx.notes}` : ''}\n\nView details: ${appUrl}/dashboard`,
  };
}

export interface CandidateInterviewScheduledContext {
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  scheduledAt: string;
  durationMins: number;
  chamberRoomId?: string;
}

export function interviewScheduledTemplate(ctx: CandidateInterviewScheduledContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Interview Scheduled: ${ctx.jobTitle}`;
  const interviewUrl = `${appUrl}/interview/${ctx.interviewId}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>Your technical screening interview for <strong>${ctx.jobTitle}</strong> has been confirmed.</p>
    
    <div style="background-color: #1e293b; border-left: 4px solid #818cf8; padding: 18px; border-radius: 8px; margin: 20px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom: 8px; font-size: 13px; color: #94a3b8;">Date & Time:</td>
          <td style="padding-bottom: 8px; font-size: 13px; font-weight: bold; color: #ffffff;">${new Date(ctx.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 8px; font-size: 13px; color: #94a3b8;">Duration:</td>
          <td style="padding-bottom: 8px; font-size: 13px; color: #ffffff;">${ctx.durationMins} Minutes</td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #94a3b8;">Format:</td>
          <td style="font-size: 13px; color: #34d399; font-weight: 600;">Interactive AI Coding & Voice Chamber</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px;"><strong>System Preparation Tips:</strong></p>
    <ul style="font-size: 13px; color: #94a3b8; padding-left: 20px; margin: 8px 0 20px 0;">
      <li>Ensure a stable internet connection and quiet environment.</li>
      <li>Grant camera and microphone permissions when prompted in browser.</li>
      <li>Chrome or Firefox recommended for real-time WebRTC audio chamber.</li>
    </ul>
  `;

  return {
    subject: `Interview Scheduled: ${ctx.jobTitle} - HireMind AI`,
    html: renderMasterLayout({
      preheader: `Your interview for ${ctx.jobTitle} is scheduled on ${new Date(ctx.scheduledAt).toLocaleDateString()}`,
      headline,
      contentHtml,
      ctaText: 'Enter Interview Chamber',
      ctaUrl: interviewUrl,
      footerNote: 'You can test your audio and webcam setup beforehand in the pre-flight check.',
    }),
    text: `Hi ${ctx.candidateName},\n\nYour interview for ${ctx.jobTitle} is scheduled on ${ctx.scheduledAt} (${ctx.durationMins} mins).\n\nAccess the interview chamber: ${interviewUrl}`,
  };
}

export interface CandidateInterviewReminderContext {
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  scheduledAt: string;
  reminderType?: '24h' | '1h';
}

export function interviewReminderTemplate(ctx: CandidateInterviewReminderContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Upcoming Interview Reminder: ${ctx.jobTitle}`;
  const interviewUrl = `${appUrl}/interview/${ctx.interviewId}`;
  const timeframe = ctx.reminderType === '1h' ? 'in 1 hour' : 'tomorrow';

  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>This is a quick reminder that your technical interview for <strong>${ctx.jobTitle}</strong> is scheduled to begin <strong>${timeframe}</strong>.</p>
    
    <div style="background-color: #1e1b4b; border: 1px solid #4338ca; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; font-weight: bold; color: #a5b4fc;">
        Scheduled Time: ${new Date(ctx.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
      </p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">Please connect 5 minutes early to test microphone and video latency.</p>
    </div>
  `;

  return {
    subject: `Reminder: Technical Interview ${timeframe} - ${ctx.jobTitle}`,
    html: renderMasterLayout({
      preheader: `Reminder: Your interview starts ${timeframe}`,
      headline,
      contentHtml,
      ctaText: 'Launch Interview Session',
      ctaUrl: interviewUrl,
    }),
    text: `Hi ${ctx.candidateName},\n\nReminder: Your technical interview for ${ctx.jobTitle} begins ${timeframe} at ${ctx.scheduledAt}.\n\nJoin: ${interviewUrl}`,
  };
}

export interface CandidateInterviewCompletedContext {
  candidateName: string;
  jobTitle: string;
  interviewId: string;
}

export function interviewCompletedTemplate(ctx: CandidateInterviewCompletedContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Interview Completed: ${ctx.jobTitle}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>Great job! Your interview session for <strong>${ctx.jobTitle}</strong> has been successfully recorded and submitted.</p>
    <div style="background-color: #064e3b; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 6px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; color: #ecfdf5;"><strong>Session Status:</strong> All coding submissions and verbal responses preserved.</p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #a7f3d0;">Our recruiting panel will synthesize the evaluation results. You will receive an update once reviews are finalized.</p>
    </div>
  `;

  return {
    subject: `Interview Completed: ${ctx.jobTitle} - HireMind AI`,
    html: renderMasterLayout({
      preheader: `Thank you for completing your interview for ${ctx.jobTitle}`,
      headline,
      contentHtml,
      ctaText: 'Return to Dashboard',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.candidateName},\n\nYour interview for ${ctx.jobTitle} is complete. The team is currently reviewing your results.\n\nDashboard: ${appUrl}/dashboard`,
  };
}

export interface CandidateResultsAvailableContext {
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  score?: number;
}

export function resultsAvailableTemplate(ctx: CandidateResultsAvailableContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Evaluation Results Available: ${ctx.jobTitle}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.candidateName}</strong>,</p>
    <p>The feedback and evaluation summary for your interview on <strong>${ctx.jobTitle}</strong> is now available.</p>
    <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #f1f5f9;">You can review your strengths, communication pacing, and technical problem-solving breakdown in your candidate portal.</p>
    </div>
  `;

  return {
    subject: `Results Available: ${ctx.jobTitle} - HireMind AI`,
    html: renderMasterLayout({
      preheader: `Your interview performance evaluation for ${ctx.jobTitle} is ready`,
      headline,
      contentHtml,
      ctaText: 'View Evaluation Summary',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.candidateName},\n\nYour interview evaluation results for ${ctx.jobTitle} are now available.\n\nView at: ${appUrl}/dashboard`,
  };
}

// ==========================================
// RECRUITER EVENT TEMPLATES
// ==========================================

export interface RecruiterNewAppContext {
  recruiterName: string;
  candidateName: string;
  jobTitle: string;
  applicationId: string;
  matchScore?: number;
}

export function newApplicationTemplate(ctx: RecruiterNewAppContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `New Application: ${ctx.candidateName}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.recruiterName}</strong>,</p>
    <p>A new candidate has submitted an application for <strong>${ctx.jobTitle}</strong>.</p>
    <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; font-weight: bold; color: #ffffff;">${ctx.candidateName}</p>
      ${
        ctx.matchScore
          ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #34d399;"><strong>Automated Resume Fit:</strong> ${ctx.matchScore}%</p>`
          : ''
      }
    </div>
  `;

  return {
    subject: `New Candidate: ${ctx.candidateName} applied for ${ctx.jobTitle}`,
    html: renderMasterLayout({
      preheader: `${ctx.candidateName} applied for ${ctx.jobTitle}`,
      headline,
      contentHtml,
      ctaText: 'Review Candidate Dossier',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.recruiterName},\n\n${ctx.candidateName} applied for ${ctx.jobTitle}.${ctx.matchScore ? ` Fit: ${ctx.matchScore}%` : ''}\n\nReview at: ${appUrl}/dashboard`,
  };
}

export interface RecruiterCandidateCompletedContext {
  recruiterName: string;
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  cleanTime?: number;
}

export function candidateCompletedInterviewTemplate(ctx: RecruiterCandidateCompletedContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Interview Completed: ${ctx.candidateName}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.recruiterName}</strong>,</p>
    <p><strong>${ctx.candidateName}</strong> has just finished their interview session for <strong>${ctx.jobTitle}</strong>.</p>
    <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #f1f5f9;">Session recordings, coding test outputs, audio metrics, and proctoring telemetry are ready for your review.</p>
    </div>
  `;

  return {
    subject: `Interview Submitted: ${ctx.candidateName} (${ctx.jobTitle})`,
    html: renderMasterLayout({
      preheader: `${ctx.candidateName} finished interview for ${ctx.jobTitle}`,
      headline,
      contentHtml,
      ctaText: 'Review Interview Session',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.recruiterName},\n\n${ctx.candidateName} completed the interview for ${ctx.jobTitle}.\n\nReview session: ${appUrl}/dashboard`,
  };
}

export interface RecruiterInterviewReminderContext {
  recruiterName: string;
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  scheduledAt: string;
}

export function recruiterInterviewReminderTemplate(ctx: RecruiterInterviewReminderContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Upcoming Interview: ${ctx.candidateName}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.recruiterName}</strong>,</p>
    <p>You have an upcoming interview scheduled with <strong>${ctx.candidateName}</strong> for the <strong>${ctx.jobTitle}</strong> requisition.</p>
    <div style="background-color: #1e1b4b; border: 1px solid #4338ca; padding: 14px 18px; border-radius: 8px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; font-weight: bold; color: #a5b4fc;">Time: ${new Date(ctx.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </div>
  `;

  return {
    subject: `Interview Reminder: ${ctx.candidateName} (${ctx.jobTitle})`,
    html: renderMasterLayout({
      preheader: `Reminder: Interview with ${ctx.candidateName}`,
      headline,
      contentHtml,
      ctaText: 'Open Recruiter View',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.recruiterName},\n\nInterview with ${ctx.candidateName} for ${ctx.jobTitle} on ${ctx.scheduledAt}.\n\nPortal: ${appUrl}/dashboard`,
  };
}

export interface RecruiterReportReadyContext {
  recruiterName: string;
  candidateName: string;
  jobTitle: string;
  interviewId: string;
  overallScore: number;
  recommendation: string;
}

export function reportReadyTemplate(ctx: RecruiterReportReadyContext) {
  const appUrl = env.APP_URL || 'http://localhost:3000';
  const headline = `Dossier & Report Ready: ${ctx.candidateName}`;

  const contentHtml = `
    <p>Hi <strong>${ctx.recruiterName}</strong>,</p>
    <p>The 15-section candidate intelligence evaluation dossier and downloadable PDF report for <strong>${ctx.candidateName}</strong> (${ctx.jobTitle}) is now generated and ready for hiring panel review.</p>
    <div style="background-color: #1e293b; border-left: 4px solid #818cf8; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">Deterministic Overall Score: <strong style="color: #ffffff; font-size: 15px;">${ctx.overallScore}/100</strong></p>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Recommendation Verdict: <strong style="color: #34d399;">${ctx.recommendation.replace('_', ' ')}</strong></p>
    </div>
    <p>You can view the full interactive breakdown or download the formal vector PDF report from your recruitment reports dashboard.</p>
  `;

  return {
    subject: `Evaluation Report Ready: ${ctx.candidateName} (${ctx.overallScore}/100 - ${ctx.recommendation})`,
    html: renderMasterLayout({
      preheader: `Evaluation report ready for ${ctx.candidateName}`,
      headline,
      contentHtml,
      ctaText: 'Download PDF Report',
      ctaUrl: `${appUrl}/dashboard`,
    }),
    text: `Hi ${ctx.recruiterName},\n\nThe 15-section report for ${ctx.candidateName} (${ctx.jobTitle}) is ready.\nOverall Score: ${ctx.overallScore}/100\nVerdict: ${ctx.recommendation}\n\nView at: ${appUrl}/dashboard`,
  };
}
