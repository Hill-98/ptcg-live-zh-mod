import { IpcServerController } from 'electron-ipc-flow'

export interface AppIpc {
  checkPluginAssets(): Promise<boolean | undefined>
  disablePlugin(disable?: boolean): Promise<boolean>
  gameInstallDirectory(dir?: string): string
  installPlugin(): Promise<void>
  installPluginAssets(file: string): Promise<void>
  pluginFeature(name: 'EnableCardGraphicText', value?: boolean): Promise<boolean | undefined>
  pluginInstalled(): boolean
  pluginUpgradable(): Promise<boolean>
  uninstallPlugin(): Promise<void>
  selectGameInstallDirectory(): Promise<string | undefined>
  selectPluginAssetsPackage(): Promise<string | number>
  termsOfUseVersion(version?: number): number
  version(): Promise<string>
}

export interface AppClientEvents {
  onInstallPluginAssets(progress: string): void
}

export interface GameIpc {
  detectInstallDirectory(): Promise<string | undefined>
  extUtilIsAvailable(): Promise<boolean>
  isInstallDirectory(dir: string): boolean
  running(): Promise<boolean>
  start(): Promise<void>
}

export const app = new IpcServerController<AppIpc, AppClientEvents>('app')

export const game = new IpcServerController<GameIpc>('game')
