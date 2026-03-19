import { useEffect, useState } from 'react'
import type { DraftState, TeamMember } from '../../../preload/index'
import { championLoading, championIcon, nameToInternalId, laneIcon } from '../utils/ddragon'

type Props = {
  draftState: DraftState
}

type RolesMap = Record<string, { lane: string; pickRate: number }[]>

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JNG', middle: 'MID', bottom: 'BOT', utility: 'SUP', support: 'SUP'
}

const FLEX_THRESHOLD = 5

export function DraftView({ draftState }: Props) {
  const [rolesMap, setRolesMap] = useState<RolesMap>({})

  useEffect(() => {
    window.api.getChampionRolesMap().then(setRolesMap)
  }, [])

  const phaseLabel = draftState.phase === 'BAN_PICK' ? 'PICK PHASE'
    : draftState.phase === 'FINALIZATION' ? 'FINALIZATION'
    : draftState.phase

  return (
    <div style={{ padding: '16px', animation: 'slideIn 0.3s ease' }}>
      {/* Phase + Role header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        padding: '0 2px'
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--accent-gold)',
          letterSpacing: '2px'
        }}>
          {phaseLabel}
        </span>
        {draftState.assignedPosition && POSITION_LABELS[draftState.assignedPosition] && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--accent-gold)',
            padding: '3px 8px',
            borderRadius: '4px'
          }}>
            <img src={laneIcon(draftState.assignedPosition)} alt="" width={13} height={13} style={{ filter: 'brightness(0.2)' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--bg-primary)', letterSpacing: '0.5px' }}>
              {POSITION_LABELS[draftState.assignedPosition]}
            </span>
          </span>
        )}
      </div>

      {/* My Team */}
      <TeamSection
        label="ALLIED TEAM"
        members={draftState.myTeam}
        localCellId={draftState.localPlayerCellId}
        side="blue"
        rolesMap={rolesMap}
        bans={draftState.myBans}
      />

      <div style={{
        height: 1,
        background: 'var(--border)',
        margin: '14px 0'
      }} />

      {/* Enemy Team */}
      <TeamSection
        label="ENEMY TEAM"
        members={draftState.theirTeam}
        localCellId={-1}
        side="red"
        rolesMap={rolesMap}
        bans={draftState.theirBans}
      />
    </div>
  )
}

function TeamSection({ label, members, localCellId, side, rolesMap, bans }: {
  label: string
  members: TeamMember[]
  localCellId: number
  side: 'blue' | 'red'
  rolesMap: RolesMap
  bans: number[]
}) {
  const accentColor = side === 'blue' ? 'var(--accent-blue)' : 'var(--accent-red)'

  return (
    <div>
      <div style={{
        fontSize: '9px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '1.5px',
        marginBottom: '8px',
        textTransform: 'uppercase'
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {members.length > 0 ? members.map((m, i) => (
          <MemberRow
            key={m.cellId}
            member={m}
            isLocal={m.cellId === localCellId}
            side={side}
            rolesMap={rolesMap}
            delay={i * 0.05}
          />
        )) : (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 56,
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)'
            }} />
          ))
        )}
      </div>

      {/* Bans */}
      {bans && bans.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '10px',
          padding: '0 2px'
        }}>
          {bans.map((id, i) => (
            <div key={i} style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: id > 0 ? 'var(--bg-card)' : 'var(--bg-surface)',
              border: `1px solid ${id > 0 ? accentColor : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              opacity: id > 0 ? 0.8 : 0.4
            }}>
              {id > 0 && (
                <span style={{
                  fontSize: '12px',
                  color: 'var(--accent-red)',
                  fontWeight: 700,
                  lineHeight: 1
                }}>
                  ×
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberRow({ member: m, isLocal, side, rolesMap, delay }: {
  member: TeamMember
  isLocal: boolean
  side: 'blue' | 'red'
  rolesMap: RolesMap
  delay: number
}) {
  const accentColor = side === 'blue' ? 'var(--accent-blue)' : 'var(--accent-red)'
  const dimColor = side === 'blue' ? 'var(--accent-blue-dim)' : 'var(--accent-red-dim)'
  const hasPick = m.championId > 0 && m.championName
  const internalId = m.championInternalId || nameToInternalId(m.championName)
  const pos = POSITION_LABELS[m.assignedPosition] || ''

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 8px',
      background: isLocal ? dimColor : 'var(--bg-card)',
      borderRadius: '8px',
      border: isLocal ? `1px solid ${accentColor}` : '1px solid var(--border)',
      borderLeft: `3px solid ${isLocal ? accentColor : (hasPick ? accentColor : 'var(--border)')}`,
      animation: `slideIn 0.3s ease ${delay}s both`,
      position: 'relative',
      overflow: 'hidden',
      transition: 'background 0.15s',
      ...(isLocal ? { boxShadow: `0 0 12px ${dimColor}` } : {})
    }}>
      {/* Champion portrait */}
      {hasPick ? (
        <div style={{
          width: 40,
          height: 52,
          borderRadius: '6px',
          overflow: 'hidden',
          flexShrink: 0,
          border: `1.5px solid ${accentColor}`,
          position: 'relative'
        }}>
          <img
            src={championLoading(internalId)}
            alt={m.championName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 15%'
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      ) : (
        <div style={{
          width: 40,
          height: 52,
          borderRadius: '6px',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {pos ? (
            <img src={laneIcon(m.assignedPosition)} alt={pos} width={18} height={18} style={{ opacity: 0.4 }} />
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>?</span>
          )}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: isLocal ? 700 : 500,
          color: hasPick ? 'var(--text-primary)' : 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '2px'
        }}>
          {hasPick ? m.championName : 'Picking...'}
        </div>
        <FlexRoles
          championName={hasPick ? m.championName : undefined}
          assignedPosition={m.assignedPosition}
          rolesMap={rolesMap}
        />
      </div>

      {isLocal && (
        <div style={{
          fontSize: '8px',
          fontWeight: 700,
          color: accentColor,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          flexShrink: 0
        }}>
          YOU
        </div>
      )}
    </div>
  )
}

function FlexRoles({ championName, assignedPosition, rolesMap }: {
  championName?: string
  assignedPosition: string
  rolesMap: RolesMap
}) {
  const pos = POSITION_LABELS[assignedPosition] || ''
  const roles = championName ? (rolesMap[championName] || []).filter(r => r.pickRate >= FLEX_THRESHOLD) : []

  if (roles.length > 1 && championName) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        {roles.map((r, i) => {
          const label = POSITION_LABELS[r.lane] || r.lane.toUpperCase().slice(0, 3)
          const isAssigned = r.lane === assignedPosition || POSITION_LABELS[r.lane] === POSITION_LABELS[assignedPosition]
          return (
            <span key={r.lane} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {i > 0 && <span style={{ fontSize: '8px', color: 'var(--text-muted)', margin: '0 1px' }}>/</span>}
              <img src={laneIcon(r.lane)} alt={label} width={11} height={11} style={{ opacity: isAssigned ? 0.9 : 0.4 }} />
              <span style={{
                fontSize: '9px',
                color: isAssigned ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontWeight: isAssigned ? 700 : 500,
                letterSpacing: '0.3px'
              }}>
                {label}
              </span>
            </span>
          )
        })}
      </div>
    )
  }

  if (pos) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <img src={laneIcon(assignedPosition)} alt={pos} width={11} height={11} style={{ opacity: 0.5 }} />
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
          {pos}
        </span>
      </div>
    )
  }

  return null
}
