import { spawn, type SpawnOptions } from 'node:child_process'
import { existsSync as exists } from 'node:fs'
import { cp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { compare } from 'compare-versions'
import { app } from 'electron'
import plist from 'plist'
import { bin } from '../Paths.ts'

interface ExecResult {
  status: number
  stderr: string
  stdout: string
}

interface StartOptions {
  macos?: {
    bepinex: string
    core: string
    loader: string
    minVersion: string
  }
  path: string
}

const extUtil = join(bin, 'NeuExt.PTCGLUtility.exe')

const is = {
  darwin: process.platform === 'darwin',
  win32: process.platform === 'win32',
}

export async function clearUnityCache() {
  if (is.darwin) {
    const path = join(process.env.HOME ?? app.getPath('home'), 'Library/Caches/com.pokemon.pokemontcgl')
    if (exists(path)) {
      await rm(path, { recursive: true })
    }
  }
  if (is.win32) {
    const path = join(process.env.USERPROFILE ?? app.getPath('home'), 'AppData\\LocalLow\\Unity\\pokemon_Pokemon TCG Live')
    if (exists(path)) {
      await rm(path, { recursive: true })
    }
  }
}

function exec(file: string, args?: string[], options?: SpawnOptions): Promise<ExecResult> {
  const result = {
    status: -1,
    stderr: '',
    stdout: '',
  }

  if (!exists(file)) {
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    const process = spawn(file, args ?? [], { stdio: 'pipe', ...options })

    process.stderr?.setEncoding('utf-8')
    process.stderr?.on('data', (data: string) => {
      result.stderr += data
    })
    process.stdout?.setEncoding('utf-8')
    process.stdout?.on('data', (data: string) => {
      result.stdout += data
    })
    process.once('error', reject)
    process.once('close', (code) => {
      result.status = code ?? -1
      resolve(result)
    })
  })
}

export async function extUtilIsAvailable(): Promise<boolean> {
  if (!is.win32) {
    return true
  }
  return new Promise<boolean>((resolve) => {
    let timeout = false
    const timer = setTimeout(() => {
      timeout = true
      resolve(false)
    }, 1000 * 10)
    exec(extUtil, ['--help']).then((result) => {
      if (!timeout) {
        clearTimeout(timer)
        resolve(result.status >= 0)
      }
    })
  })
}

export async function detectInstallDirectory(): Promise<string | undefined> {
  if (is.darwin) {
    return ['/', app.getPath('home')]
      .map((v) => join(v, 'Applications/Pokemon TCG Live.app'))
      .find((v) => isInstallDirectory(v))

  }
  if (is.win32) {
    try {
      const result = await exec(extUtil, ['DetectPTCGLInstallDirectory'])
      if (result.status === 0) {
        const dir = decodeURIComponent(result.stdout.trim())
        return isInstallDirectory(dir) ? dir : undefined
      }
    } catch (err) {
      console.error(err)
    }
  }

  return undefined
}

export function getExecutable(): string {
  return is.darwin ? 'Contents/MacOS/Pokemon TCG Live' : 'Pokemon TCG Live.exe'
}

export function isInstallDirectory(dir: string): boolean {
  if (dir.trim() === '') {
    return false
  }
  return exists(join(dir, getExecutable()))
}

export async function running(): Promise<boolean> {
  try {
    if (is.win32) {
      const result = await exec(extUtil, ['CheckPTCGLIsRunning'])
      return result.status === 0 && result.stdout.trim() === '1'
    }
    if (is.darwin) {
      const result = await exec('/bin/ps', ['-A'])
      return result.status === 0 && result.stdout.includes(getExecutable())
    }
  } catch (err) {
    console.error(err)
  }
  return false
}

export async function start(options: StartOptions): Promise<void> {
  const oldLoader = join(options.path, 'Contents/Resources/Data/Managed/Tobey.BepInEx.Bootstrap.dll')
  if (exists(oldLoader)) {
    await rm(oldLoader)
  }
  const loader = join(options.path, 'Contents/Resources/Data/Managed/BepInEx.Bootstrap.dll')
  if (options.macos && process.platform === 'darwin') {
    const info = plist.parse(await readFile(join(options.path, 'Contents/Info.plist'), { encoding: 'utf-8' })) as Record<string, any>
    const installedVersion = typeof info.CFBundleShortVersionString === 'string' ? info.CFBundleShortVersionString : '999.999.999'
    if (compare(installedVersion, options.macos.minVersion, '>=')) {
      await cp(options.macos.core, join(options.path, 'Contents/Resources/Data/Managed/UnityEngine.CoreModule.dll'))
      await cp(options.macos.loader, loader)
    } else {
      throw new Error('The game version is too low, please update to the latest version.')
    }
    await exec('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', options.path])
  }
  return new Promise((resolve, reject) => {
    spawn(join(options.path, getExecutable()), [], {
      cwd: process.platform === 'darwin' ? options.macos?.bepinex : options.path,
      detached: true,
      env: {
        ...process.env,
        BEPINEX_ROOT_PATH: options.macos?.bepinex,
        TOBEY_BEPINEX_LOADER: loader,
      },
    }).once('error', reject).once('spawn', resolve)
  })
}
