import { useEffect, useState, useRef } from 'react'
import type { AppSettings, ChampionPoolEntry } from '../../../preload/index'
import { championIcon, nameToInternalId, laneIcon, championSplash } from '../utils/ddragon'

type Props = {
  onComplete: () => void
}

type Step = 'identity' | 'pool' | 'sync'

const STEPS: { key: Step; label: string }[] = [
  { key: 'identity', label: 'Account' },
  { key: 'pool', label: 'Champions' },
  { key: 'sync', label: 'Data' }
]

const REGIONS = ['na', 'euw', 'eune', 'kr', 'jp', 'br', 'lan', 'las', 'oce', 'tr', 'ru', 'ph', 'sg', 'th', 'tw', 'vn']
const LANES = ['top', 'jungle', 'mid', 'bottom', 'support']

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('identity')
  const [settings, setSettings] = useState<AppSettings>({
    summonerName: '', tagline: '', region: 'na', selectedPatch: '', onboardingComplete: false
  })
  const [skippedIdentity, setSkippedIdentity] = useState(false)

  const stepIdx = STEPS.findIndex((s) => s.key === step)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background art */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${championSplash('Ahri')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        opacity: 0.06,
        filter: 'blur(3px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, var(--bg-primary) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Draggable title bar area */}
      <div style={{ height: 44, minHeight: 44, WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'auto',
        padding: '0 32px 32px'
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '28px',
          animation: 'fadeIn 0.6s ease'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--accent-gold)',
            letterSpacing: '2px'
          }}>
            ORACLE
          </span>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          marginBottom: '36px',
          animation: 'fadeIn 0.6s ease 0.1s both'
        }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: i <= stepIdx ? 'var(--accent-gold)' : 'var(--bg-card)',
                  color: i <= stepIdx ? 'var(--bg-primary)' : 'var(--text-muted)',
                  border: i <= stepIdx ? '2px solid var(--accent-gold)' : '2px solid var(--border)',
                  transition: 'all 0.3s ease'
                }}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: i <= stepIdx ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'color 0.3s ease'
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 48,
                  height: 2,
                  margin: '0 12px',
                  borderRadius: 1,
                  background: i < stepIdx ? 'var(--accent-gold)' : 'var(--border)',
                  transition: 'background 0.3s ease'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={{
          width: '100%',
          maxWidth: 520,
          animation: 'slideUp 0.35s ease'
        }} key={step}>
          {step === 'identity' && (
            <IdentityStep
              settings={settings}
              onChange={setSettings}
              onContinue={async () => {
                await window.api.saveSettings(settings)
                setSkippedIdentity(false)
                setStep('pool')
              }}
              onSkip={() => {
                setSkippedIdentity(true)
                setStep('pool')
              }}
            />
          )}
          {step === 'pool' && (
            <PoolStep
              skippedIdentity={skippedIdentity}
              onContinue={() => setStep('sync')}
              onBack={() => setStep('identity')}
            />
          )}
          {step === 'sync' && (
            <SyncStep
              onComplete={async () => {
                const updated = { ...settings, onboardingComplete: true }
                await window.api.saveSettings(updated)
                onComplete()
              }}
              onSkipToApp={async () => {
                const updated = { ...settings, onboardingComplete: true }
                await window.api.saveSettings(updated)
                onComplete()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Step 1: Identity ─── */

function IdentityStep({ settings, onChange, onContinue, onSkip }: {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onContinue: () => void
  onSkip: () => void
}) {
  const canContinue = settings.summonerName.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          Link Your Account
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Enter your Riot ID so Oracle can import your champion pool automatically.
        </p>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Summoner Name</label>
            <input
              style={inputStyle}
              placeholder="e.g. Faker"
              value={settings.summonerName}
              onChange={(e) => onChange({ ...settings, summonerName: e.target.value })}
              autoFocus
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Tag</label>
            <input
              style={inputStyle}
              placeholder="e.g. KR1"
              value={settings.tagline}
              onChange={(e) => onChange({ ...settings, tagline: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Region</label>
          <select
            style={inputStyle}
            value={settings.region}
            onChange={(e) => onChange({ ...settings, region: e.target.value })}
          >
            {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        <button style={btnGold} onClick={onContinue} disabled={!canContinue}>
          Continue
        </button>
        <button style={btnLink} onClick={onSkip}>
          Skip — I'll add champions manually
        </button>
      </div>
    </div>
  )
}

/* ─── Step 2: Champion Pool ─── */

function PoolStep({ skippedIdentity, onContinue, onBack }: {
  skippedIdentity: boolean
  onContinue: () => void
  onBack: () => void
}) {
  const [pool, setPool] = useState<ChampionPoolEntry[]>([])
  const [allChampions, setAllChampions] = useState<{ id: number; name: string; icon: string }[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [newChampion, setNewChampion] = useState('')
  const [newLane, setNewLane] = useState('mid')
  const hasTriedSync = useRef(false)

  useEffect(() => {
    window.api.getAllChampions().then(setAllChampions)
    window.api.getChampionPool().then(setPool)
  }, [])

  useEffect(() => {
    if (!skippedIdentity && !hasTriedSync.current && allChampions.length > 0) {
      hasTriedSync.current = true
      doSync()
    }
  }, [skippedIdentity, allChampions])

  const doSync = async () => {
    setSyncing(true)
    setSyncError(false)
    try {
      await window.api.syncPoolFromOpgg()
      const updated = await window.api.getChampionPool()
      setPool(updated)
      setSyncDone(true)
      if (updated.length === 0) setSyncError(true)
    } catch {
      setSyncError(true)
      setSyncDone(true)
    } finally {
      setSyncing(false)
    }
  }

  const handleAdd = async () => {
    if (!newChampion) return
    await window.api.addToPool(newChampion, newLane)
    setPool(await window.api.getChampionPool())
    setNewChampion('')
  }

  const handleRemove = async (champion: string) => {
    await window.api.removeFromPool(champion)
    setPool(await window.api.getChampionPool())
  }

  const showManualAdd = skippedIdentity || syncDone

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          Your Champion Pool
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {syncing
            ? 'Importing your champions from op.gg...'
            : pool.length > 0
              ? 'Review your pool below. Add or remove champions as needed.'
              : 'Add the champions you play so Oracle can recommend picks.'}
        </p>
      </div>

      {/* Syncing state */}
      {syncing && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '40px 0'
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent-gold)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Fetching your champion data...
          </span>
        </div>
      )}

      {/* Sync error */}
      {syncError && !syncing && (
        <div style={{
          background: 'var(--accent-red-dim)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          Couldn't find champion data for this account. You can add champions manually below, or go back and check your Riot ID.
        </div>
      )}

      {/* Manual add */}
      {showManualAdd && !syncing && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select style={{ ...inputStyle, flex: 2 }} value={newChampion} onChange={(e) => setNewChampion(e.target.value)}>
              <option value="">Select champion...</option>
              {allChampions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select style={{ ...inputStyle, flex: 1 }} value={newLane} onChange={(e) => setNewLane(e.target.value)}>
              {LANES.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
            </select>
            <button style={btnSmallGold} onClick={handleAdd} disabled={!newChampion}>Add</button>
          </div>
        </div>
      )}

      {/* Pool display */}
      {pool.length > 0 && !syncing && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '16px',
          maxHeight: 260,
          overflow: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '6px'
          }}>
            {pool.map((entry) => {
              const internalId = nameToInternalId(entry.champion)
              const laneList = entry.lanes.split(',')
              return (
                <div key={entry.champion} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  <img
                    src={championIcon(internalId)}
                    alt={entry.champion}
                    width={30}
                    height={30}
                    style={{ borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border-light)' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.champion}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      {laneList.map((l, i) => (
                        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                          {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '9px', margin: '0 1px' }}>/</span>}
                          <img src={laneIcon(l)} alt={l} width={13} height={13} style={{ opacity: 0.7 }} title={l.charAt(0).toUpperCase() + l.slice(1)} />
                        </span>
                      ))}
                      {entry.gamesPlayed > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}>{entry.gamesPlayed}g</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.champion)}
                    aria-label={`Remove ${entry.champion}`}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent-red)',
                      cursor: 'pointer', fontSize: '16px', padding: '0 4px', opacity: 0.5, flexShrink: 0
                    }}
                  >×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pool.length === 0 && showManualAdd && !syncing && !syncError && (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: 'var(--text-muted)',
          fontSize: '13px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)'
        }}>
          Add at least one champion to continue.
        </div>
      )}

      {/* Actions */}
      {!syncing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <button style={btnGold} onClick={onContinue} disabled={pool.length === 0}>
            Continue
          </button>
          <button style={btnLink} onClick={onBack}>
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Step 3: Data Sync ─── */

function SyncStep({ onComplete, onSkipToApp }: {
  onComplete: () => void
  onSkipToApp: () => void
}) {
  const [progress, setProgress] = useState<{ current: number; total: number; champion: string } | null>(null)
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const hasStarted = useRef(false)

  useEffect(() => {
    const unsub = window.api.onScraperProgress((p) => {
      if (p.total === 0 && p.current === 0 && started) {
        setDone(true)
        setProgress(null)
      } else if (p.total > 0) {
        setProgress(p)
      }
    })

    return () => { unsub() }
  }, [started])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    setStarted(true)
    window.api.refreshMatchupData()
  }, [])

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0
  const isRolePhase = progress?.champion.startsWith('roles')
  const displayChampion = progress && !isRolePhase ? progress.champion : null
  const internalId = displayChampion ? nameToInternalId(displayChampion) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          {done ? 'All Set!' : 'Preparing Your Data'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {done
            ? 'Your matchup data is ready. Oracle will keep it updated automatically.'
            : 'Oracle is analyzing matchups for your champion pool. This may take a minute.'}
        </p>
      </div>

      {/* Progress area */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Champion spotlight or completion icon */}
        {done ? (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(200, 170, 110, 0.2), rgba(200, 170, 110, 0.05))',
            border: '2px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'glow 2s ease-in-out infinite'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ) : (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-card))',
            border: '2px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 0 20px rgba(200, 170, 110, 0.15)'
          }}>
            {internalId ? (
              <img
                key={internalId}
                src={championIcon(internalId)}
                alt={displayChampion || ''}
                width={56}
                height={56}
                style={{
                  borderRadius: '50%',
                  animation: 'fadeIn 0.3s ease'
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </div>
        )}

        {/* Status text */}
        <div style={{ textAlign: 'center' }}>
          {done ? (
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-gold)' }}>
              Matchup data is ready
            </span>
          ) : isRolePhase ? (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Finalizing role data...
            </span>
          ) : progress ? (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Analyzing <strong style={{ color: 'var(--text-primary)' }}>{progress.champion}</strong>
              {' '}<span style={{ color: 'var(--text-muted)' }}>({progress.current} of {progress.total})</span>
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', animation: 'pulse 2s ease-in-out infinite' }}>
              Starting analysis...
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%' }}>
          <div style={{
            width: '100%',
            height: 8,
            borderRadius: 4,
            background: 'var(--bg-surface)',
            overflow: 'hidden',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              width: done ? '100%' : `${pct}%`,
              height: '100%',
              borderRadius: 4,
              background: done
                ? 'var(--accent-gold)'
                : 'linear-gradient(90deg, var(--accent-gold), #e6c97a)',
              transition: 'width 0.5s ease',
              boxShadow: done ? '0 0 8px rgba(200, 170, 110, 0.4)' : '0 0 6px rgba(200, 170, 110, 0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {!done && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s ease-in-out infinite'
                }} />
              )}
            </div>
          </div>
          {!done && progress && (
            <div style={{
              textAlign: 'right',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '6px'
            }}>
              {pct}%
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        {done ? (
          <button style={{ ...btnGold, animation: 'glow 2s ease-in-out infinite' }} onClick={onComplete}>
            Finish Setup
          </button>
        ) : (
          <button style={btnLink} onClick={onSkipToApp}>
            Continue in background →
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Shared styles ─── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '6px'
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  padding: '10px 14px',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s'
}

const btnGold: React.CSSProperties = {
  background: 'var(--accent-gold)',
  color: 'var(--bg-primary)',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '12px 40px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.5px',
  transition: 'opacity 0.15s, transform 0.1s'
}

const btnSmallGold: React.CSSProperties = {
  background: 'var(--accent-gold)',
  color: 'var(--bg-primary)',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '10px 16px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s'
}

const btnLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '12px',
  cursor: 'pointer',
  padding: '4px 8px',
  transition: 'color 0.15s'
}
