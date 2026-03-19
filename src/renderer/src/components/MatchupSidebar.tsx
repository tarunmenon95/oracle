import type { Recommendation, MatchupDetail } from '../../../preload/index'
import { championSplash, championIcon, nameToInternalId } from '../utils/ddragon'
import { wrColor, goldColor, lkrColor, confidenceColor, getConfidence, formatNumber } from '../utils/matchup-colors'

type Props = {
  recommendation: Recommendation | null
}

export function MatchupSidebar({ recommendation }: Props) {
  if (!recommendation) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        animation: 'fadeIn 0.3s ease'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: '12px' }}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        <span style={{
          color: 'var(--text-muted)',
          fontSize: '12px',
          textAlign: 'center',
          lineHeight: 1.6
        }}>
          Click a recommendation to see matchup details
        </span>
      </div>
    )
  }

  const rec = recommendation
  const internalId = rec.championInternalId || nameToInternalId(rec.championName)
  const confidence = getConfidence(rec)
  const totalGames = rec.matchups.reduce((sum, m) => sum + m.gamesPlayed, 0)

  return (
    <div style={{ animation: 'slideInRight 0.3s ease' }}>
      {/* Champion splash header */}
      <div style={{
        position: 'relative',
        height: 160,
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${championSplash(internalId)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          filter: 'brightness(0.4) saturate(0.9)'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(12,14,36,0.3) 0%, rgba(12,14,36,0.95) 100%)'
        }} />

        <div style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '16px 20px',
          gap: '14px'
        }}>
          <img
            src={rec.championIcon || championIcon(internalId)}
            alt={rec.championName}
            width={56}
            height={56}
            style={{
              borderRadius: '12px',
              border: '2px solid var(--accent-gold)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>
              {rec.championName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '20px',
                fontWeight: 800,
                color: wrColor(rec.score)
              }}>
                {rec.score.toFixed(1)}%
              </span>
              <ConfidenceMeter confidence={confidence} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div style={{
        display: 'flex',
        gap: '1px',
        background: 'var(--border)',
        margin: '0'
      }}>
        <StatCell label="Matchups" value={String(rec.matchups.length)} />
        <StatCell label="Total Games" value={formatNumber(totalGames)} />
        <StatCell label="Confidence" value={confidence.toUpperCase()} color={confidenceColor(confidence)} />
      </div>

      {/* Matchup details */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '12px'
        }}>
          Matchup Breakdown
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rec.matchups.map((m, i) => (
            <MatchupRow key={m.enemyChampionId} matchup={m} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MatchupRow({ matchup, delay }: { matchup: MatchupDetail; delay: number }) {
  const enemyId = matchup.enemyInternalId || nameToInternalId(matchup.enemyChampionName)
  const gold = matchup.goldAdv15
  const lkr = matchup.laneKillRate

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: 'var(--bg-card)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      animation: `slideUp 0.25s ease ${delay}s both`
    }}>
      <img
        src={championIcon(enemyId)}
        alt={matchup.enemyChampionName}
        width={36}
        height={36}
        style={{ borderRadius: '8px', border: '1px solid var(--border-light)', flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {matchup.enemyChampionName}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatPill label="WR" value={`${matchup.winRate.toFixed(1)}%`} color={wrColor(matchup.winRate)} />
          {gold != null && (
            <StatPill label="Gold@15" value={`${gold >= 0 ? '+' : ''}${Math.round(gold)}`} color={goldColor(gold)} />
          )}
          {lkr != null && (
            <StatPill label="LKR" value={`${lkr.toFixed(1)}%`} color={lkrColor(lkr)} />
          )}
        </div>
      </div>

      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        flexShrink: 0,
        textAlign: 'right'
      }}>
        {formatNumber(matchup.gamesPlayed)}
        <br />
        <span style={{ fontSize: '8px', letterSpacing: '0.5px' }}>GAMES</span>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      fontSize: '10px'
    }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: 1,
      padding: '10px 12px',
      background: 'var(--bg-surface)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: color || 'var(--text-primary)', marginBottom: '2px' }}>
        {value}
      </div>
      <div style={{ fontSize: '8px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function ConfidenceMeter({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const bars = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1
  const color = confidenceColor(confidence)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            width: 4,
            height: 6 + i * 3,
            borderRadius: 1,
            background: i <= bars ? color : 'var(--border)',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>
      <span style={{ fontSize: '9px', fontWeight: 700, color, letterSpacing: '0.5px' }}>
        {confidence.toUpperCase()}
      </span>
    </div>
  )
}

