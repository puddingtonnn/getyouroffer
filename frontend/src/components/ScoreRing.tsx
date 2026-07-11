// Animated match-score ring (dashboard mockup 1h, Электрик palette).
// circumference = 2π·42 ≈ 264, matching the ringin keyframe base.
const CIRCUMFERENCE = 264

export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const offset = CIRCUMFERENCE * (1 - clamped / 100)
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(16,18,22,.1)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{
            ['--ring-offset' as string]: offset,
            animation: 'ringin 1.6s .2s cubic-bezier(.2,.8,.2,1) both',
          }}
        />
      </svg>
      <span className="display absolute inset-0 flex items-center justify-center" style={{ fontSize: size * 0.3 }}>
        {clamped}
      </span>
    </div>
  )
}
