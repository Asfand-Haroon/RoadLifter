'use client';

import { Suspense } from 'react';
import GoogleAuthEntry from '@/components/auth/GoogleAuthEntry';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="loader"><div className="spinner" /></div></div>}>
      <GoogleAuthEntry mode="login" />
    </Suspense>
  );
}
