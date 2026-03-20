import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 시크릿 (환경변수 또는 기본값)
const JWT_SECRET = process.env.JWT_SECRET || 'defence-game-jwt-secret-change-in-production';
const JWT_EXPIRY = '24h';
const JWT_GUEST_EXPIRY = '12h';

export interface JwtPayload {
  userId: string;
  isGuest: boolean;
}

// JWT 토큰 생성
export function generateToken(userId: string, isGuest: boolean): string {
  return jwt.sign(
    { userId, isGuest } as JwtPayload,
    JWT_SECRET,
    { expiresIn: isGuest ? JWT_GUEST_EXPIRY : JWT_EXPIRY }
  );
}

// JWT 토큰 검증
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Express 미들웨어: Authorization 헤더에서 JWT 검증
// req.userId에 인증된 사용자 ID를 설정
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '인증이 필요합니다.' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ success: false, error: '유효하지 않거나 만료된 토큰입니다.' });
    return;
  }

  // req에 userId 설정
  (req as any).userId = payload.userId;
  (req as any).isGuest = payload.isGuest;

  next();
}

// Express 미들웨어: 인증된 userId와 요청의 userId 일치 여부 확인
// requireAuth 뒤에 사용
export function requireSameUser(paramName: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUserId = (req as any).userId;
    const targetUserId = req.params[paramName] || req.body?.playerId || req.body?.userId;

    if (!targetUserId) {
      next();
      return;
    }

    if (authUserId !== targetUserId) {
      res.status(403).json({ success: false, error: '권한이 없습니다.' });
      return;
    }

    next();
  };
}
