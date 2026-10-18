'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { UserRole } from '@/types';

interface RatingModalProps {
  cargoId: string;
  cargoTitle: string;
  rateeName: string;
  rateeRole: UserRole;
  onClose: () => void;
  onSubmitted: (rating: number) => void;
}

export default function RatingModal({
  cargoId,
  cargoTitle,
  rateeName,
  rateeRole,
  onClose,
  onSubmitted,
}: RatingModalProps) {
  const [stars, setStars] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [onTime, setOnTime] = useState(true);
  const [itemsIntact, setItemsIntact] = useState(true);
  const [paidAgreed, setPaidAgreed] = useState(true);
  const [accurateDescription, setAccurateDescription] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ratingDriver = rateeRole === 'DRIVER';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/ratings', {
        cargo_id: cargoId,
        rating: stars,
        on_time: onTime,
        items_intact: itemsIntact,
        paid_agreed: paidAgreed,
        accurate_description: accurateDescription,
        comment,
      });
      onSubmitted(stars);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Failed to submit rating'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Rate {ratingDriver ? 'driver' : 'shipper'}</h2>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
          How was your experience with <strong style={{ color: 'var(--color-text)' }}>{rateeName}</strong> on{' '}
          <strong style={{ color: 'var(--color-text)' }}>{cargoTitle}</strong>?
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="auth-error">⚠️ {error}</div>}

          <div className="star-picker" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`star-picker-btn ${(hover || stars) >= n ? 'active' : ''}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
            <span className="star-picker-label">{stars} / 5</span>
          </div>

          <div className="rating-aspects">
            {ratingDriver ? (
              <>
                <label className="rating-aspect">
                  <input type="checkbox" checked={onTime} onChange={(e) => setOnTime(e.target.checked)} />
                  Arrived on time
                </label>
                <label className="rating-aspect">
                  <input type="checkbox" checked={itemsIntact} onChange={(e) => setItemsIntact(e.target.checked)} />
                  Cargo arrived intact
                </label>
              </>
            ) : (
              <>
                <label className="rating-aspect">
                  <input type="checkbox" checked={paidAgreed} onChange={(e) => setPaidAgreed(e.target.checked)} />
                  Paid as agreed
                </label>
                <label className="rating-aspect">
                  <input type="checkbox" checked={accurateDescription} onChange={(e) => setAccurateDescription(e.target.checked)} />
                  Accurate load description
                </label>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Comment (optional)</label>
            <textarea
              className="form-input"
              placeholder="Share details about this delivery…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ minHeight: 80 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Submitting...</>
              ) : 'Submit rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
