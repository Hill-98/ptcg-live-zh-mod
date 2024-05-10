import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { join, normalize } from 'node:path';
import { isOSX, isWindows, isWindows11 } from './js-node/isOS.mjs';
import { extract as TarExtract, list as TarList } from 'tar';
import AppUnpackPath from './js-node/AppUnpackPath.mjs';
import BepInExManager from './js-node/lib/BepInExManager.mjs';
import cfv from 'cfv';
import fs from 'node:fs';
import isDev from 'electron-is-dev';
import { processWrapper as processIpcWrapper, wrapper as ipcWrapper } from './js-node/ipcUtils.mjs';
import PTCGLUtility from './js-node/utils/PTCGLUtility.mjs';
import SelectDirectory from './js-node/utils/selectDirectory.mjs';

const APP_FILES_DIR = join(AppUnpackPath, 'files');
const OSX_SHORTCUT = join(app.getPath('desktop'), 'PTCGL 中文版.app');
const PLUGIN_NAME = 'PTCGLiveZhMod';

let PTCGL_INSTALL_DIR = '';
let PTCGL_ROOT_INSTALL_DIR = '';

/** @type {BepInExManager|null} */
let BepInEx = null;

const createMainWindow = async function createMainWindow() {
    const mainWindow = new BrowserWindow({
        title: app.getName(),
        icon: join(app.getAppPath(), 'icons', isWindows ? 'app.ico' : 'app.png'),
        backgroundColor: isWindows11 ? undefined : '#f3f3f3',
        backgroundMaterial: isWindows11 ? 'mica' : 'auto',
        width: 600,
        height: 400,
        resizable: false,
        show: false,
        useContentSize: true,
        webPreferences: {
            defaultFontFamily: {},
            preload: join(app.getAppPath(), 'preload.js'),
        },
    });

    mainWindow.once('ready-to-show', () => {
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
    const b = getBepInExManager();
    const pluginDir = b?.getPluginDir(PLUGIN_NAME);
    return pluginDir ? join(pluginDir, 'assets') : null;
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

const getBepInExManager = function getBepInExManager() {
    if (BepInEx === null) {
        try {
            BepInEx = new BepInExManager(PTCGL_ROOT_INSTALL_DIR, PTCGL_INSTALL_DIR);
        } catch {
            return null;
        }
    }
    return BepInEx;
};

const getPluginSwitchState = function () {
    const pluginDir = getBepInExManager()?.getPluginDir(PLUGIN_NAME);
    const file = join(pluginDir ?? 'x', 'disabled');
    return pluginDir !== null && fs.existsSync(file);
};

const installAssets = async function installAssets(ev) {
    const assetsDir = getAssetsInstallDir();
    if (assetsDir === null) {
        throw new Error ('assets dir is null.');
    }

    const dialogResult = dialog.showOpenDialogSync(BrowserWindow.fromId(ev.frameId), {
        title: '选择中文化卡牌图片资源包',
        defaultPath: app.getPath('downloads'),
        filters: [
            {
                name: '中文化卡牌图片资源包',
                extensions: ['assets.tar.br'],
            },
        ],
    });
    if (!dialogResult) {
        return;
    }

    const file = dialogResult.shift();
    const ipc = processIpcWrapper('installAssets', ev.sender, 1000);
    let totalEntryCount = 0;
    let extractedEntryCount = 0;

    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
    }

    ipc.emit('x');
    await TarList({
        file,
        onentry() {
            totalEntryCount++;
        },
        onwarn: console.warn,
    });

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
    if (isOSX) {
        if (!PTCGLUtility.SyncGameVersion(PTCGL_INSTALL_DIR)) {
            throw new Error('SyncGameVersion is failed.');
        }
    }
    const b = getBepInExManager();
    if (b === null) {
        throw new Error('BepInExManager is null.');
    }

    b.uninstallPlugin('ptcg-live-zh-mod');

    if (!b.isInstalled() || await b.isUpdatable()) {
        await b.install();
    }

    if (!fs.existsSync(OSX_SHORTCUT)) {
        fs.symlinkSync(PTCGL_INSTALL_DIR, OSX_SHORTCUT);
    }

    await b.installPlugin(PLUGIN_NAME, join(APP_FILES_DIR, PLUGIN_NAME));
};

const pluginInstalled = function pluginInstalled() {
    const b = getBepInExManager();
    return b?.isInstalled() && b?.pluginInstalled(PLUGIN_NAME);
};

const selectDirectory = function selectDirectory(ev) {
    const dir = SelectDirectory({
        title: '选择 Pokémon TCG Live 安装目录',
        defaultPath: '~desktop',
        filters: [
            {
                name: 'Pokemon TCG Live.exe',
                extensions: ['exe'],
            },
        ],
    }, BrowserWindow.fromId(ev.frameId));
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
    const pluginDir = getBepInExManager()?.getPluginDir(PLUGIN_NAME);
    if (pluginDir === null) {
        throw new Error('plugin dir is null.');
    }

    const file = join(pluginDir, 'disabled');
    if (disable) {
        fs.writeFileSync(file, 'disabled');
    } else {
        fs.rmSync(file, { force: true });
    }
};

const uninstallPlugin = function (withBepInEx) {
    const b = getBepInExManager();
    if (b === null) {
        throw new Error('BepInExManager is null.');
    }

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
    fs.rmSync(OSX_SHORTCUT, { force: true });
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
    BepInEx: join(APP_FILES_DIR, isWindows ? 'BepInEx_x64_5.4.22.0.zip' : 'BepInEx_unix_5.4.22.0.zip'),
    OSXLoader: join(APP_FILES_DIR, 'BepInExOSXLoader/Tobey.BepInEx.Bootstrap.dll'),
    OSXLoaderCore: join(APP_FILES_DIR, 'BepInExOSXLoader/UnityEngine.CoreModule.dll'),
});

app.whenReady().then(() => {
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
