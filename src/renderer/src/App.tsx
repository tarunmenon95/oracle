import { useState, useEffect } from 'react'
import type { Recommendation } from '../../preload/index'
import { useDraftState } from './hooks/useDraftState'
import { DraftView } from './components/DraftView'
import { Recommendations } from './components/Recommendations'
import { MatchupSidebar } from './components/MatchupSidebar'
import { Settings } from './components/Settings'
import { StatusBar } from './components/StatusBar'
import { SetupWizard } from './components/SetupWizard'
import { championSplash } from './utils/ddragon'

type View = 'setup' | 'main' | 'settings'

export default function App() {
  const [view, setView] = useState<View | null>(null)
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const { draftState, recommendations, connectionStatus, scraperProgress, patch } = useDraftState()

  const inDraft = connectionStatus === 'in-champ-select' && draftState

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setView(s.onboardingComplete ? 'main' : 'setup')
    })
  }, [])

  useEffect(() => {
    if (recommendations.length === 0) return
    setSelectedRec((prev) => {
      if (!prev) return recommendations[0]
      const stillExists = recommendations.some((r) => r.championName === prev.championName)
      return stillExists ? prev : recommendations[0]
    })
  }, [recommendations])

  if (view === null) return null

  if (view === 'setup') {
    return <SetupWizard onComplete={() => setView('main')} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <StatusBar
        connectionStatus={connectionStatus}
        onSettingsClick={() => setView(view === 'settings' ? 'main' : 'settings')}
        scraperProgress={scraperProgress}
        patch={patch}
        isSettings={view === 'settings'}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {view === 'settings' ? (
          <Settings onBack={() => setView('main')} onRerunSetup={() => setView('setup')} />
        ) : inDraft ? (
          <div style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            animation: 'fadeIn 0.3s ease'
          }}>
            {/* Left Panel - Draft Board */}
            <div style={{
              width: 'var(--panel-left)',
              minWidth: 'var(--panel-left)',
              borderRight: '1px solid var(--border)',
              overflow: 'auto',
              background: 'var(--bg-secondary)'
            }}>
              <DraftView draftState={draftState} />
            </div>

            {/* Center Panel - Recommendations */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px 24px'
            }}>
              <Recommendations
                recommendations={recommendations}
                selectedRec={selectedRec}
                onSelectRec={setSelectedRec}
                hasEnemyPicks={draftState.theirTeam.some((m) => m.championId > 0)}
              />
            </div>

            {/* Right Panel - Matchup Detail */}
            <div style={{
              width: 'var(--panel-right)',
              minWidth: 'var(--panel-right)',
              borderLeft: '1px solid var(--border)',
              overflow: 'auto',
              background: 'var(--bg-secondary)'
            }}>
              <MatchupSidebar recommendation={selectedRec} />
            </div>
          </div>
        ) : (
          <IdleView connectionStatus={connectionStatus} />
        )}
      </div>
    </div>
  )
}

function IdleView({ connectionStatus }: { connectionStatus: string }) {
  const bgChamps = ['Yasuo', 'Ahri', 'Zed', 'Jinx', 'Thresh']
  const bgIdx = Math.floor(Date.now() / 60000) % bgChamps.length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${championSplash(bgChamps[bgIdx])})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 20%',
        opacity: 0.12,
        filter: 'blur(2px)',
        pointerEvents: 'none',
        animation: 'panSlow 30s ease-in-out infinite'
      }} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, var(--bg-primary) 75%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        animation: 'fadeIn 0.8s ease'
      }}>
        <div style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'float 3s ease-in-out infinite',
          boxShadow: '0 0 30px rgba(200, 170, 110, 0.15)'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          letterSpacing: '3px',
          textShadow: '0 0 30px rgba(200, 170, 110, 0.3)'
        }}>
          ORACLE
        </div>

        <div style={{
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.8
        }}>
          {connectionStatus === 'disconnected'
            ? 'Waiting for League Client...'
            : 'Connected \u2014 waiting for champion select'}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 20px',
          borderRadius: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connectionStatus === 'disconnected' ? 'var(--accent-red)' : 'var(--accent-green)',
            animation: connectionStatus !== 'disconnected' ? 'pulse 2s ease-in-out infinite' : 'none',
            boxShadow: connectionStatus !== 'disconnected' ? '0 0 8px var(--accent-green)' : 'none'
          }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {connectionStatus === 'disconnected'
              ? 'Start the League client to connect automatically'
              : 'Recommendations will appear when draft begins'}
          </span>
        </div>
      </div>
    </div>
  )
}
