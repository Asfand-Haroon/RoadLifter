'use client';

interface StarRatingProps {
  value?: number | string | null;
  count?: number | string | null;
  size?: 'sm' | 'md';
  showCount?: boolean;
  onClick?: () => void;
}

const parseNum = (n?: number | string | null) => {
  if (n === undefined || n === null || n === '') return 0;
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return Number.isFinite(v) ? v : 0;
};

export default function StarRating({
  value,
  count,
  size = 'sm',
  showCount = true,
  onClick,
}: StarRatingProps) {
  const avg = parseNum(value);
  const reviews = parseNum(count);
  const fontSize = size === 'md' ? '0.9375rem' : '0.8125rem';

  return (
    <button
      type="button"
      className="star-rating"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ fontSize, cursor: onClick ? 'pointer' : 'default' }}
      title={onClick ? 'View rating profile' : undefined}
    >
      <span className="star-rating-stars" aria-hidden>★</span>
      <span className="star-rating-value">{avg > 0 ? avg.toFixed(1) : '—'}</span>
      {showCount && (
        <span className="star-rating-count">
          ({reviews})
        </span>
      )}
    </button>
  );
}
