import { existsSync as exists } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getFileVersion } from 'cfv'
import { compare } from 'compare-versions'
import  Ini from 'ini'
import UnzipFile from './UnzipFile.ts'

const BepInExFiles = [
  'BepInEx',
  '.doorstop_version',
  'changelog.txt',
  'doorstop_config.ini',
  'libdoorstop.so',
  'libdoorstop.dylib',
  'run_bepinex.sh',
  'winhttp.dll',
]

const BepInExCoreFiles = [
  '0Harmony.dll',
  '0Harmony20.dll',
  'BepInEx.Harmony.dll',
  'BepInEx.Preloader.dll',
  'BepInEx.dll',
  'HarmonyXInterop.dll',
  'Mono.Cecil.Mdb.dll',
  'Mono.Cecil.Pdb.dll',
  'Mono.Cecil.Rocks.dll',
  'Mono.Cecil.dll',
  'MonoMod.RuntimeDetour.dll',
  'MonoMod.Utils.dll',
]

export default class BepInExManager {
  static #BepInExFile: string = ''

  static #BepInExVersion: string = '0.0.0.0'

  readonly #installPath: string

  readonly #paths = {
    BepInEx: '',
    cache: '',
    core: '',
    config: '',
    patchers: '',
    plugins: '',
    LogOutput: '',
  }

  constructor(path: string) {
    const bepInExDir = join(path, 'BepInEx')
    this.#installPath = path
    this.#paths = {
      BepInEx: bepInExDir,
      cache: join(bepInExDir, 'cache'),
      core: join(bepInExDir, 'core'),
      config: join(bepInExDir, 'config'),
      patchers: join(bepInExDir, 'patchers'),
      plugins: join(bepInExDir, 'plugins'),
      LogOutput: join(bepInExDir, 'LogOutput.log'),
    }
  }

  get paths() {
    return this.#paths
  }

  #getPluginPaths(name: string): string[] {
    return [
      join(this.paths.plugins, name.concat('.dll')),
      join(this.paths.plugins, name, name.concat('.dll')),
      join(this.paths.plugins, name.concat('.dll.disable')),
      join(this.paths.plugins, name, name.concat('.dll.disable'))
    ]
  }

  async configPlugin<T extends boolean | number | string>(name: string, section: string | null, key: string, value?: T): Promise<T | undefined> {
    let config: any = Object.create(null)
    const file = [
      join(this.paths.config, name.concat('.cfg')),
      join(this.paths.config, name.concat('.ini'))
    ].find((v) => exists(v))

    if (typeof file === 'undefined') {
      throw new Error(`${name} config file not found.`)
    }

    try {
      config = Ini.parse(await readFile(file, { encoding: 'utf-8' }))
    } catch (err) {
      console.error(err)
    }

    const s = section ? config[section] : config

    if (typeof value !== 'undefined') {
      s[key] = value
      await writeFile(file, Ini.stringify(config, { whitespace: true }))
    }

    return s[key] as T
  }

  async disablePlugin(name: string, disable: boolean): Promise<void> {
    const dlls = this.#getPluginPaths(name)
    for (const dll of dlls) {
      if (!exists(dll)) {
        continue
      }
      if (disable && dll.endsWith('.dll')) {
        await rename(dll, dll.concat('.disable'))
      }
      if (!disable && dll.endsWith('.disable')) {
        await rename(dll, dll.replace(/\.disable$/, ''))
      }
    }
  }

  async getPlugins(): Promise<string[]> {
    if (!exists(this.paths.plugins)) {
      return []
    }
    return (await readdir(this.paths.plugins))
      .filter((file: string) => !file.startsWith('.'))
      .map((file: string) => file.replace(/\.dll(\.disable)?$/, ''))
  }

  async getPluginPath(name: string): Promise<string | undefined> {
    return this.#getPluginPaths(name).find((dll) => exists(dll))
  }

  async getPluginVersion(name: string): Promise<string | undefined> {
    const dll = await this.getPluginPath(name)
    if (typeof dll !== 'string') {
      return undefined
    }
    try {
      return await getFileVersion(dll);
    } catch (err) {
      console.error(err)
    }
    return undefined
  }

  async install(): Promise<void> {
    if (!exists(this.#installPath)) {
      await mkdir(this.#installPath, { recursive: true })
    }
    const bep = BepInExManager.#BepInExFile
    if (bep === '' || !exists(bep)) {
      throw new Error('BepInEx installation package not found')
    }
    await new UnzipFile(bep).extract(this.#installPath)
  }

  async installPlugin(name: string, source: string): Promise<void> {
    if (!exists(this.paths.plugins)) {
      await mkdir(this.paths.plugins, { recursive: true })
    }
    const isDirectory = (await stat(source)).isDirectory()
    if (isDirectory) {
      const files = await readdir(source, { recursive: true })
      for (const file of files) {
        const path = join(source, file)
        const state = await stat(path)
        if (state.isDirectory()) {
          await mkdir(join(this.paths.plugins, name, file), { recursive: true })
        } else {
          await cp(path, join(this.paths.plugins, name, file))
        }

      }
    } else if (source.endsWith('.dll')) {
      await cp(source, join(this.paths.plugins, name.concat('.dll')))
    } else if (source.endsWith('.zip')) {
      await new UnzipFile(source).extract(join(this.paths.plugins, name))
    } else {
      throw new Error('Unsupported plugin source type.')
    }
  }

  isInstalled(): boolean {
    const loader = process.platform === 'win32'
      ? join(this.#installPath, 'winhttp.dll')
      : join(this.#installPath, `libdoorstop.${process.platform === 'darwin' ? 'dylib' : 'so'}`)
    if (!exists(loader)) {
      return false
    }
    return BepInExCoreFiles.every((v) => exists(join(this.paths.core, v)))
  }

  async isUpgradable(): Promise<boolean> {
    if (!this.isInstalled()) {
      return false
    }
    try {
      const version = await getFileVersion(join(this.paths.core, 'BepInEx.dll'))
      return compare(BepInExManager.BepInExVersion, version, '>')
    } catch (err) {
      console.error(err)
    }
    return false
  }

  pluginIsDisabled(name: string): boolean {
    return this.#getPluginPaths(name).some((v) => exists(v.concat('.disable')))
  }

  pluginIsInstalled(name: string): boolean {
    return this.#getPluginPaths(name).some((v) => exists(v))
  }

  async uninstall(): Promise<void> {
    for (const file of BepInExFiles) {
      const path = join(this.#installPath, file)
      if (exists(path)) {
        await rm(path, { recursive: true })
      }
    }
  }

  async uninstallPlugin(name: string, purge: boolean = true): Promise<void> {
    const paths = this.#getPluginPaths(name)
    if (purge) {
      paths.push(
        join(this.paths.config, name.concat('.cfg')),
        join(this.paths.config, name.concat('.ini')),
      )
    }
    for (const path of paths) {
      if (exists(path)) {
        await rm(path)
      }
    }
    const path = join(this.paths.plugins, name)
    if (purge && exists(path)) {
      await rm(path, { recursive: true })
    }
  }

  static get BepInExVersion(): string {
    return BepInExManager.#BepInExVersion
  }

  static setBepInExFilePath(path: string): void {
    const tempDir = join(tmpdir(), `BepInExManager.${process.pid}`)

    new UnzipFile(path).extract(tempDir, ['BepInEx/core/BepInEx.dll'])
      .then(() => getFileVersion(join(tempDir, 'BepInEx/core/BepInEx.dll')))
      .then((version: string) => {
        BepInExManager.#BepInExVersion = version
      })
      .catch((err: Error) => {
        console.error(err)
      })
      .finally(() => rm(tempDir, { recursive: true }))
    BepInExManager.#BepInExFile = path
  }
}
