// Electron main process: window, tray, native dialogs, folder sync, optional backend child process.
const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, shell } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const IMAGE_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' }
const DEV_URL = 'http://127.0.0.1:5173'
const isDev = !app.isPackaged

let win = null
let tray = null
let backend = null
let watcher = null
let syncDir = null
app.isQuitting = false

// ---------------------------------------------------------------- backend (optional)
function startBackend() {
  const wanted = isDev ? process.env.CG_START_BACKEND === '1' : true
  if (!wanted) return
  const dir = isDev ? path.join(__dirname, '..', '..', 'backend') : path.join(process.resourcesPath, 'backend')
  if (!fs.existsSync(path.join(dir, 'app', 'main.py'))) return console.warn('[backend] folder not found:', dir)

  const winPy = path.join(dir, 'venv', 'Scripts', 'python.exe')
  const unixPy = path.join(dir, 'venv', 'bin', 'python')
  const python = fs.existsSync(winPy) ? winPy : fs.existsSync(unixPy) ? unixPy : (process.platform === 'win32' ? 'python' : 'python3')

  // Packaged app: keep user data (.env + uploads) in AppData so it survives updates.
  const userData = app.getPath('userData')
  const env = { ...process.env }
  if (!isDev) {
    env.CG_ENV_FILE = path.join(userData, 'backend.env')
    env.CG_UPLOAD_DIR = path.join(userData, 'uploads')
    if (!fs.existsSync(env.CG_ENV_FILE)) console.warn('[backend] create', env.CG_ENV_FILE, 'from backend/.env.example')
  }

  backend = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], { cwd: dir, env })
  backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`))
  backend.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`))
  backend.on('error', (e) => console.error('[backend] failed to start:', e.message))
  backend.on('exit', (code) => { console.log('[backend] exited', code); backend = null })
}

function stopBackend() {
  if (backend) { backend.kill(); backend = null }
}

// ---------------------------------------------------------------- window & tray
function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 900, minHeight: 600, show: false, title: 'CloudGallery',
    icon: path.join(__dirname, 'tray.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.once('ready-to-show', () => win.show())
  win.removeMenu()

  if (isDev) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // links to the outside world (share links) open in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide() } }) // minimise to tray
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png')).resize({ width: 20, height: 20 })
  tray = new Tray(icon)
  tray.setToolTip('CloudGallery')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open CloudGallery', click: () => { win.show(); win.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
  ]))
  tray.on('click', () => { win.isVisible() ? win.hide() : win.show() })
}

// ---------------------------------------------------------------- IPC: native file picker
const readImage = (file) => ({
  name: path.basename(file),
  type: IMAGE_EXT[path.extname(file).toLowerCase()] || 'application/octet-stream',
  data: fs.readFileSync(file),
})

ipcMain.handle('dialog:openFiles', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose photos', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
  })
  return res.canceled ? [] : res.filePaths.map(readImage)
})

// ---------------------------------------------------------------- IPC: sync folder
ipcMain.handle('sync:choose', async () => {
  const res = await dialog.showOpenDialog(win, { title: 'Folder to watch', properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('sync:start', async (_e, dir) => {
  await stopWatching()
  const chokidar = require('chokidar')
  syncDir = dir
  watcher = chokidar.watch(dir, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 }, depth: 3 })
  watcher.on('add', (file) => {
    if (!IMAGE_EXT[path.extname(file).toLowerCase()]) return
    try { win?.webContents.send('sync:file', readImage(file)) } catch (e) { console.error('sync read failed', e.message) }
  })
  return true
})

async function stopWatching() {
  if (watcher) { await watcher.close(); watcher = null }
  syncDir = null
}
ipcMain.handle('sync:stop', stopWatching)
ipcMain.handle('sync:status', () => syncDir)

// ---------------------------------------------------------------- lifecycle
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus() } })
  app.whenReady().then(() => {
    startBackend()
    createWindow()
    createTray()
  })
  app.on('before-quit', () => { app.isQuitting = true; stopBackend(); stopWatching() })
  app.on('window-all-closed', () => { /* stay alive in the tray */ })
  app.on('activate', () => win?.show())
}
