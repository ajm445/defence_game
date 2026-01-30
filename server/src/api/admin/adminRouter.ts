import { Router } from 'express';
import adminAuthRouter from './adminAuthRouter';
import adminPlayersRouter from './adminPlayersRouter';
import adminBanRouter from './adminBanRouter';
import adminStatsRouter from './adminStatsRouter';

const router = Router();

// 인증 라우터
router.use('/auth', adminAuthRouter);

// 플레이어 관리 라우터
router.use('/players', adminPlayersRouter);

// 밴 관리 라우터
router.use('/bans', adminBanRouter);

// 통계 라우터
router.use('/stats', adminStatsRouter);

export default router;
