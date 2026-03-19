import { useEffect, useState } from 'react'
import type { DraftState, Recommendation, ConnectionStatus } from '../../../preload/index'
import { loadPatch } from '../utils/ddragon'

export function useDraftState() {
  const [draftState, setDraftState] = useState<DraftState | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [scraperProgress, setScraperProgress] = useState<{ current: number; total: number; champion: string } | null>(null)
  const [patch, setPatch] = useState('15.6.1')

  useEffect(() => {
    loadPatch().then(setPatch)

    const unsubs = [
      window.api.onDraftUpdate((state) => setDraftState(state)),
      window.api.onRecommendations((recs) => setRecommendations(recs)),
      window.api.onConnectionStatus((status) => {
        setConnectionStatus(status)
        if (status !== 'in-champ-select') {
          setDraftState(null)
          setRecommendations([])
        }
      }),
      window.api.onScraperProgress((progress) => setScraperProgress(progress))
    ]

    window.api.connectToLcu()

    return () => unsubs.forEach((unsub) => unsub())
  }, [])

  return { draftState, recommendations, connectionStatus, scraperProgress, patch }
}
