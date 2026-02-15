import { Router, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/adminAuth';
import {
  getMaintenanceState,
  activateMaintenance,
  deactivateMaintenance,
} from '../../state/maintenance';

const router = Router();

// GET /api/admin/maintenance/status - 점검 상태 조회
router.get('/status', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getMaintenanceState());
});

// POST /api/admin/maintenance/activate - 점검 모드 활성화
router.post('/activate', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { minutes, message } = req.body;

  if (typeof minutes !== 'number' || minutes < 0 || minutes > 120) {
    return res.status(400).json({ error: '시간은 0~120분 사이여야 합니다.' });
  }

  const maintenanceMessage = typeof message === 'string' && message.trim()
    ? message.trim()
    : '서버 점검이 예정되어 있습니다.';

  activateMaintenance(minutes, maintenanceMessage);
  console.log(`[Maintenance] 점검 모드 활성화 - ${minutes}분 후 종료 예정, 메시지: ${maintenanceMessage}`);

  res.json({ success: true, state: getMaintenanceState() });
});

// POST /api/admin/maintenance/deactivate - 점검 모드 해제
router.post('/deactivate', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  deactivateMaintenance();
  console.log('[Maintenance] 점검 모드 해제');

  res.json({ success: true, state: getMaintenanceState() });
});

export default router;
