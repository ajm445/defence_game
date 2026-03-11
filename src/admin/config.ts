// 관리자 페이지 기본 경로 (환경변수로 설정, 기본값 'admin')
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || 'admin';

export const ADMIN_BASE = `/${ADMIN_PATH}`;
