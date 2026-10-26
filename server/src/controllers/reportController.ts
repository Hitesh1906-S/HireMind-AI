import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';

export class ReportController {
  /**
   * GET /api/v1/reports/interviews/:interviewId
   * Retrieve JSON preview of 15-section candidate interview report
   */
  static async getInterviewReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { interviewId } = req.params;
      if (!interviewId) {
        throw ApiError.badRequest('Interview ID parameter is required');
      }

      const requesterId = req.user?.id;
      const reportData = await ReportService.getReportDataByInterview(
        interviewId,
        requesterId
      );

      return ApiResponse.success({
        res,
        data: reportData,
        message: 'Candidate interview evaluation report retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/interviews/:interviewId/pdf
   * Generates and downloads the professional PDF evaluation dossier
   */
  static async downloadInterviewReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { interviewId } = req.params;
      if (!interviewId) {
        throw ApiError.badRequest('Interview ID parameter is required');
      }

      const requesterId = req.user?.id;
      const reportData = await ReportService.getReportDataByInterview(
        interviewId,
        requesterId
      );

      const pdfBuffer = await ReportService.generatePdf(reportData);

      const safeName = reportData.candidate.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `HireMind-Report-${safeName}-${reportData.reportId}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/applications/:applicationId
   * Retrieve JSON preview by applicationId
   */
  static async getApplicationReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      if (!applicationId) {
        throw ApiError.badRequest('Application ID parameter is required');
      }

      const requesterId = req.user?.id;
      const reportData = await ReportService.getReportDataByApplication(
        applicationId,
        requesterId
      );

      return ApiResponse.success({
        res,
        data: reportData,
        message: 'Candidate application evaluation report retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reports/applications/:applicationId/pdf
   * Generates and downloads the professional PDF evaluation dossier by applicationId
   */
  static async downloadApplicationReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      if (!applicationId) {
        throw ApiError.badRequest('Application ID parameter is required');
      }

      const requesterId = req.user?.id;
      const reportData = await ReportService.getReportDataByApplication(
        applicationId,
        requesterId
      );

      const pdfBuffer = await ReportService.generatePdf(reportData);

      const safeName = reportData.candidate.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `HireMind-Report-${safeName}-${reportData.reportId}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      return res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}
