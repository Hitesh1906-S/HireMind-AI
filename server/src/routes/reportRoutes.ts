import { Router } from 'express';
import { ReportController } from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { USER_ROLES } from '../constants/roles.js';

const router = Router();

// Authentication required for all report routes
router.use(authenticate);

// Restricted to Recruiters and Admins for candidate intelligence dossiers
router.use(authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN));

// Report by Interview ID
router.get('/interviews/:interviewId', ReportController.getInterviewReport);
router.get('/interviews/:interviewId/pdf', ReportController.downloadInterviewReportPdf);

// Report by Application ID
router.get('/applications/:applicationId', ReportController.getApplicationReport);
router.get('/applications/:applicationId/pdf', ReportController.downloadApplicationReportPdf);

export const reportRoutes = router;
