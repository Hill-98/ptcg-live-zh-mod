import { createIpcServer } from 'electron-ipc-flow'
import type { AppClientEvents, AppIpc, GameIpc } from '../types.ts'

export const app = createIpcServer<AppIpc, AppClientEvents>('app')

export const game = createIpcServer<GameIpc>('game')
