import { apiClient } from './api-client';

export type ReportSectionClassification =
  | 'AI_EVALUATION'
  | 'OBJECTIVE_RESULT'
  | 'RECRUITER_NOTE'
  | 'METADATA';

export interface CandidateReportData {
  reportId: string;
  generatedAt: string;
  interviewId: string;
  applicationId?: string;

  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    headline: string;
    yearsOfExperience: number;
    education: string;
    skills: string[];
    applicationDate: string;
  };

  job: {
    id: string;
    title: string;
    department: string;
    location: string;
    employmentType: string;
    experienceLevel: string;
    requiredSkills: string[];
    preferredSkills: string[];
    recruiterName: string;
  };

  resumeSummary: {
    executiveSummary: string;
    primaryRoleHighlights: string;
    source: string;
  };

  resumeMatch: {
    matchScore: number;
    rating: string;
    matchedSkills: string[];
    missingSkills: string[];
    experienceMatchScore: number;
    educationMatchScore: number;
    summary: string;
  };

  codingPerformance: {
    score: number;
    passRate: string;
    testsPassed: number;
    totalTests: number;
    executionTimeMs: number;
    memoryKb: number;
    primaryLanguage: string;
    status: string;
    problemsAttempted: number;
    submissions: Array<{
      problemTitle: string;
      difficulty: string;
      language: string;
      status: string;
      passedTests: number;
      totalTests: number;
      executionTimeMs: number;
    }>;
  };

  technicalInterview: {
    score: number;
    problemSolvingScore: number;
    answerRelevanceScore: number;
    summary: string;
    questionsEvaluated: number;
    competencyHighlights: string[];
  };

  communication: {
    score: number;
    speakingWpm: number;
    totalSpeakingDurationSeconds: number;
    fillerWordCount: number;
    fillerWordsSample: string[];
    completenessScore: number;
    summary: string;
  };

  transcriptSummary: {
    synopsis: string;
    totalExchanges: number;
    keyQuestions: Array<{
      orderIndex: number;
      question: string;
      category: string;
      answerExcerpt: string;
      relevanceScore: number;
    }>;
  };

  integritySignals: {
    rating: 'HIGH' | 'MODERATE' | 'REVIEW_RECOMMENDED';
    cleanTimePercentage: number;
    totalEvents: number;
    tabHiddenEvents: number;
    multipleFacesEvents: number;
    lookingAwayEvents: number;
    cameraDisconnectedEvents: number;
    fullscreenExitEvents: number;
    disclaimer: string;
  };

  strengths: string[];
  weaknesses: string[];
  recommendedImprovements: string[];

  overallScore: {
    finalScore: number;
    weights: {
      resumeWeight: number;
      codingWeight: number;
      technicalWeight: number;
      communicationWeight: number;
      otherWeight: number;
    };
    breakdown: Array<{
      dimension: string;
      rawScore: number;
      weightPercentage: number;
      weightedPoints: number;
    }>;
  };

  aiRecommendation: {
    recommendation: 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'NO_HIRE';
    summary: string;
    disclaimer: string;
  };

  recruiterNotes: {
    recruiterRecommendation: string | null;
    recruiterNotes: string | null;
    isOverridden: boolean;
    overriddenAt: string | null;
    recruiterName: string | null;
    applicationStatus: string;
  };
}

export const reportsApi = {
  /**
   * Fetch structured report JSON for an interview
   */
  async getInterviewReport(interviewId: string): Promise<CandidateReportData> {
    const response = await apiClient.get(`/reports/interviews/${interviewId}`);
    return response.data.data;
  },

  /**
   * Download generated PDF evaluation report directly in browser
   */
  async downloadInterviewReportPdf(interviewId: string, candidateName?: string): Promise<void> {
    const response = await apiClient.get(`/reports/interviews/${interviewId}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const safeName = candidateName ? candidateName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Candidate';
    link.setAttribute('download', `HireMind-Evaluation-Report-${safeName}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Fetch report JSON by applicationId
   */
  async getApplicationReport(applicationId: string): Promise<CandidateReportData> {
    const response = await apiClient.get(`/reports/applications/${applicationId}`);
    return response.data.data;
  },

  /**
   * Download PDF evaluation report by applicationId
   */
  async downloadApplicationReportPdf(applicationId: string, candidateName?: string): Promise<void> {
    const response = await apiClient.get(`/reports/applications/${applicationId}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    const safeName = candidateName ? candidateName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Candidate';
    link.setAttribute('download', `HireMind-Evaluation-Report-${safeName}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },
};
