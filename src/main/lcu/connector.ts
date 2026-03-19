import { authenticate, connect, type Credentials, type LeagueWebSocket } from 'league-connect'
import { getMainWindow } from '../index'
import { startChampSelectListener, stopChampSelectListener } from './websocket'

const MAX_RECONNECT_ATTEMPTS = 10

class LcuManager {
  private credentials: Credentials | null = null
  private ws: LeagueWebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0

  async connect(): Promise<void> {
    this.reconnectAttempts = 0
    this.sendStatus('disconnected')
    try {
      this.credentials = await authenticate({ awaitConnection: true, pollInterval: 2500 })
      this.sendStatus('connected')

      this.ws = await connect(this.credentials)
      startChampSelectListener(this.ws, this.credentials)

      this.ws.on('close', () => {
        this.sendStatus('disconnected')
        this.scheduleReconnect()
      })
    } catch (err) {
      console.error('LCU connection failed:', err)
      this.sendStatus('disconnected')
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      stopChampSelectListener(this.ws)
      this.ws.close()
      this.ws = null
    }
    this.credentials = null
    this.reconnectAttempts = 0
    this.sendStatus('disconnected')
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`LCU: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`)
      return
    }
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 5000)
  }

  private sendStatus(status: 'disconnected' | 'connected' | 'in-champ-select'): void {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('connection:status', status)
    }
  }
}

export const lcuManager = new LcuManager()
