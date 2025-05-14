import { createIpcClient } from 'electron-ipc-flow'
import type { AppClientEvents, AppIpc, GameIpc } from '../types.ts'

export const app = createIpcClient<AppIpc, AppClientEvents>('app')

export const game = createIpcClient<GameIpc>('game')
