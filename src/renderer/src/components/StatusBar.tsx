import type { ConnectionStatus } from '../../../preload/index'

type Props = {
  connectionStatus: ConnectionStatus
  onSettingsClick: () => void
  scraperProgress: { current: number; total: number; champion: string } | null
  patch: string
  selectedPatch: string
  isSettings?: boolean
}

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  disconnected: 'var(--accent-red)',
  connected: 'var(--accent-green)',
  'in-champ-select': 'var(--accent-gold)'
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connected: 'Connected',
  'in-champ-select': 'In Draft'
}

export function StatusBar({ connectionStatus, onSettingsClick, scraperProgress, patch, selectedPatch, isSettings }: Props) {
  const isActive = connectionStatus !== 'disconnected'
  const isWindows = window.api.platform === 'win32'
  const displayPatch = selectedPatch || patch

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      paddingRight: isWindows ? 140 : 20,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      height: 'var(--statusbar-height)',
      minHeight: 'var(--statusbar-height)',
      gap: '16px',
      WebkitAppRegion: 'drag' as never
    }}>
      {/* Left: App branding + settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: 68, WebkitAppRegion: 'no-drag' as never }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          letterSpacing: '1.5px',
          pointerEvents: 'none'
        }}>
          ORACLE
        </span>
        <button
          onClick={onSettingsClick}
          title={isSettings ? 'Close settings' : 'Settings'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isSettings ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {window.api.isDev && (
          <button
            onClick={() => window.api.triggerMockDraft()}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 500
            }}
          >
            Mock
          </button>
        )}
      </div>

      {/* Center: Status info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: STATUS_COLORS[connectionStatus],
            animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
            boxShadow: isActive ? `0 0 6px ${STATUS_COLORS[connectionStatus]}` : 'none'
          }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>
            {STATUS_LABELS[connectionStatus]}
          </span>
        </div>
        {displayPatch && (
          <span style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'var(--bg-card)'
          }}>
            v{displayPatch}
          </span>
        )}
        {scraperProgress && scraperProgress.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 100,
              height: 3,
              borderRadius: 2,
              background: 'var(--border)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(scraperProgress.current / scraperProgress.total) * 100}%`,
                height: '100%',
                background: 'var(--accent-gold)',
                borderRadius: 2,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px', whiteSpace: 'nowrap' }}>
              {scraperProgress.champion} ({scraperProgress.current}/{scraperProgress.total})
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
