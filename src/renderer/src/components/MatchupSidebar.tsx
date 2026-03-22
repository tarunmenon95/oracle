import { useState, useEffect } from 'react'
import type { Recommendation, MatchupDetail, MatchupBuildData } from '../../../preload/index'
import { championSplash, championIcon, nameToInternalId, getPatch } from '../utils/ddragon'
import { wrColor, goldColor, lkrColor, confidenceColor, getConfidence, formatNumber } from '../utils/matchup-colors'

type Props = {
  recommendation: Recommendation | null
  lane: string
  championName: string
}

export function MatchupSidebar({ recommendation, lane, championName }: Props) {
  const [selectedEnemy, setSelectedEnemy] = useState<string | null>(null)
  const [buildData, setBuildData] = useState<MatchupBuildData | null>(null)
  const [buildLoading, setBuildLoading] = useState(false)

  useEffect(() => {
    setBuildData(null)
    if (recommendation && recommendation.matchups.length > 0) {
      const mostPlayed = recommendation.matchups.reduce((best, m) =>
        m.gamesPlayed > best.gamesPlayed ? m : best
      )
      setSelectedEnemy(mostPlayed.enemyChampionName)
    } else {
      setSelectedEnemy(null)
    }
  }, [recommendation?.championName])

  useEffect(() => {
    if (!selectedEnemy || !championName || !lane) {
      setBuildData(null)
      return
    }
    setBuildLoading(true)
    setBuildData(null)
    window.api.getMatchupBuild(championName, selectedEnemy, lane)
      .then(setBuildData)
      .catch(() => setBuildData(null))
      .finally(() => setBuildLoading(false))
  }, [selectedEnemy, championName, lane])

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
            <MatchupRow
              key={m.enemyChampionId}
              matchup={m}
              delay={i * 0.05}
              isSelected={selectedEnemy === m.enemyChampionName}
              onClick={() => setSelectedEnemy(
                selectedEnemy === m.enemyChampionName ? null : m.enemyChampionName
              )}
            />
          ))}
        </div>
      </div>

      {/* Build section */}
      {selectedEnemy && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            height: 1,
            background: 'var(--border)',
            margin: '0 0 16px'
          }} />

          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Optimal Build vs {selectedEnemy}
          </div>

          {buildLoading ? (
            <LoadingSpinner />
          ) : buildData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <RuneWidget runes={buildData.runes} />
              <ItemsWidget items={buildData.items} />
            </div>
          ) : (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              padding: '12px 0'
            }}>
              No build data available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchupRow({ matchup, delay, isSelected, onClick }: {
  matchup: MatchupDetail
  delay: number
  isSelected: boolean
  onClick: () => void
}) {
  const enemyId = matchup.enemyInternalId || nameToInternalId(matchup.enemyChampionName)
  const gold = matchup.goldAdv15
  const lkr = matchup.laneKillRate

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        borderRadius: '8px',
        border: isSelected ? '1.5px solid var(--accent-gold)' : '1px solid var(--border)',
        animation: `slideUp 0.25s ease ${delay}s both`,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isSelected ? '0 0 10px rgba(200, 170, 110, 0.1)' : 'none'
      }}
    >
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
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0
      }}>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          textAlign: 'right'
        }}>
          {formatNumber(matchup.gamesPlayed)}
          <br />
          <span style={{ fontSize: '8px', letterSpacing: '0.5px' }}>GAMES</span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke={isSelected ? 'var(--accent-gold)' : 'var(--text-muted)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: isSelected ? 1 : 0.4, transition: 'opacity 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}

function RuneWidget({ runes }: { runes: import('../../../preload/index').RuneSetup | null }) {
  if (!runes) {
    return (
      <div style={{
        padding: '10px 12px',
        background: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        No rune data available
      </div>
    )
  }

  const activeShards = runes.shardRows
    .map((row) => row.find((r) => r.isActive))
    .filter(Boolean) as import('../../../preload/index').RuneOption[]

  return (
    <div style={{
      padding: '10px',
      background: 'var(--bg-card)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      animation: 'slideUp 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          Runes
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: wrColor(runes.winRate) }}>
          {runes.winRate.toFixed(1)}% WR
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
          {formatNumber(runes.gamesPlayed)} games
        </span>
      </div>

      {/* 3 columns side by side, each with independent height */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        {/* Primary tree */}
        <RuneTreeColumn tree={runes.primaryTree} rows={runes.primaryRows} />

        {/* Secondary tree */}
        <RuneTreeColumn tree={runes.secondaryTree} rows={runes.secondaryRows} />

        {/* Shards — active only, smaller, no border */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', marginTop: '24px', marginLeft: '4px' }}>
          {activeShards.map((shard) => (
            <RuneIcon key={shard.name} rune={shard} size={16} noBorder />
          ))}
        </div>
      </div>
    </div>
  )
}

function RuneTreeColumn({ tree, rows }: {
  tree: import('../../../preload/index').RuneInfo
  rows: import('../../../preload/index').RuneOption[][]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      {/* Tree label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {tree.icon && (
          <img src={tree.icon} alt={tree.name} width={12} height={12}
            style={{ borderRadius: '50%', opacity: 0.7 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        )}
        <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
          {tree.name}
        </span>
      </div>
      {/* Rune rows */}
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
          {row.map((rune) => (
            <RuneIcon key={rune.name} rune={rune} size={30} />
          ))}
        </div>
      ))}
    </div>
  )
}

function RuneIcon({ rune, size, noBorder }: {
  rune: import('../../../preload/index').RuneOption
  size: number
  noBorder?: boolean
}) {
  return (
    <div title={rune.name} style={{ lineHeight: 0, opacity: rune.isActive ? 1 : 0.25, transition: 'opacity 0.15s' }}>
      {rune.icon ? (
        <img
          src={rune.icon}
          alt={rune.name}
          width={size}
          height={size}
          style={{
            borderRadius: '50%',
            border: noBorder ? 'none' : rune.isActive ? '1.5px solid var(--accent-gold)' : '1.5px solid transparent',
            display: 'block'
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
        />
      ) : (
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(size * 0.4, 8),
          color: 'var(--text-muted)'
        }}>
          {rune.name.charAt(0)}
        </div>
      )}
    </div>
  )
}

function ItemsWidget({ items }: { items: import('../../../preload/index').ItemBuild[] }) {
  const patch = getPatch()

  if (items.length === 0) {
    return (
      <div style={{
        padding: '10px 12px',
        background: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        No item data available
      </div>
    )
  }

  return (
    <div style={{
      padding: '12px',
      background: 'var(--bg-card)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      animation: 'slideUp 0.3s ease'
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--accent-gold)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        marginBottom: '10px'
      }}>
        Core Builds
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((build, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px',
            background: i === 0 ? 'rgba(200, 170, 110, 0.06)' : 'rgba(255,255,255,0.02)',
            borderRadius: '6px',
            border: i === 0 ? '1px solid rgba(200, 170, 110, 0.15)' : '1px solid transparent'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              {build.items.map((item, j) => (
                <div key={`${item.id}-${j}`} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {j > 0 && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${item.id}.png`}
                    alt={item.name}
                    title={item.name}
                    width={28}
                    height={28}
                    style={{ borderRadius: '4px', border: '1px solid var(--border-light)', flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: wrColor(build.winRate)
              }}>
                {build.winRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                {build.pickRate.toFixed(1)}% · {formatNumber(build.gamesPlayed)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '8px'
    }}>
      <div style={{
        width: 16,
        height: 16,
        border: '2px solid var(--border-light)',
        borderTopColor: 'var(--accent-gold)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading build data...</span>
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
