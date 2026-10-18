'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/admin/login', { email, password });
      const { token, user } = res.data as { token: string; user: User };
      setSession(token, user);
      router.replace('/admin');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Admin login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', color: '#e2e8f0' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#111827', border: '1px solid #334155', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 12, background: '#f97316' }}>🚛</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 24 }}>RoadLifter</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Operator access</div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 10px', fontSize: 32 }}>Admin sign in</h1>
        <p style={{ margin: '0 0 24px', color: '#94a3b8' }}>Review driver applications and manage verification.</p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          {error && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca' }}>
              ⚠️ {error}
            </div>
          )}

          <div>
            <label htmlFor="admin-email" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Admin email</label>
            <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0' }} />
          </div>

          <div>
            <label htmlFor="admin-password" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0' }} />
          </div>

          <button type="submit" disabled={isLoading} style={{ padding: '12px 16px', border: 'none', borderRadius: 10, background: '#f97316', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isLoading ? 'Signing in…' : 'Continue to dashboard'}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link href="/login" style={{ color: '#fbbf24', textDecoration: 'none' }}>Back to user login</Link>
        </div>
      </div>
    </div>
  );
}
