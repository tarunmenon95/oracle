import type { ConnectionStatus } from '../../../preload/index'

type Props = {
  connectionStatus: ConnectionStatus
  onSettingsClick: () => void
  scraperProgress: { current: number; total: number; champion: string } | null
  patch: string
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

export function StatusBar({ connectionStatus, onSettingsClick, scraperProgress, patch, isSettings }: Props) {
  const isActive = connectionStatus !== 'disconnected'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      height: 'var(--statusbar-height)',
      minHeight: 'var(--statusbar-height)',
      gap: '16px',
      WebkitAppRegion: 'drag' as never
    }}>
      {/* Left: App branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: 68 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          letterSpacing: '1.5px'
        }}>
          ORACLE
        </span>
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
        {patch && (
          <span style={{
            color: 'var(--text-muted)',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'var(--bg-card)'
          }}>
            v{patch}
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

      {/* Right: Actions */}
      <div style={{ display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' as never }}>
        <button
          onClick={() => window.api.triggerMockDraft()}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500
          }}
        >
          Mock
        </button>
        <button
          onClick={onSettingsClick}
          style={{
            background: isSettings ? 'var(--accent-gold)' : 'none',
            border: isSettings ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
            color: isSettings ? 'var(--bg-primary)' : 'var(--text-secondary)',
            padding: '4px 14px',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          {isSettings ? 'Close' : 'Settings'}
        </button>
      </div>
    </div>
  )
}
