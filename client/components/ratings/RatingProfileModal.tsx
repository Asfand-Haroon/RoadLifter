'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { RatingProfile } from '@/types';

interface RatingProfileModalProps {
  userId: string;
  onClose: () => void;
}

const pctBar = (pct: number) => (
  <div className="trust-bar-track">
    <div className="trust-bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);

export default function RatingProfileModal({ userId, onClose }: RatingProfileModalProps) {
  const [data, setData] = useState<RatingProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/ratings/user/${userId}`);
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError('Could not load rating profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const avg = data?.user?.rating_avg != null ? Number(data.user.rating_avg) : 0;
  const count = data?.user?.rating_count != null ? Number(data.user.rating_count) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Trust profile</h2>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="spinner" style={{ margin: '24px auto' }} />}
        {error && <div className="auth-error">⚠️ {error}</div>}

        {data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className="driver-avatar">{data.user.name?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{data.user.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {data.user.role === 'DRIVER' ? 'Driver' : 'Shipper'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-warning)' }}>
                  ★ {avg.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {count} review{count === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            <div className="trust-grid">
              <div className="trust-row">
                <span>On time</span>
                {pctBar(data.breakdown.on_time_pct)}
                <span>{data.breakdown.on_time_pct}%</span>
              </div>
              <div className="trust-row">
                <span>Items intact</span>
                {pctBar(data.breakdown.items_intact_pct)}
                <span>{data.breakdown.items_intact_pct}%</span>
              </div>
              <div className="trust-row">
                <span>Paid as agreed</span>
                {pctBar(data.breakdown.paid_agreed_pct)}
                <span>{data.breakdown.paid_agreed_pct}%</span>
              </div>
              <div className="trust-row">
                <span>Accurate description</span>
                {pctBar(data.breakdown.accurate_desc_pct)}
                <span>{data.breakdown.accurate_desc_pct}%</span>
              </div>
            </div>

            <h3 style={{ fontSize: '0.9375rem', margin: '20px 0 10px' }}>Recent reviews</h3>
            {data.reviews.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No reviews yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.reviews.map((r) => (
                <div key={r.id} className="review-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{r.rater_name || 'User'}</strong>
                    <span style={{ color: 'var(--color-warning)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.cargo_title && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.cargo_title}</div>
                  )}
                  {r.comment && <p style={{ fontSize: '0.875rem', marginTop: 4 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
