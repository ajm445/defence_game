import { Router } from 'express';
import { requireAdmin } from '../../middleware/adminAuth';
import adminAuthRouter from './adminAuthRouter';
import adminPlayersRouter from './adminPlayersRouter';
import adminBanRouter from './adminBanRouter';
import adminStatsRouter from './adminStatsRouter';
import adminFeedbackRouter from './adminFeedbackRouter';
import adminMaintenanceRouter from './adminMaintenanceRouter';

const router = Router();

// 인증 라우터 (login, verify는 공개 엔드포인트이므로 미들웨어 없이 마운트)
router.use('/auth', adminAuthRouter);

// 이하 모든 라우터는 requireAdmin 미들웨어 필수
router.use('/players', requireAdmin, adminPlayersRouter);
router.use('/bans', requireAdmin, adminBanRouter);
router.use('/stats', requireAdmin, adminStatsRouter);
router.use('/feedback', requireAdmin, adminFeedbackRouter);
router.use('/maintenance', requireAdmin, adminMaintenanceRouter);

export default router;
