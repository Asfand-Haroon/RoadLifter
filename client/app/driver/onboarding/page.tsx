'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { DriverVerificationForm } from '@/types';

export default function DriverOnboardingPage() {
  const router = useRouter();
  const { user, updateUser, fetchMe, logout, initFromStorage } = useAuthStore();
  const [formData, setFormData] = useState<DriverVerificationForm>({
    legal_name: '',
    cnic_number: '',
    vehicle_number: '',
    license_number: '',
    license_expiry: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (user?.profile_completed && user.verification_status === 'VERIFIED') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const isPendingReview = Boolean(
    user?.profile_completed && user.verification_status !== 'VERIFIED' && user.verification_status !== 'REJECTED'
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoToDashboard = async () => {
    setError('');
    await fetchMe();
    const latestUser = useAuthStore.getState().user;
    if (latestUser?.profile_completed && latestUser.verification_status === 'VERIFIED') {
      router.push('/dashboard');
    } else if (latestUser?.profile_completed) {
      setError('Your verification is still under review. We will notify you when a decision is made.');
    } else {
      setError('Your driver profile has not been completed yet. Please fill out the form below.');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Basic validation
    if (!formData.legal_name.trim()) {
      setError('Legal name is required');
      setSubmitting(false);
      return;
    }
    if (!formData.cnic_number.trim()) {
      setError('CNIC number is required');
      setSubmitting(false);
      return;
    }
    if (!formData.vehicle_number.trim()) {
      setError('Vehicle number is required');
      setSubmitting(false);
      return;
    }
    if (!formData.license_number.trim()) {
      setError('License number is required');
      setSubmitting(false);
      return;
    }
    if (!formData.license_expiry) {
      setError('License expiry date is required');
      setSubmitting(false);
      return;
    }

    try {
      const response = await api.post('/drivers/complete-profile', formData);
      
      // Update user in store
      if (response.data.user) {
        updateUser(response.data.user);
      }

    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Failed to complete profile. Please try again.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (isPendingReview) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <h1 className="auth-title">Verification in review</h1>
          <p className="auth-subtitle">
            Your details were submitted. You can use driver features after your profile is approved.
          </p>
          <button type="button" className="btn btn-ghost w-full" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚛</div>
          <h1 className="auth-title">Complete Your Profile</h1>
          <p className="auth-subtitle">
            Please provide your verification information to start accepting loads
          </p>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Legal Name *</label>
            <input
              className="form-input"
              type="text"
              name="legal_name"
              value={formData.legal_name}
              onChange={handleChange}
              placeholder="Enter your full legal name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">CNIC Number *</label>
            <input
              className="form-input"
              type="text"
              name="cnic_number"
              value={formData.cnic_number}
              onChange={handleChange}
              placeholder="XXXXX-XXXXXXX-X"
              required
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Your national ID number for identity verification
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Vehicle Number *</label>
            <input
              className="form-input"
              type="text"
              name="vehicle_number"
              value={formData.vehicle_number}
              onChange={handleChange}
              placeholder="ABC-1234"
              required
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Your truck&apos;s license plate number
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Driver License Number *</label>
            <input
              className="form-input"
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              placeholder="Enter your license number"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">License Expiry Date *</label>
            <input
              className="form-input"
              type="date"
              name="license_expiry"
              value={formData.license_expiry}
              onChange={handleChange}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ 
            padding: '12px 16px', 
            background: 'rgba(59,130,246,0.1)', 
            border: '1px solid rgba(59,130,246,0.2)', 
            borderRadius: 'var(--radius-md)',
            marginBottom: 16 
          }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', marginBottom: 4 }}>
              🔒 Reviewed by RoadLifter
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              These details are reviewed by the RoadLifter operations team and are not shown on public profiles.
            </p>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Processing...
              </>
            ) : 'Complete Profile & Continue'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Already completed?{' '}
            <button 
              type="button" 
              onClick={handleGoToDashboard}
              style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Go to Dashboard
            </button>
          </p>

          <button
            type="button"
            onClick={handleLogout}
            style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Sign out &amp; use another account
          </button>
        </div>
      </div>
    </div>
  );
}
