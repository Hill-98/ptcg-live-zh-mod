import { app, BrowserWindow, dialog } from 'electron';
import { dirname } from 'node:path';

const parseArguments = function parseArguments(options, window) {
    const o = parseOptions(options);
    return {
        first: window instanceof BrowserWindow ? window : o,
        second: window instanceof BrowserWindow ? o : undefined,
        options: o,
    }
};

const parseOptions = function parseOptions(options) {
    const opts = typeof options === 'object' ? options : {};
    try {
        if (typeof opts.defaultPath === 'string' && opts.defaultPath.startsWith('~')) {
            opts.defaultPath = app.getPath(opts.defaultPath.replace('~', ''))
        }
    } catch {
    }
    return opts;
};

export const SelectDirectory = async function SelectDirectory(options, window) {
    const args = parseArguments(options, window);
    const properties = args.options.properties ?? [];
    const result = await dialog.showOpenDialog(args.first, args.second);
    if (result.canceled) {
        return null;
    }
    let paths = result.filePaths;
    if (!properties.includes('openDirectory')) {
        paths = paths.map((v) => dirname(v));
    }
    return properties.includes('multiSelections') ? paths : paths.shift();
};

export const SelectFile = async function SelectFile(options, window) {
    const args = parseArguments(options, window);
    const properties = args.options.properties ?? [];
    args.options.properties = properties.filter((v) => v !== 'openDirectory');
    const result = await dialog.showOpenDialog(args.first, args.second);
    if (result.canceled) {
        return null;
    }
    return properties.includes('multiSelections') ? result.filePaths : result.filePaths.shift();
};

export default {
    SelectDirectory,
    SelectFile,
}
