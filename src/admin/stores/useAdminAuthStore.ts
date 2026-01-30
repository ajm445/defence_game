import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminApi } from '../services/adminApi';
import type { AdminUser } from '../types/admin';

interface AdminAuthState {
  token: string | null;
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  verifyToken: () => Promise<boolean>;
  clearError: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await adminApi.login(username, password);
          adminApi.setToken(response.token);
          set({
            token: response.token,
            admin: response.admin,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : '로그인에 실패했습니다.',
            isLoading: false,
          });
          return false;
        }
      },

      logout: async () => {
        const { token } = get();
        if (token) {
          try {
            await adminApi.logout();
          } catch {
            // Ignore logout errors
          }
        }
        adminApi.setToken(null);
        set({
          token: null,
          admin: null,
          isAuthenticated: false,
        });
      },

      verifyToken: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }

        adminApi.setToken(token);
        set({ isLoading: true });

        try {
          const response = await adminApi.verifyToken();
          if (response.valid && response.admin) {
            set({
              admin: response.admin,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            adminApi.setToken(null);
            set({
              token: null,
              admin: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return false;
          }
        } catch {
          adminApi.setToken(null);
          set({
            token: null,
            admin: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
