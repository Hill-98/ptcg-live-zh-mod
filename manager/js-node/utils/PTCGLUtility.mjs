import { join } from 'node:path';
import { isOSX, isWindows } from '../isOS.mjs';
import fs from 'node:fs';
import plist from 'plist';
import AppUnpackPath from '../AppUnpackPath.mjs';
import Command from '../lib/Command.mjs';
import versionParse from './versionParse.mjs';

const WINDOWS_PTCGL_UTILITY = join(AppUnpackPath, 'bin/NeuExt.PTCGLUtility.exe');

const PTCGLUtility = new Command(WINDOWS_PTCGL_UTILITY, {
    encoding: 'url',
});
const ps = new Command('ps', ['-A']);

export const detectPTCGLInstallDirectory = function detectPTCGLInstallDirectory() {
    if (isWindows) {
        try {
            const result = PTCGLUtility.exec('DetectPTCGLInstallDirectory');
            return result.status === 0 ? result.stdout : null;
        } catch (err) {
            console.error(err);
        }
    } else {
        return '/Applications/Pokemon TCG Live.app';
    }
    return null;
};

export const GetShortcutTarget = function GetShortcutTarget(shortcut) {
    if (isWindows && typeof shortcut === 'string' && shortcut.trim() !== '') {
        try {
            const result = PTCGLUtility.exec('GetShortcutTarget', shortcut);
            console.log(result);
            return result.status === 0 ? result.stdout : null;
        } catch (err) {
            console.error(err);
        }
    }
    return null
};

export const isAvailable = function isAvailable() {
    return isWindows ? PTCGLUtility.isAvailable() : ps.isAvailable();
};

export const isPTCGLInstallDirectory = function isPTCGLInstallDirectory(directory) {
    if (typeof directory !== 'string' || directory.trim() === '') {
        return false;
    }
    return fs.existsSync(join(directory, isWindows ? 'Pokemon TCG Live.exe' : 'Contents/MacOS/Pokemon TCG Live'));
};

export const PTCGLIsRunning = function PTCGLIsRunning() {
    try {
        if (isWindows) {
            const result = PTCGLUtility.exec('CheckPTCGLIsRunning');
            return result.status === 0 && result.stdout === '1';
        } else {
            const result = ps.exec('-A');
            return result.status === 0 && result.stdout.includes('Pokemon TCG Live');
        }
    } catch (err) {
        console.error(err);
    }
    return false;
};

export const SyncGameVersion = function SyncGameVersion(target) {
    const source = '/Applications/Pokemon TCG Live.app';
    if (!isOSX || !fs.existsSync(join(source, 'Contents/MacOS/Pokemon TCG Live'))) {
        return false;
    }

    let needSync = true;
    const sourcePlistFile = join(source, 'Contents/Info.plist');
    const sourcePlist = fs.existsSync(sourcePlistFile) ? plist.parse(fs.readFileSync(sourcePlistFile, { encoding: 'utf8' })) : { CFBundleVersion: '0' };
    const targetPlistFile = join(target, 'Contents/Info.plist');
    const targetPlist = fs.existsSync(targetPlistFile) ? plist.parse(fs.readFileSync(targetPlistFile, { encoding: 'utf8' })) : { CFBundleVersion: '0' };
    if (typeof sourcePlist === 'object' && typeof targetPlist === 'object') {
        const localVersion = versionParse(sourcePlist.CFBundleVersion);
        const targetVersion = versionParse(targetPlist.CFBundleVersion);
        needSync = targetVersion === 0 || localVersion > targetVersion;
    }

    if (needSync) {
        if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true });
        }
        fs.cpSync(source, target, { preserveTimestamps: true, recursive: true });
    }

    return fs.existsSync(join(target, 'Contents/MacOS/Pokemon TCG Live'));
};

export default {
    detectPTCGLInstallDirectory,
    GetShortcutTarget,
    isAvailable,
    isPTCGLInstallDirectory,
    PTCGLIsRunning,
    SyncGameVersion,
};
