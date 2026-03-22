import { useState } from 'react'
import type { Recommendation, MatchupDetail } from '../../../preload/index'
import { championSplash, championIcon, nameToInternalId } from '../utils/ddragon'
import { wrColor, goldColor, lkrColor, getConfidence } from '../utils/matchup-colors'

function handleKeyDown(callback: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      callback()
    }
  }
}

function ImgWithFallback({ src, alt, size, style }: { src: string; alt: string; size: number; style?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <ChampionImgFallback name={alt} size={size} />
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ flexShrink: 0, ...style }}
      onError={() => setFailed(true)}
    />
  )
}

function ChampionImgFallback({ name, size }: { name: string; size: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size > 40 ? '14px' : '10px',
      background: 'var(--bg-surface)',
      border: '1.5px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(size * 0.3, 12),
      fontWeight: 700,
      color: 'var(--text-muted)',
      flexShrink: 0
    }}>
      {name.charAt(0)}
    </div>
  )
}

type Props = {
  recommendations: Recommendation[]
  selectedRec: Recommendation | null
  onSelectRec: (rec: Recommendation | null) => void
  hasEnemyPicks?: boolean
}

export function Recommendations({ recommendations, selectedRec, onSelectRec, hasEnemyPicks }: Props) {
  if (recommendations.length === 0) {
    const noPool = hasEnemyPicks
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        fontSize: '14px',
        animation: 'fadeIn 0.4s ease',
        gap: '12px'
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          {noPool ? (
            <>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </>
          )}
        </svg>
        <span>{noPool
          ? 'No champions in your pool for this lane'
          : 'Waiting for enemy picks to generate recommendations...'
        }</span>
        {noPool && (
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            Add champions via Settings, or sync your pool from op.gg
          </span>
        )}
      </div>
    )
  }

  const [top, ...rest] = recommendations

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--accent-gold)',
        letterSpacing: '2px',
        marginBottom: '16px',
        textTransform: 'uppercase'
      }}>
        Recommended Picks
      </div>

      {/* Featured #1 pick */}
      <FeaturedCard
        rec={top}
        isSelected={selectedRec?.championName === top.championName}
        onSelect={() => onSelectRec(selectedRec?.championName === top.championName ? null : top)}
      />

      {/* Remaining picks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
        {rest.map((rec, i) => (
          <CompactCard
            key={rec.championId || rec.championName}
            rec={rec}
            rank={i + 2}
            delay={i * 0.06}
            isSelected={selectedRec?.championName === rec.championName}
            onSelect={() => onSelectRec(selectedRec?.championName === rec.championName ? null : rec)}
          />
        ))}
      </div>
    </div>
  )
}

function FeaturedCard({ rec, isSelected, onSelect }: { rec: Recommendation; isSelected: boolean; onSelect: () => void }) {
  const internalId = rec.championInternalId || nameToInternalId(rec.championName)
  const confidence = getConfidence(rec)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown(onSelect)}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: isSelected ? '1.5px solid var(--accent-gold)' : '1px solid var(--border)',
        animation: 'slideUp 0.4s ease',
        boxShadow: isSelected
          ? '0 0 24px rgba(200, 170, 110, 0.2)'
          : '0 4px 20px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s'
      }}
    >
      {/* Splash background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${championSplash(internalId)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 20%',
        filter: 'brightness(0.25) saturate(0.8)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right, rgba(6,7,20,0.9) 0%, rgba(6,7,20,0.4) 40%, rgba(6,7,20,0.85) 100%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: '20px 24px'
      }}>
        {/* Champion icon */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ImgWithFallback
            src={rec.championIcon || championIcon(internalId)}
            alt={rec.championName}
            size={72}
            style={{
              borderRadius: '14px',
              border: '2px solid var(--accent-gold)',
              boxShadow: '0 0 20px rgba(200, 170, 110, 0.25)'
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '8px'
          }}>
            {rec.championName}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {rec.matchups.map((m) => (
              <MatchupPill key={m.enemyChampionId} matchup={m} />
            ))}
          </div>
          {rec.personalGames >= 5 && (
            <PersonalStatsBadge rec={rec} />
          )}
        </div>

        {/* Score */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: wrColor(rec.score),
            lineHeight: 1
          }}>
            {rec.score.toFixed(1)}%
          </div>
          <ConfidenceBadge confidence={confidence} />
        </div>
      </div>
    </div>
  )
}

function CompactCard({ rec, rank, delay, isSelected, onSelect }: {
  rec: Recommendation; rank: number; delay: number; isSelected: boolean; onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const internalId = rec.championInternalId || nameToInternalId(rec.championName)
  const confidence = getConfidence(rec)
  const barWidth = Math.max(0, Math.min(100, (rec.score - 40) * (100 / 20)))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown(onSelect)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '12px 16px',
        background: isSelected ? 'var(--bg-card-hover)' : hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        border: isSelected ? '1.5px solid var(--accent-gold)' : '1px solid transparent',
        animation: `slideUp 0.3s ease ${delay}s both`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? '0 0 12px rgba(200, 170, 110, 0.1)' : 'none'
      }}
    >
      {/* Win rate bar background */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${barWidth}%`,
        background: `linear-gradient(to right, ${wrColor(rec.score)}08, ${wrColor(rec.score)}12)`,
        pointerEvents: 'none',
        transition: 'width 0.5s ease'
      }} />

      {/* Rank */}
      <div style={{
        width: 24,
        fontWeight: 700,
        fontSize: '14px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        position: 'relative',
        flexShrink: 0
      }}>
        {rank}
      </div>

      {/* Icon */}
      <ImgWithFallback
        src={rec.championIcon || championIcon(internalId)}
        alt={rec.championName}
        size={44}
        style={{
          borderRadius: '10px',
          border: '1.5px solid var(--border-light)',
          position: 'relative'
        }}
      />

      {/* Name + matchups */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{rec.championName}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
          {rec.matchups.map((m) => (
            <MatchupPill key={m.enemyChampionId} matchup={m} compact />
          ))}
        </div>
        {rec.personalGames >= 5 && (
          <div style={{ marginTop: '3px' }}>
            <PersonalStatsBadge rec={rec} compact />
          </div>
        )}
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative' }}>
        <div style={{ fontWeight: 700, fontSize: '18px', color: wrColor(rec.score) }}>
          {rec.score.toFixed(1)}%
        </div>
        <ConfidenceBadge confidence={confidence} small />
      </div>
    </div>
  )
}

function MatchupPill({ matchup, compact }: { matchup: MatchupDetail; compact?: boolean }) {
  const enemyId = matchup.enemyInternalId || nameToInternalId(matchup.enemyChampionName)
  const lkr = matchup.laneKillRate
  const gold = matchup.goldAdv15

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: compact ? '2px 7px' : '3px 8px',
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '6px',
      fontSize: compact ? '10px' : '11px',
      color: 'var(--text-secondary)',
      border: '1px solid rgba(255,255,255,0.04)'
    }}>
      <img
        src={championIcon(enemyId)}
        alt={matchup.enemyChampionName}
        width={compact ? 14 : 18}
        height={compact ? 14 : 18}
        style={{ borderRadius: '4px' }}
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0' }}
      />
      <span style={{ color: wrColor(matchup.winRate), fontWeight: 600 }}>
        {matchup.winRate.toFixed(1)}%
      </span>
      {gold != null && (
        <span style={{
          color: goldColor(gold),
          fontWeight: 600,
          fontSize: compact ? '9px' : '10px'
        }}
          title="Gold @ 15 min"
        >
          {gold >= 0 ? '+' : ''}{Math.round(gold)}g
        </span>
      )}
      {lkr != null && !compact && (
        <span style={{
          color: lkrColor(lkr),
          fontWeight: 500,
          fontSize: '10px',
          opacity: 0.85
        }}
          title="Lane Kill Rate"
        >
          {'\u2694'}{lkr.toFixed(1)}%
        </span>
      )}
      {!compact && (
        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          ({matchup.gamesPlayed})
        </span>
      )}
    </div>
  )
}

function PersonalStatsBadge({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  const wrGood = rec.personalWinRate != null && rec.personalWinRate >= 50
  const sep = <span style={{ color: 'var(--border-light)', margin: '0 1px' }}>·</span>

  return (
    <div
      title="Your personal stats on this champion"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '4px' : '6px',
        marginTop: compact ? 0 : '6px',
        fontSize: compact ? '9px' : '10px',
        fontWeight: 500,
        color: 'var(--text-muted)'
      }}
    >
      <span style={{
        fontSize: compact ? '8px' : '9px',
        fontWeight: 700,
        color: 'var(--accent-gold)',
        letterSpacing: '1px',
        textTransform: 'uppercase' as const
      }}>
        You
      </span>
      {rec.personalWinRate != null && (
        <>
          <span style={{ color: wrGood ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
            {rec.personalWinRate.toFixed(0)}% WR
          </span>
          {(rec.personalKda != null || !compact) && sep}
        </>
      )}
      {rec.personalKda != null && !compact && (
        <>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            {rec.personalKda.toFixed(1)} KDA
          </span>
          {sep}
        </>
      )}
      <span style={{ color: 'var(--text-muted)' }}>
        {rec.personalGames} games
      </span>
    </div>
  )
}

function ConfidenceBadge({ confidence, small }: { confidence: 'high' | 'medium' | 'low'; small?: boolean }) {
  const config = {
    high: { color: 'var(--accent-green)', label: 'HIGH', icon: '\u2713' },
    medium: { color: 'var(--accent-gold)', label: 'MED', icon: '\u25CB' },
    low: { color: 'var(--accent-red)', label: 'LOW', icon: '!' }
  }[confidence]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '3px',
      marginTop: '4px',
      fontSize: small ? '9px' : '10px',
      fontWeight: 700,
      color: config.color,
      letterSpacing: '0.5px'
    }}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}

