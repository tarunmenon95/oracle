import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { initDdragon } from './data/ddragon'
import { startScheduler } from './scraper/scheduler'
import { startDevMock } from './dev-mock'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Oracle',
    titleBarStyle: 'hiddenInset',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#060714',
    center: true
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  createWindow()

  try {
    await initDdragon()
  } catch (err) {
    console.error('Failed to initialize DDragon data:', err)
  }
  startScheduler()

  if (is.dev) {
    startDevMock()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
