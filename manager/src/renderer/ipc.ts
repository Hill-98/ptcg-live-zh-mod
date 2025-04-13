import { IpcClientController } from 'electron-ipc-flow'
import type { AppClientEvents, AppIpc, GameIpc } from '../types.ts'

export const app = new IpcClientController<AppIpc, AppClientEvents>('app')

export const game = new IpcClientController<GameIpc>('game')
