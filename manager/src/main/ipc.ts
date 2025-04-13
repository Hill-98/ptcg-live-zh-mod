import { IpcServerController } from 'electron-ipc-flow'
import type { AppClientEvents, AppIpc, GameIpc } from '../types.ts'

export const app = new IpcServerController<AppIpc, AppClientEvents>('app')

export const game = new IpcServerController<GameIpc>('game')
