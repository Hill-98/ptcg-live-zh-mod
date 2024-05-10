import { release } from 'node:os';
const versions = release().split('.').map((v) => Number.parseInt(v)).map((v) => Number.isNaN(v) ? 0 : v);

export const isLinux = process.platform === 'linux';
export const isOSX = process.platform === 'darwin';
export const isWindows = process.platform === 'win32';
export const isWindows11 = isWindows && versions.length === 3 && versions[2] >= 22000;
