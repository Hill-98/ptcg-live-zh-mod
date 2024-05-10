import type { ForgeConfig as _ForgeConfig } from '@electron-forge/shared-types';
import type { IpcRenderer } from 'electron/renderer';

interface CustomOS {
    isOSX: boolean;
    isWindows: boolean;
}

interface AppIPC {
    quit(): void;
}

interface IPC extends IpcRenderer {
    wrapper<T>(channel: string, receive: true, ...args: any): Promise<T>;
    wrapper(channel: string, receive: false, ...args: any): Promise<void>;
}

interface ForgeConfig extends _ForgeConfig {}

declare global {
    interface Window {
        app: AppIPC,
        errorHandler(e: Error | ErrorEvent): void;
        ipc: IPC,
        OS: CustomOS,
    }
}

export {}
