import { app, BrowserWindow, dialog } from 'electron';
import { dirname } from 'node:path';

export default function selectDirectory (dialogOptions, window) {
    const dOpts = typeof dialogOptions === 'object' ? dialogOptions : {};
    try {
        dOpts.defaultPath = typeof dOpts.defaultPath === 'string' && dOpts.defaultPath.startsWith('~')
            ? app.getPath(dOpts.defaultPath.replace('~', ''))
            : dOpts.defaultPath;
    } catch {
    }
    const properties = dOpts.properties ?? [];
    let result = window instanceof BrowserWindow ? dialog.showOpenDialogSync(window, dOpts) : dialog.showOpenDialogSync(dOpts);
    if (typeof result === 'undefined') {
        return null;
    }
    if (!properties.includes('openDirectory')) {
        result = result.map((v) => dirname(v));
    }
    return properties.includes('multiSelections') ? result : result.shift();
};
