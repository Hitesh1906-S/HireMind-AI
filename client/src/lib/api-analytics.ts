import { apiClient } from './api-client';
import {
  RecruiterIntelligenceData,
  RecruiterIntelligenceFilters,
  CandidateComparisonResponse,
  CandidatePoolItem,
} from '@/types/analytics';

export class AnalyticsApi {
  /**
   * Fetch complete recruiter intelligence analytics with dynamic filters
   */
  static async getIntelligence(
    filters: RecruiterIntelligenceFilters = {}
  ): Promise<RecruiterIntelligenceData> {
    const params = new URLSearchParams();
    if (filters.jobId && filters.jobId !== 'ALL') params.append('jobId', filters.jobId);
    if (filters.dateRange) params.append('dateRange', filters.dateRange);
    if (filters.interviewStatus && filters.interviewStatus !== 'ALL') {
      params.append('interviewStatus', filters.interviewStatus);
    }
    if (filters.minScore !== undefined && filters.minScore > 0) {
      params.append('minScore', String(filters.minScore));
    }
    if (filters.maxScore !== undefined && filters.maxScore < 100) {
      params.append('maxScore', String(filters.maxScore));
    }

    const queryString = params.toString();
    const url = `/analytics/intelligence${queryString ? `?${queryString}` : ''}`;
    const res = await apiClient.get<{
      success: boolean;
      data: RecruiterIntelligenceData;
    }>(url);
    return res.data.data;
  }

  /**
   * Get candidate pool for comparison selector
   */
  static async getCandidatePool(jobId?: string): Promise<CandidatePoolItem[]> {
    const params = new URLSearchParams();
    if (jobId && jobId !== 'ALL') params.append('jobId', jobId);
    const queryString = params.toString();
    const res = await apiClient.get<{
      success: boolean;
      data: { candidates: CandidatePoolItem[] };
    }>(`/analytics/candidates${queryString ? `?${queryString}` : ''}`);
    return res.data.data.candidates;
  }

  /**
   * Compare 2 to 4 candidates side-by-side
   */
  static async compareCandidates(
    candidateIds: string[],
    jobId?: string
  ): Promise<CandidateComparisonResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: CandidateComparisonResponse;
    }>('/analytics/compare', {
      candidateIds,
      jobId: jobId && jobId !== 'ALL' ? jobId : undefined,
    });
    return res.data.data;
  }
}

