import { useEffect, useState } from 'react'
import type { AppSettings, ChampionPoolEntry } from '../../../preload/index'
import { championIcon, nameToInternalId, laneIcon } from '../utils/ddragon'

type Props = {
  onBack: () => void
  onRerunSetup: () => void
  onPatchChange?: (patch: string) => void
}

const REGIONS = ['na', 'euw', 'eune', 'kr', 'jp', 'br', 'lan', 'las', 'oce', 'tr', 'ru', 'ph', 'sg', 'th', 'tw', 'vn']
const LANES = ['top', 'jungle', 'mid', 'bottom', 'support']

export function Settings({ onBack, onRerunSetup, onPatchChange }: Props) {
  const [settings, setSettings] = useState<AppSettings>({ summonerName: '', tagline: '', region: 'na', selectedPatch: '', onboardingComplete: true })
  const [pool, setPool] = useState<ChampionPoolEntry[]>([])
  const [allChampions, setAllChampions] = useState<{ id: number; name: string; icon: string }[]>([])
  const [availablePatches, setAvailablePatches] = useState<string[]>([])
  const [newChampion, setNewChampion] = useState('')
  const [newLane, setNewLane] = useState('mid')
  const [syncing, setSyncing] = useState(false)
  const [scraperStatus, setScraperStatus] = useState<{ lastRefresh: number | null; isRunning: boolean }>({ lastRefresh: null, isRunning: false })

  useEffect(() => {
    window.api.getSettings().then(setSettings)
    window.api.getChampionPool().then(setPool)
    window.api.getAllChampions().then(setAllChampions)
    window.api.getScraperStatus().then(setScraperStatus)
    window.api.getAvailablePatches().then(setAvailablePatches)
  }, [])

  const handleSave = async () => {
    await window.api.saveSettings(settings)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await window.api.syncPoolFromOpgg()
      setPool(await window.api.getChampionPool())
    } finally {
      setSyncing(false)
    }
  }

  const handleAddToPool = async () => {
    if (!newChampion) return
    await window.api.addToPool(newChampion, newLane)
    setPool(await window.api.getChampionPool())
    setNewChampion('')
  }

  const handleRemoveFromPool = async (champion: string) => {
    await window.api.removeFromPool(champion)
    setPool(await window.api.getChampionPool())
  }

  const handleRefreshData = async () => {
    await window.api.refreshMatchupData()
    setScraperStatus(await window.api.getScraperStatus())
  }

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '32px 48px',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--accent-gold)',
            letterSpacing: '2px'
          }}>
            SETTINGS
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={async () => {
                const updated = { ...settings, onboardingComplete: false }
                await window.api.saveSettings(updated)
                onRerunSetup()
              }}
              style={btnSecondary}
            >
              Re-run Setup
            </button>
            <button onClick={onBack} style={btnSecondary}>Back to Draft</button>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px'
        }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Summoner Info */}
            <Section label="Summoner Info">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ ...inputStyle, flex: 2 }} placeholder="Summoner Name" value={settings.summonerName}
                    onChange={(e) => setSettings({ ...settings, summonerName: e.target.value })} />
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Tag" value={settings.tagline}
                    onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select style={{ ...inputStyle, flex: 1 }} value={settings.region}
                    onChange={(e) => setSettings({ ...settings, region: e.target.value })}>
                    {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                  </select>
                  <button style={btnPrimary} onClick={handleSave}>Save</button>
                  <button style={btnGold} onClick={handleSync} disabled={syncing}>
                    {syncing ? 'Syncing...' : 'Sync Pool'}
                  </button>
                </div>
              </div>
            </Section>

            {/* Data Management */}
            <Section label="Data Management">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>Patch:</span>
                  <select
                    style={{ ...inputStyle, flex: 1 }}
                    value={settings.selectedPatch}
                    onChange={async (e) => {
                      const updated = { ...settings, selectedPatch: e.target.value }
                      setSettings(updated)
                      await window.api.saveSettings(updated)
                      onPatchChange?.(e.target.value)
                    }}
                  >
                    <option value="">Latest</option>
                    {availablePatches.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button style={btnPrimary} onClick={handleRefreshData} disabled={scraperStatus.isRunning}>
                    {scraperStatus.isRunning ? 'Refreshing...' : 'Refresh Matchups'}
                  </button>
                  {scraperStatus.lastRefresh && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Last: {new Date(scraperStatus.lastRefresh).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* Right column - Champion Pool */}
          <Section label="Champion Pool">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <select style={{ ...inputStyle, flex: 2 }} value={newChampion}
                onChange={(e) => setNewChampion(e.target.value)}>
                <option value="">Select champion...</option>
                {allChampions.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select style={{ ...inputStyle, flex: 1 }} value={newLane}
                onChange={(e) => setNewLane(e.target.value)}>
                {LANES.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
              <button style={btnPrimary} onClick={handleAddToPool}>Add</button>
            </div>

            {pool.length === 0 ? (
              <div style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '32px 16px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius)',
                border: '1px dashed var(--border)'
              }}>
                No champions in pool. Add manually or sync from op.gg.
              </div>
            ) : (
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
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      transition: 'background 0.15s'
                    }}>
                      <img
                        src={championIcon(internalId)}
                        alt={entry.champion}
                        width={32}
                        height={32}
                        style={{ borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border-light)' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: '2px'
                        }}>
                          {entry.champion}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          {laneList.map((l, i) => (
                            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '9px', margin: '0 1px' }}>/</span>}
                              <img
                                src={laneIcon(l)}
                                alt={l}
                                width={14}
                                height={14}
                                style={{ opacity: 0.7 }}
                                title={l.charAt(0).toUpperCase() + l.slice(1)}
                              />
                            </span>
                          ))}
                          {entry.gamesPlayed > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}>
                              {entry.gamesPlayed} games
                            </span>
                          )}
                          {entry.winRate != null && (
                            <span style={{
                              fontSize: '10px',
                              marginLeft: '4px',
                              color: entry.winRate >= 50 ? 'var(--accent-green)' : 'var(--accent-red)',
                              fontWeight: 600
                            }}>
                              {entry.winRate.toFixed(0)}% WR
                            </span>
                          )}
                          {entry.kda != null && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '2px' }}>
                              {entry.kda.toFixed(1)} KDA
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromPool(entry.champion)}
                        aria-label={`Remove ${entry.champion}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-red)',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '0 4px',
                          opacity: 0.5,
                          flexShrink: 0
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)'
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  padding: '8px 12px',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s'
}

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '8px 16px',
  fontSize: '12px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'opacity 0.15s',
  whiteSpace: 'nowrap'
}

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent-blue)',
  color: '#fff'
}

const btnGold: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent-gold)',
  color: 'var(--bg-primary)'
}

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)'
}
