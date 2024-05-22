import { app, BrowserWindow, dialog, Menu, nativeTheme, shell } from 'electron';
import { createHash } from 'node:crypto'
import { join, normalize } from 'node:path';
import { extract as TarExtract, list as TarList } from 'tar';
import { processWrapper as processIpcWrapper, wrapper as ipcWrapper } from './js-node/ipcUtils.mjs';
import { isOSX, isWindows, isWindows11 } from './js-node/isOS.mjs';
import { SelectDirectory, SelectFile } from './js-node/utils/SelectDialog.mjs';
import cfv from 'cfv';
import isDev from 'electron-is-dev';
import fs from 'node:fs';
import AppUnpackPath from './js-node/AppUnpackPath.mjs';
import BepInExManager from './js-node/lib/BepInExManager.mjs';
import PTCGLUtility from './js-node/utils/PTCGLUtility.mjs';

const DARK_BACKGROUND_COLOR = '#2f3542';
const LIGHT_BACKGROUND_COLOR = '#f3f3f3';

const APP_FILES_DIR = join(AppUnpackPath, 'files');
const OSX_SHORTCUT = join(app.getPath('desktop'), 'PTCGL 中文版.app');
const NO_WINDOW_EFFECT = !isWindows11 || process.argv.includes('--no-window-effect');
const PLUGIN_NAME = 'PTCGLiveZhMod';

let PTCGL_INSTALL_DIR = '';
let PTCGL_ROOT_INSTALL_DIR = '';

/** @type {BepInExManager|null} */
let BepInEx = null;

const checkFilesHash = function checkFilesHash() {
    const checksumsFile = join(app.getAppPath(), 'checksums.json');
    if (!fs.existsSync(checksumsFile)) {
        throw new Error('checksums file does not exist');
    }

    const checksums = JSON.parse(fs.readFileSync(checksumsFile, { encoding: 'utf8' }));
    checksums.forEach((item) => {
        const fullPathWithApp = join(app.getAppPath(), item.path);
        const fullPathWithAppUnpack = join(AppUnpackPath, item.path);
        const path = fs.existsSync(fullPathWithApp)
            ? fullPathWithApp
            : (fs.existsSync(fullPathWithAppUnpack) ? fullPathWithAppUnpack : null);
        if (path === null) {
            throw new Error(`'${item.path}' not found.`);
        }
        const hash = createHash('sha1').update(fs.readFileSync(path)).digest('hex');
        if (hash !== item.hash) {
            throw new Error(`'${item.path}' checksum mismatch.\nexpect: ${item.hash}\nobtain: ${hash}`);
        }
    });
};

const createMainWindow = async function createMainWindow() {
    const mainWindow = new BrowserWindow({
        title: app.getName(),
        icon: join(app.getAppPath(), 'icons', isWindows ? 'app.ico' : 'app.png'),
        backgroundMaterial: NO_WINDOW_EFFECT ? 'none' : 'mica',
        width: 600,
        height: 400,
        resizable: false,
        show: false,
        useContentSize: true,
        webPreferences: {
            preload: join(app.getAppPath(), 'preload.js'),
        },
    });

    const toggleBackgroundColor = function toggleBackgroundColor() {
        mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND_COLOR : LIGHT_BACKGROUND_COLOR);
    };

    mainWindow.once('ready-to-show', () => {
        if (NO_WINDOW_EFFECT) {
            toggleBackgroundColor();
            nativeTheme.on('updated', toggleBackgroundColor);
            mainWindow.once('closed', () => {
                nativeTheme.off('updated', toggleBackgroundColor);
            });
        }

        mainWindow.show();

        if (isDev) {
            setImmediate(mainWindow.webContents.openDevTools.bind(mainWindow.webContents, {
                activate: false,
                mode: 'detach',
            }));
        }
    });

    await mainWindow.loadFile(join(app.getAppPath(), 'index.html'));
};

const detectPTCGLInstallDirectory = function detectPTCGLInstallDirectory() {
    const dir = PTCGLUtility.detectPTCGLInstallDirectory();
    if (!dir || !PTCGLUtility.isPTCGLInstallDirectory(dir)) {
        return false;
    }
    setPTCGLDirectory(dir);
    return true;
};

const getAssetsInstallDir = function () {
    try {
        return join(getPluginDir(), 'assets');
    } catch {
    }
    return null;
};

const getAssetsInstalledVersion = function () {
    const assetsDir = getAssetsInstallDir();
    const versionFile = join(assetsDir ?? 'x', 'version.txt');
    if (assetsDir === null || !fs.existsSync(versionFile)) {
        return null;

    }
    const v = Number.parseInt(fs.readFileSync(versionFile, { encoding: 'ascii' }));
    return Number.isNaN(v) ? null : v;
};

const getBepInExManager = function getBepInExManager(nullThrow = false) {
    if (BepInEx === null) {
        try {
            BepInEx = new BepInExManager(PTCGL_ROOT_INSTALL_DIR, PTCGL_INSTALL_DIR);
        } catch {
            BepInEx = null;
            if (nullThrow) {
                throw new Error('BepInExManager is null');
            }
            return null;
        }
    }
    return BepInEx;
};

const getPluginDir = function getPluginDir() {
    const pluginDir = getBepInExManager()?.getPluginDir(PLUGIN_NAME);
    if (!pluginDir) {
        throw new Error('plugin dir is null.');
    }
    return pluginDir;
};

const getPluginSwitchState = function () {
    return fs.existsSync(join(getPluginDir(), 'disabled'));
};

const installAssets = async function installAssets(ev) {
    const assetsDir = getAssetsInstallDir();
    if (assetsDir === null) {
        throw new Error('assets dir is null.');
    }

    const file = await SelectFile({
        title: '选择中文化卡牌图片资源包',
        defaultPath: '~downloads',
        filters: [
            {
                name: '中文化卡牌图片资源包',
                extensions: ['assets.tar.br'],
            },
        ],
    }, BrowserWindow.fromWebContents(ev.sender));
    if (!file) {
        return;
    }

    const ipc = processIpcWrapper('installAssets', ev.sender, 1000);
    let extractedEntryCount = 0;
    let totalEntryCount = 0;

    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
    }

    ipc.emit('x');
    // noinspection SpellCheckingInspection
    await TarList({
        file,
        onentry() {
            totalEntryCount++;
        },
        onwarn: console.warn,
    });
    // noinspection SpellCheckingInspection
    await TarExtract({
        chmod: false,
        cwd: assetsDir,
        file,
        onentry() {
            extractedEntryCount++;
            ipc.emit((extractedEntryCount / totalEntryCount * 100).toFixed(2));
        },
        onwarn: console.warn,
    });
};

const installPlugin = async function installPlugin() {
    if (isOSX && !PTCGLUtility.SyncGameVersion(PTCGL_INSTALL_DIR)) {
        throw new Error('SyncGameVersion is failed.');
    }

    const b = getBepInExManager(true);
    b.uninstallPlugin('ptcg-live-zh-mod');
    if (!b.isInstalled() || await b.isUpdatable()) {
        await b.install();
    }

    if (isOSX && !fs.existsSync(OSX_SHORTCUT)) {
        fs.symlinkSync(PTCGL_INSTALL_DIR, OSX_SHORTCUT);
    }

    await b.installPlugin(PLUGIN_NAME, join(APP_FILES_DIR, PLUGIN_NAME));
};

const pluginInstalled = function pluginInstalled() {
    const b = getBepInExManager();
    return b?.isInstalled() && b?.pluginInstalled(PLUGIN_NAME);
};

const selectDirectory = async function selectDirectory(ev) {
    const dir = await SelectDirectory({
        title: '选择 Pokémon TCG Live 安装目录',
        defaultPath: '~desktop',
        filters: [
            {
                name: 'Pokemon TCG Live.exe',
                extensions: ['exe'],
            },
        ],
    }, BrowserWindow.fromWebContents(ev.sender));
    if (!dir || !PTCGLUtility.isPTCGLInstallDirectory(dir)) {
        return false;
    }
    setPTCGLDirectory(dir);
    return true;
};

const setPTCGLDirectory = function setPTCGLDirectory(dir) {
    if (typeof dir !== 'string' || dir.trim() === '' || normalize(dir) === '/') {
        return;
    }
    PTCGL_INSTALL_DIR = dir;
    if (isOSX) {
        PTCGL_ROOT_INSTALL_DIR = PTCGL_INSTALL_DIR.replace(/\.app$/, ' BepInEx');
        PTCGL_INSTALL_DIR = PTCGL_ROOT_INSTALL_DIR + '/Pokemon TCG Live.app';
    } else {
        PTCGL_ROOT_INSTALL_DIR = PTCGL_INSTALL_DIR;
    }
    BepInEx = null;
};

const switchPlugin = function (disable) {
    const file = join(getPluginDir(), 'disabled');
    if (disable) {
        fs.writeFileSync(file, 'disabled');
    } else {
        fs.rmSync(file, { force: true, recursive: true });
    }
};

const uninstallPlugin = function (withBepInEx) {
    const b = getBepInExManager(true);

    b.uninstallPlugin(PLUGIN_NAME);
    if (withBepInEx) {
        b.uninstall(true);
        if (isOSX) {
            try {
                fs.rmSync(PTCGL_ROOT_INSTALL_DIR, { recursive: true });
            } catch {
            }
        }
    }

    if (isOSX) {
        fs.rmSync(OSX_SHORTCUT, { force: true });
    }
};

process.on('uncaughtException', (err) => {
    console.error(err);
    debugger;
    if (app.isReady()) {
        dialog.showMessageBoxSync({
            title: app.getName(),
            type: 'error',
            message: '未捕获异常：\n\n' + err.stack,
        });
    }
    app.quit();
});

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

Menu.setApplicationMenu(null);
BepInExManager.setBepInExPackage({
    BepInEx: join(APP_FILES_DIR, 'BepInEx_5.4.22.0.zip'),
    OSXLoader: isOSX ? join(APP_FILES_DIR, 'BepInExOSXLoader/Tobey.BepInEx.Bootstrap.dll') : null,
    OSXLoaderCore: isOSX ? join(APP_FILES_DIR, 'BepInExOSXLoader/UnityEngine.CoreModule.dll') : null,
});

app.whenReady().then(() => {
    if (app.isPackaged) {
        try {
            checkFilesHash();
        } catch (err) {
            dialog.showMessageBoxSync({
                title: app.getName(),
                type: 'error',
                message: '校验文件时发生错误：' + err.message,
            });
            app.quit();
            return;
        }
    }

    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('web-contents-created', (ev, contents) => {
    contents.on('will-navigate', (ev) => {
        ev.preventDefault();
    });
    contents.setWindowOpenHandler(({ url }) => {
        try {
            const u = new URL(url);
            if (u.protocol === 'https:') {
                setImmediate(() => {
                    shell.openExternal(u.toString()).catch(console.error);
                });
            } else if (u.protocol === 'open-path:') {
                const path = decodeURIComponent(u.pathname.substring(1));
                setImmediate(() => {
                    try {
                        if (fs.statSync(path).isDirectory()) {
                            shell.openPath(path).catch(console.error);
                        } else {
                            shell.showItemInFolder(path);
                        }
                    } catch {
                    }
                });
            }
        } catch {
        }
        return { action: 'deny' };
    });
});

app.on('window-all-closed', () => {
    app.quit();
});

ipcWrapper('detectPTCGLInstallDirectory', detectPTCGLInstallDirectory);
ipcWrapper('getAssetsInstalledVersion', getAssetsInstalledVersion);
ipcWrapper('getPTCGLInstallDirectory', () => PTCGL_INSTALL_DIR === '' ? null : PTCGL_INSTALL_DIR);
ipcWrapper('installAssets', installAssets, true);
ipcWrapper('installPlugin', installPlugin);
ipcWrapper('pluginInstalled', pluginInstalled);
ipcWrapper('PTCGLUtilityIsAvailable', PTCGLUtility.isAvailable);
ipcWrapper('PTCGLIsRunning', PTCGLUtility.PTCGLIsRunning);
ipcWrapper('selectDirectory', selectDirectory, true);
ipcWrapper('switchPlugin', switchPlugin);
ipcWrapper('getPluginSwitchState', getPluginSwitchState);
ipcWrapper('uninstallPlugin', uninstallPlugin);

ipcWrapper('versions.manager', () => {
    return {
        app: app.getVersion(),
        electron: process.versions['electron'],
        platform: process.platform,
    };
});
ipcWrapper('versions.mod', function modVersion(installed) {
    return cfv.getFileVersion(installed
        ? getBepInExManager()?.getPluginDll(PLUGIN_NAME)
        : join(APP_FILES_DIR, `${PLUGIN_NAME}/${PLUGIN_NAME}.dll`));
});

ipcWrapper('quit', () => {
    BrowserWindow.getAllWindows().forEach((window) => {
        window.close();
    });
});
