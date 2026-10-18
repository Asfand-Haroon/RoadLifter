'use client';
import { create } from 'zustand';
import { getApps } from '@firebase/app';
import { getAuth, signOut } from '@firebase/auth';
import api from '@/lib/api';
import { User, AuthState } from '@/types';

interface AuthStore extends AuthState {
  setSession: (token: string, user: User) => void;
  logout: () => void;
  initFromStorage: () => void;
  fetchMe: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  fetchMe: async () => {
    try {
      const token = localStorage.getItem('rl_token');
      if (!token) return;
      const res = await api.get('/auth/me');
      if (res.data?.user) {
        const user = res.data.user;
        localStorage.setItem('rl_user', JSON.stringify(user));
        set({ user, isAuthenticated: true });
      }
    } catch {
      // If 401 or token invalid, auth interceptor handles logout
    }
  },

  initFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const token = localStorage.getItem('rl_token');
      const userStr = localStorage.getItem('rl_user');
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        if (user.role !== 'ADMIN' && user.auth_provider !== 'google') {
          localStorage.removeItem('rl_token');
          localStorage.removeItem('rl_user');
          set({ user: null, token: null, isAuthenticated: false });
          return;
        }
        set({ user, token, isAuthenticated: true });
        // Refresh latest user status from backend
        get().fetchMe();
      }
    } catch {
      localStorage.removeItem('rl_token');
      localStorage.removeItem('rl_user');
    }
  },

  setSession: (token, user) => {
    localStorage.setItem('rl_token', token);
    localStorage.setItem('rl_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('rl_token');
    localStorage.removeItem('rl_user');
    set({ user: null, token: null, isAuthenticated: false });
    const app = getApps().find((firebaseApp) => firebaseApp.name === 'roadlifter');
    if (app) {
      void signOut(getAuth(app)).catch((error: unknown) => {
        console.error('Firebase sign-out failed:', error);
      });
    }
  },

  updateUser: (partial) => {
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, ...partial };
      localStorage.setItem('rl_user', JSON.stringify(user));
      return { user };
    });
  },
}));
