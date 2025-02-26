import { existsSync as exists } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell } from 'electron'
import type { HandlerDetails, WindowOpenHandlerResponse } from 'electron'
import { IpcServerController } from 'electron-ipc-flow'
import * as ipc from './ipc.ts'
import * as Paths from './Paths.ts';
import * as Game from './utils/Game.ts'
import BepInExManager from './lib/BepInExManager.ts'
import { getFileVersion } from 'cfv'
import { compare } from 'compare-versions'

interface GlobalState {
  config: {
    game_installDirectory?: string
    termsOfUseVersion: number
  },
}

const CONFIG_FILE = join(app.getPath('userData'), 'config.json')
const MACOS_BEPINEX_PATH = join(app.getPath('appData'), 'BepInEx/Pokemon TCG Live')
const PLUGIN_ASSETS_VERSION = 2025012301
const PLUGIN_NAME = 'PTCGLiveZhMod'
const PLUGIN_CONFIG_NAME = 'c04dfa3f-14f5-40b8-9f63-1d2d13b29bb3'

const globalState: GlobalState = {
  config: {
    termsOfUseVersion: 0,
  }
}

const uncaughtExceptionHandler = (err: any) => {
  if (app.isReady()) {
    dialog.showMessageBox({
      title: app.getName().concat(' - uncaughtException'),
      message: err instanceof Error ? err.message.concat(err.stack ?? '') : err.toString(),
      type: 'error',
    }).finally(() => process.exit(1))
  } else {
    console.error(err)
    process.exit(1)
  }
}

process.on('uncaughtException', uncaughtExceptionHandler)

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    backgroundMaterial: 'mica',
    vibrancy: 'hud',
    icon: nativeImage.createFromPath(join(Paths.resources, 'icons/app.png')),
    width: 640,
    height: 360,
    resizable: false,
    show: false,
    useContentSize: true,
    webPreferences: {
      preload: join(Paths.app, '.vite/preload/preload.cjs'),
    },
  })
  window.once('ready-to-show', window.show.bind(window))
  if (import.meta.env.DEV) {
    await window.loadURL(import.meta.env.VITE_RENDERER_URL.concat('/index.html'))
  } else {
    await window.loadFile(join(Paths.app, '.vite/renderer/index.html')).catch(handleRendererError)
  }
}

async function cleanOldMacOSVersion(): Promise<void> {
  const path = '/Applications/Pokemon TCG Live BepInEx'
  if (!exists(path)) {
    return
  }
  const bep = new BepInExManager(path)
  const plugins = await bep.getPlugins()
  if (plugins.length === 0 || plugins.every((v) => v === PLUGIN_NAME)) {
    const desktopShortcuts = join(app.getPath('desktop'), 'PTCGL 中文版.app')
    if (exists(desktopShortcuts)) {
      await rm(desktopShortcuts)
    }
    await rm(path, { recursive: true })
  }
}

function getBepInExManager(state: GlobalState): BepInExManager | undefined {
  const dir = process.platform === 'darwin' ? MACOS_BEPINEX_PATH : state.config.game_installDirectory
  return dir ? new BepInExManager(dir) : undefined
}

async function getBundlePluginVersion(): Promise<string | undefined> {
  try {
    return getFileVersion(join(Paths.resourcesBundle, 'mod/PTCGLiveZhMod.dll'))
  } catch (err) {
    console.error(err)
  }
  return undefined
}

function handleRendererError(error: any): Promise<void> {
  /**
   * --no-sandbox shouldn't be used in production environments, but it can work
   * around some quirks on people's systems, so.
   */
  if (!process.argv.includes('--no-sandbox') && error.code === 'ERR_FAILED') {
    app.relaunch({
      args: ['--no-sandbox', ...process.argv.splice(1)],
    })
    app.exit(0)
    return Promise.resolve()
  }

  return Promise.reject(error)
}

async function getLocalPluginAssetsVersion(state: GlobalState): Promise<number> {
  const bep = getBepInExManager(state)
  const plugin = await bep?.getPluginPath(PLUGIN_NAME)
  if (plugin !== undefined) {
    const file = join(dirname(plugin), 'assets/meta.json')
    if (exists(file)) {
      const meta = JSON.parse(await readFile(file, { encoding: 'utf-8' }))
      return typeof meta.version === 'number' ? meta.version : 0
    }
  }
  return 0
}

async function installPlugin(state: GlobalState): Promise<void> {
  const bep = getBepInExManager(state)
  if (bep === undefined) {
    throw new Error('install plugin failed, BepInExManager is null.')
  }
  const installedVersion = await bep.getPluginVersion(PLUGIN_NAME)
  if (installedVersion && compare(installedVersion, '0.2.3.0', '<=')) {
    await bep.uninstallPlugin(PLUGIN_NAME, true)
    await bep.uninstallPlugin(PLUGIN_CONFIG_NAME, true)
  }
  if (!bep.isInstalled() || await bep.isUpgradable()) {
    await bep.install()
  }
  await bep.installPlugin(PLUGIN_NAME, join(Paths.resourcesBundle, 'mod'))
  if (process.platform === 'darwin') {
    await cleanOldMacOSVersion()
  }
}

async function installPluginAssets(state: GlobalState, asar: string, setProgress: (progress: number) => void): Promise<void> {
  const bep = getBepInExManager(state)
  const plugin = await bep?.getPluginPath(PLUGIN_NAME)
  if (plugin === undefined) {
    throw new Error('install plugin assets failed, plugin path is null.')
  }
  const localVersion = await getLocalPluginAssetsVersion(state)
  const meta = JSON.parse(await readFile(join(asar, 'meta.json'), { encoding: 'utf-8' }))
  if (typeof meta.version !== 'number' || !Array.isArray(meta.files)) {
    throw new Error('install plugin assets failed, assets meta data missing fields.')
  }
  if (meta.version <= localVersion) {
    return
  }
  const target = join(dirname(plugin), 'assets')
  if (!exists(target)) {
    await mkdir(target, { recursive: true })
  }
  const files: { id: string, hash: string }[] = meta.files
  for (let i = 0; i < files.length; i++) {
    const item = files[i]
    const file = join(asar, 'files', item.id)
    const buffer = await readFile(file)
    const hashBuffer = await crypto.subtle.digest(meta.hashType ?? 'SHA-256', buffer)
    const hash = Array.prototype.map.call(new Uint8Array(hashBuffer), (x: number) => `00${x.toString(16)}`.slice(-2)).join('')
    if (item.hash !== hash) {
      throw new Error(`install plugin assets failed, '${item.id}' hash mismatch.`)
    }
    await writeFile(join(target, item.id), buffer)
    setProgress((i + 1) / files.length * 100)
  }
  await writeFile(join(target, 'assets.provider'), meta.provider ?? '', { encoding: 'utf-8' })
  await writeFile(join(target, 'meta.json'), JSON.stringify({ version: meta.version }), { encoding: 'utf-8' })
}

async function uninstallPlugin(state: GlobalState): Promise<void> {
  const bep = getBepInExManager(state)
  if (bep === undefined) {
    throw new Error('uninstall plugin failed, BepInExManager is null.')
  }
  await bep.uninstallPlugin(PLUGIN_NAME, true)
  await bep.uninstallPlugin(PLUGIN_CONFIG_NAME, true)
  if ((await bep.getPlugins()).length === 0) {
    await bep.uninstall()
  }
}

async function selectGameInstallDirectory(window: BrowserWindow): Promise<string | undefined> {
  const result = await dialog.showOpenDialog(window, {
    title: '选择 Pokémon TCG Live 安装目录',
    defaultPath: process.platform === 'darwin' ? '/Applications' : app.getPath('desktop'),
    filters: process.platform === 'win32'
      ? [{ name: 'Pokemon TCG Live.exe', extensions: ['exe'] }]
      : [{ name: 'Pokemon TCG Live.app', extensions: ['app'] }],
    properties: [
      'dontAddToRecent',
      'openFile'
    ],
  })
  if (result.canceled) {
    return undefined
  }
  let dir = result.filePaths[0]
  if (!dir.endsWith('.app')) {
    dir = dirname(dir)
  }
  return !Game.isInstallDirectory(dir) ? '' : dir
}

async function selectPluginAssetsPackage(window: BrowserWindow, localVersion?: number): Promise<string | number> {
  const result = await dialog.showOpenDialog(window, {
    title: '选择中文化模组中文卡牌资源包',
    defaultPath: app.getPath('downloads'),
    filters: [{ name: '资源包', extensions: ['asar'] }],
    properties: [
      'dontAddToRecent',
      'openFile'
    ],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return 0
  }
  const asar = result.filePaths[0]
  if (!exists(join(asar, 'meta.json')) || !exists(join(asar, 'files'))) {
    return 1
  }
  try {
    const meta = JSON.parse(await readFile(join(asar, 'meta.json'), { encoding: 'utf-8' }))
    const fromVersion = meta.fromVersion ?? 0
    return localVersion === undefined || localVersion === fromVersion ? asar : 2
  } catch (err) {
    console.error(err)
  }
  return 1
}

function webContentsWindowOpenHandler(details: HandlerDetails): WindowOpenHandlerResponse {
  try {
    const u = new URL(details.url)
    if (u.protocol === 'https:') {
      shell.openExternal(u.toString()).catch(console.error)
    } else if (u.protocol === 'open-path:') {
      const path = decodeURIComponent(u.pathname.substring(1))
      stat(path)
        .then((value) => {
          if (value.isDirectory()) {
            return shell.openPath(path)
          }
          shell.showItemInFolder(path)
          return Promise.resolve(null)
        })
        .catch(console.error)
    }
  } catch (err) {
    console.error(err)
  }
  return { action: 'deny' }
}

async function onReady(): Promise<void> {
  if (process.platform === 'darwin' && exists(MACOS_BEPINEX_PATH)) {
    await mkdir(MACOS_BEPINEX_PATH, { recursive: true })
  }
  await readConfig(globalState)
  await createMainWindow()
}

async function readConfig(state: GlobalState): Promise<void> {
  try {
    state.config = JSON.parse(await readFile(CONFIG_FILE, { encoding: 'utf-8' }))
  } catch (err) {
    console.error(err)
  }
}

async function writeConfig(state: GlobalState): Promise<void> {
  try {
    await writeFile(CONFIG_FILE, JSON.stringify(state.config), { encoding: 'utf8' })
  } catch (err) {
    console.error(err)
  }
}

app.on('web-contents-created', (_, contents) => {
  if (import.meta.env.DEV) {
    setImmediate(contents.openDevTools.bind(contents, { mode: 'detach' }))
  }

  contents.on('will-navigate', (ev) => {
    if (ev.url !== contents.getURL()) {
      ev.preventDefault()
    }
  })
  contents.setWindowOpenHandler(webContentsWindowOpenHandler)
})

app.once('window-all-closed', () => {
  app.quit()
})

BepInExManager.setBepInExFilePath(join(Paths.resourcesBundle, 'BepInEx.zip'))
Menu.setApplicationMenu(null)

/**
 * If --no-sandbox is present here, we should also disable GPU and hardware
 * acceleration and try to avoid other quirks.
 */
if (process.argv.includes('--no-sandbox')) {
  app.commandLine.appendSwitch('disable-gpu')
  app.disableHardwareAcceleration()
}

if (app.requestSingleInstanceLock()) {
  app.whenReady().then(onReady).catch(uncaughtExceptionHandler)
} else {
  app.once('ready', () => {
    dialog.showMessageBox({
      message: app.getName().concat('已经在运行了！'),
      title: app.getName(),
      type: 'info',
    }).finally(() => app.exit(0))
  })
}

IpcServerController.IpcMain = ipcMain
IpcServerController.WebContentsGetter = () => BrowserWindow.getAllWindows().map((win) => win.webContents)

ipc.app.handlers = {
  async checkPluginAssets(): Promise<boolean | undefined> {
    const v = await getLocalPluginAssetsVersion(globalState)
    return v === 0 ? undefined : v >= PLUGIN_ASSETS_VERSION
  },
  async disablePlugin(disable?: boolean): Promise<boolean> {
    const bep = getBepInExManager(globalState)
    if (bep === undefined) {
      return false
    }
    if (disable !== undefined) {
      await bep.disablePlugin(PLUGIN_NAME, disable)
    }
    return bep.pluginIsDisabled(PLUGIN_NAME)
  },
  gameInstallDirectory(dir?: string): string {
    if (dir) {
      globalState.config.game_installDirectory = dir
      writeConfig(globalState).catch(console.error)
    }
    return globalState.config.game_installDirectory ?? ''
  },
  installPlugin: installPlugin.bind(null, globalState),
  async installPluginAssets(asar: string): Promise<void> {
    let lastProgress = -1
    let progress = 0
    ipc.app.send('onInstallPluginAssets', progress.toFixed(2))
    let timer = setInterval(() => {
      if (progress === lastProgress) {
        return
      }
      ipc.app.send('onInstallPluginAssets', progress.toFixed(2))
      lastProgress = progress
    }, 100)
    return installPluginAssets(globalState, asar, (x) => {
      progress = x
    }).finally(() => clearInterval(timer))
  },
  async pluginFeature(name: 'EnableCardGraphicText', value?: boolean): Promise<boolean | undefined> {
    try {
      return await getBepInExManager(globalState)?.configPlugin(PLUGIN_CONFIG_NAME, 'card', name, value) ?? false
    } catch (err) {
      console.error(err)
    }
    return undefined
  },
  pluginInstalled(): boolean {
    return getBepInExManager(globalState)?.pluginIsInstalled(PLUGIN_NAME) ?? false
  },
  async pluginUpgradable(): Promise<boolean> {
    const v1 = await getBundlePluginVersion()
    const v2 = await getBepInExManager(globalState)?.getPluginVersion(PLUGIN_NAME)
    if (v1 === undefined) {
      throw new Error('get bundle plugin version failed.')
    }
    return compare(v1, v2 ?? '0.0.0.0', '>')
  },
  selectGameInstallDirectory: () => selectGameInstallDirectory(BrowserWindow.getAllWindows()[0]),
  async selectPluginAssetsPackage(): Promise<string | number> {
    return selectPluginAssetsPackage(
      BrowserWindow.getAllWindows()[0],
      await getLocalPluginAssetsVersion(globalState),
    )
  },
  termsOfUseVersion(version?: number): number {
    if (version) {
      globalState.config.termsOfUseVersion = version
      writeConfig(globalState).catch(console.error)
    }
    return globalState.config.termsOfUseVersion
  },
  uninstallPlugin: uninstallPlugin.bind(null, globalState),
  async version(): Promise<string> {
    return `${app.getVersion()} (electron ${process.versions.electron}, ${process.platform}, bundle mod ${await getBundlePluginVersion()})`;
  },
}

ipc.game.handlers = {
  detectInstallDirectory: Game.detectInstallDirectory,
  extUtilIsAvailable: Game.extUtilIsAvailable,
  isInstallDirectory: Game.isInstallDirectory,
  running: Game.running,
  start(): Promise<void> {
    if (!globalState.config.game_installDirectory) {
      throw new Error('Game install directory is null.')
    }
    return Game.start({
      macos: process.platform === 'darwin' ? {
        bepinex: getBepInExManager(globalState)?.paths?.BepInEx ?? MACOS_BEPINEX_PATH,
        core: join(Paths.resourcesBundle, 'BepInExOSXLoader/UnityEngine.CoreModule.dll'),
        loader: join(Paths.resourcesBundle, 'BepInExOSXLoader/Tobey.BepInEx.Bootstrap.dll'),
        minVersion: '1.23.0',
      } : undefined,
      path: globalState.config.game_installDirectory,
    })
  },
}
