import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = Router();

router.use(authenticate);

// Recruiter Intelligence & Analytics
router.get('/recruiter', AnalyticsController.getRecruiterAnalytics);
router.get('/intelligence', AnalyticsController.getRecruiterIntelligence);
router.get('/candidates', AnalyticsController.getCandidatesPool);
router.post('/compare', AnalyticsController.compareCandidates);

// Candidate & Admin Analytics
router.get('/candidate', AnalyticsController.getCandidateAnalytics);
router.get('/admin', AnalyticsController.getAdminAnalytics);

export const analyticsRoutes = router;
