'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { User } from '@/types';
import { googleProvider, getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { signInWithPopup, User as FirebaseUser } from '@firebase/auth';

type Role = 'DRIVER' | 'SENDER';
type Mode = 'login' | 'register';

const getAuthError = (error: unknown) => {
  const apiError = (error as { response?: { data?: { error?: string; blacklist_reason?: string } } })
    ?.response?.data;
  const message = apiError?.blacklist_reason || apiError?.error;
  if (message) return message;
  if (error instanceof Error) return error.message;
  return 'Google sign-in failed. Please try again.';
};

export default function GoogleAuthEntry({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const initFromStorage = useAuthStore((state) => state.initFromStorage);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(searchParams.get('role') === 'DRIVER' ? 'DRIVER' : 'SENDER');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === 'ADMIN') {
      router.replace('/admin');
    } else if (user.role === 'DRIVER' && (!user.profile_completed || user.verification_status !== 'VERIFIED')) {
      router.replace('/driver/onboarding');
    } else {
      router.replace('/home');
    }
  }, [isAuthenticated, user, router]);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), googleProvider);
      const idToken = await credential.user.getIdToken();
      const response = await api.post('/auth/google', { idToken });

      if (response.data.needs_profile) {
        setFirebaseUser(credential.user);
        setName(response.data.profile.name || credential.user.displayName || '');
        setEmail(response.data.profile.email || credential.user.email || '');
        setNeedsProfile(true);
        return;
      }

      const accountUser = response.data.user as User;
      setSession(response.data.token, accountUser);
      if (accountUser.role === 'DRIVER' && (!accountUser.profile_completed || accountUser.verification_status !== 'VERIFIED')) {
        router.replace('/driver/onboarding');
      } else {
        router.replace('/home');
      }
    } catch (authError: unknown) {
      setError(getAuthError(authError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) {
      setError('Sign in with Google before completing your profile.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await api.post('/auth/google/complete-profile', {
        idToken,
        role,
        name,
        phone,
      });
      const accountUser = response.data.user as User;
      setSession(response.data.token, accountUser);
      if (accountUser.role === 'DRIVER') {
        router.replace('/driver/onboarding');
      } else {
        router.replace('/home');
      }
    } catch (profileError: unknown) {
      setError(getAuthError(profileError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div className="logo-icon">🚛</div>
          <span className="logo-text">RoadLifter</span>
        </div>

        <h1 className="auth-title">
          {needsProfile ? 'Complete your account' : mode === 'register' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="auth-subtitle">
          {needsProfile
            ? 'Choose how you’ll use RoadLifter and add your contact details.'
            : 'Sign in or create an account securely with your Google account.'}
        </p>

        {error && <div className="auth-error" role="alert">⚠️ {error}</div>}

        {!needsProfile ? (
          <>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              style={{ marginTop: 8 }}
            >
              {isLoading ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Connecting to Google...</>
              ) : (
                <><span aria-hidden="true" style={{ fontWeight: 800, marginRight: 10 }}>G</span> Continue with Google</>
              )}
            </button>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              {mode === 'register' ? 'Already have an account? ' : 'New to RoadLifter? '}
              <Link href={mode === 'register' ? '/login' : '/register'} className="auth-link">
                {mode === 'register' ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleCompleteProfile}>
            <div className="form-group">
              <label className="form-label">I am a...</label>
              <div className="role-selector">
                <button
                  type="button"
                  className={`role-option ${role === 'DRIVER' ? 'selected' : ''}`}
                  aria-pressed={role === 'DRIVER'}
                  onClick={() => setRole('DRIVER')}
                >
                  <span className="role-icon">🚛</span>
                  <span className="role-label">Driver</span>
                  <span className="role-desc">I carry freight and want to find loads</span>
                </button>
                <button
                  type="button"
                  className={`role-option ${role === 'SENDER' ? 'selected' : ''}`}
                  aria-pressed={role === 'SENDER'}
                  onClick={() => setRole('SENDER')}
                >
                  <span className="role-icon">📦</span>
                  <span className="role-label">Shipper</span>
                  <span className="role-desc">I need to ship cargo and find trucks</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="google-name">Full name</label>
              <input id="google-name" type="text" className="form-input" value={name}
                onChange={(event) => setName(event.target.value)} maxLength={100} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="google-email">Google email</label>
              <input id="google-email" type="email" className="form-input" value={email} readOnly />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="google-phone">Phone (optional)</label>
              <input id="google-phone" type="tel" className="form-input" value={phone}
                onChange={(event) => setPhone(event.target.value)} maxLength={20} />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : `Continue as ${role === 'DRIVER' ? 'Driver' : 'Shipper'}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
