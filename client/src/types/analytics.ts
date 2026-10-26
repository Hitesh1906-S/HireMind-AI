export interface RecruiterIntelligenceFilters {
  jobId?: string;
  dateRange?: '7d' | '30d' | '90d' | 'all';
  interviewStatus?: string;
  minScore?: number;
  maxScore?: number;
}

export interface RecruiterIntelligenceOverview {
  totalCandidates: number;
  activeJobs: number;
  totalJobs: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  avgCandidateScore: number;
  averageCandidateScore?: number;
  shortlistedCandidates: number;
  totalApplications: number;
  conversionRate: string;
}

export interface ApplicationsOverTimePoint {
  date: string;
  count: number;
  label: string;
}

export interface ScoreDistributionBucket {
  bucket: string;
  label: string;
  count: number;
  percentage: number;
}

export interface SkillDistributionItem {
  skill: string;
  demandCount: number;
  candidateCount: number;
  matchPercentage: number;
}

export interface InterviewPerformanceDimension {
  dimension: string;
  score: number;
  benchmark: number;
}

export interface HiringFunnelStage {
  stage: string;
  count: number;
  percentage: number;
  dropoff: number;
}

export interface RecruiterIntelligenceData {
  overview: RecruiterIntelligenceOverview;
  applicationsOverTime: ApplicationsOverTimePoint[];
  scoreDistribution: ScoreDistributionBucket[];
  skillDistribution: SkillDistributionItem[];
  interviewPerformance: InterviewPerformanceDimension[];
  hiringFunnel: HiringFunnelStage[];
  filtersApplied: RecruiterIntelligenceFilters;
}

export interface CandidateComparisonItem {
  candidateId: string;
  name: string;
  email: string;
  avatar?: string | null;
  headline?: string;
  jobTitle: string;
  resumeScore: number;
  codingScore: number;
  technicalScore: number;
  communicationScore: number;
  overallScore: number;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'NO_HIRE';
  matchedSkills: string[];
  missingSkills: string[];
  interviewStatus: string;
  latestInterviewId?: string | null;
  scheduledAt?: string | null;
  integritySignals: {
    totalEvents: number;
    cleanTimePercentage: number;
    integrityRating: 'HIGH' | 'MODERATE' | 'REVIEW_RECOMMENDED';
  };
}

export interface CandidateComparisonResponse {
  targetJob: {
    id: string;
    title: string;
    requiredSkills: string[];
  } | null;
  candidates: CandidateComparisonItem[];
}

export interface CandidatePoolItem {
  candidateId: string;
  name: string;
  email: string;
  avatar?: string | null;
  headline: string;
  jobId: string;
  jobTitle: string;
  applicationStatus: string;
  matchScore: number;
  interviewStatus: string;
}
