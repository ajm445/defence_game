import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET 환경 변수 필수!');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.warn('[Security] JWT_SECRET 미설정 - 개발 환경 기본값 사용');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-default-jwt-secret-key';

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  role: 'admin' | 'super_admin';
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

// JWT 토큰 생성
export function generateAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '24h' });
}

// JWT 토큰 검증
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

// 관리자 인증 미들웨어
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  const token = authHeader.substring(7);
  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }

  req.admin = payload;
  next();
}

// Super Admin 권한 체크 미들웨어
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin 권한이 필요합니다.' });
  }

  next();
}
