import { Router } from 'express';
import adminAuthRouter from './adminAuthRouter';
import adminPlayersRouter from './adminPlayersRouter';
import adminBanRouter from './adminBanRouter';
import adminStatsRouter from './adminStatsRouter';
import adminFeedbackRouter from './adminFeedbackRouter';
import adminMaintenanceRouter from './adminMaintenanceRouter';

const router = Router();

// 인증 라우터
router.use('/auth', adminAuthRouter);

// 플레이어 관리 라우터
router.use('/players', adminPlayersRouter);

// 밴 관리 라우터
router.use('/bans', adminBanRouter);

// 통계 라우터
router.use('/stats', adminStatsRouter);

// 피드백 관리 라우터
router.use('/feedback', adminFeedbackRouter);

// 점검 관리 라우터
router.use('/maintenance', adminMaintenanceRouter);

export default router;
