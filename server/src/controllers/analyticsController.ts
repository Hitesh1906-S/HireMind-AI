import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { AnalyticsService, RecruiterIntelligenceFilters } from '../services/analyticsService.js';
import { ApiError } from '../utils/apiError.js';
import { USER_ROLES } from '../constants/roles.js';

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/recruiter
   * Also supports intelligence query filters: ?jobId=&dateRange=&interviewStatus=&minScore=&maxScore=
   */
  static getRecruiterAnalytics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const recruiterId = req.user.role === USER_ROLES.ADMIN ? undefined : req.user.id;

    const filters: RecruiterIntelligenceFilters = {
      jobId: req.query.jobId ? String(req.query.jobId) : undefined,
      dateRange: req.query.dateRange as any,
      interviewStatus: req.query.interviewStatus ? String(req.query.interviewStatus) : undefined,
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
      maxScore: req.query.maxScore ? Number(req.query.maxScore) : undefined,
    };

    const intelligence = await AnalyticsService.getRecruiterIntelligence(recruiterId, filters);

    return ApiResponse.success({
      res,
      message: 'Recruiter intelligence analytics retrieved successfully',
      data: intelligence,
    });
  });

  /**
   * GET /api/v1/analytics/intelligence
   * Explicit endpoint for intelligence dashboard data
   */
  static getRecruiterIntelligence = AnalyticsController.getRecruiterAnalytics;

  /**
   * GET /api/v1/analytics/candidates
   * Retrieve list of candidate options for comparison selector
   */
  static getCandidatesPool = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const recruiterId = req.user.role === USER_ROLES.ADMIN ? undefined : req.user.id;
    const jobId = req.query.jobId ? String(req.query.jobId) : undefined;

    const candidates = await AnalyticsService.getCandidatePool(recruiterId, jobId);

    return ApiResponse.success({
      res,
      message: 'Candidate pool retrieved successfully',
      data: { candidates },
    });
  });

  /**
   * POST /api/v1/analytics/compare
   * Side-by-side comparative analysis of 2 to 4 candidates
   */
  static compareCandidates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const { candidateIds, jobId } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
      throw ApiError.badRequest('candidateIds must be an array of at least 2 candidate IDs');
    }

    if (candidateIds.length > 4) {
      throw ApiError.badRequest('Maximum 4 candidates can be compared simultaneously');
    }

    const recruiterId = req.user.role === USER_ROLES.ADMIN ? undefined : req.user.id;
    const comparison = await AnalyticsService.compareCandidates(
      recruiterId,
      candidateIds,
      jobId
    );

    return ApiResponse.success({
      res,
      message: 'Candidate side-by-side comparison generated successfully',
      data: comparison,
    });
  });

  static getCandidateAnalytics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const analytics = await AnalyticsService.getCandidateAnalytics(req.user.id);
    return ApiResponse.success({
      res,
      message: 'Candidate analytics retrieved successfully',
      data: { analytics },
    });
  });

  static getAdminAnalytics = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');

    const analytics = await AnalyticsService.getAdminAnalytics();
    return ApiResponse.success({
      res,
      message: 'Admin platform analytics retrieved successfully',
      data: { analytics },
    });
  });
}
