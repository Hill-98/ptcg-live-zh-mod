import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os';
import { join, normalize, parse } from 'node:path';
import { isOSX } from '../isOS.mjs';
import { all as unzip, single as unzipSingle } from '../utils/unzip.mjs';
import cfv from 'cfv';
import fs from 'node:fs';
import versionParse from '../utils/versionParse.mjs';

let BepInExPackage = 'BepInEx.zip';
let OSXLoaderCore = 'UnityEngine.CoreModule.dll';
let OSXLoader = 'Tobey.BepInEx.Bootstrap.dll';

export default class BepInExManager {
    #appPath = '';

    #BepInExPaths = {
        config: '',
        core: '',
        coreDll: '',
        plugins: '',
        root: '',
    };

    #loaderDllPath = '';

    #OSXLoaderCorePath = '';

    #root = '';

    #topFiles = [];

    constructor(root, appPath = '') {
        this.#root = normalize(root);

        if (!fs.existsSync(this.#root)) {
            throw new Error('root not found');
        }

        if (typeof appPath === 'string' && appPath.trim() !== '') {
            this.#appPath = normalize(appPath);
        } else {
            this.#appPath = this.#root;
        }

        const bepInExPath = join(this.#root, 'BepInEx');
        this.#BepInExPaths = {
            config: join(bepInExPath, 'config'),
            core: join(bepInExPath, 'core'),
            coreDll: join(bepInExPath, 'core/BepInEx.dll'),
            plugins: join(bepInExPath, 'plugins'),
            root: bepInExPath,
        };
        this.#loaderDllPath = join(this.#appPath, isOSX ? 'Contents/Resources/Data/Managed/Tobey.BepInEx.Bootstrap.dll' : 'winhttp.dll');
        this.#OSXLoaderCorePath = join(this.#appPath, 'Contents/Resources/Data/Managed/UnityEngine.CoreModule.dll');
        this.#topFiles = [
            join(this.#root, '.doorstop_version'),
            join(this.#root, 'changelog.txt'),
            join(this.#root, 'doorstop_config.ini'),
            join(this.#root, 'libdoorstop.dylib'),
            join(this.#root, 'run_bepinex.sh'),
            join(this.#root, 'winhttp.dll'),
        ];
    }

    #deleteCommonFiles() {
        this.#topFiles.forEach((file) => {
            if (fs.existsSync(file)) {
                fs.rmSync(file);
            }
        });
    }

    getPluginConfig(name) {
        const path = join(this.#BepInExPaths.config, name + '.cfg');
        try {
            const stat = fs.statSync(path);
            if (stat.isFile()) {
                return path;
            }
        } catch {
        }
        return null;
    }

    getPluginDir(name) {
        const dir = join(this.#BepInExPaths.plugins, name);
        try {
            const stat = fs.statSync(dir);
            if (stat.isDirectory()) {
                return dir;
            }
        } catch {
        }
        return null;
    }

    getPluginDll(name) {
        const dll = join(this.#BepInExPaths.plugins, name + '.dll');
        if (fs.existsSync(dll)) {
            return dll;
        }
        const dllInDir = join(this.#BepInExPaths.plugins, name, name + '.dll');
        if (fs.existsSync(dllInDir)) {
            return dllInDir;
        }
        return null;
    }

    async install() {
        const onerror = (err) => {
            try {
                this.uninstall(false);
            } catch (err) {
                console.error(err);
            }
            throw err;
        };

        try {
            await unzip(BepInExPackage, this.#root);
            if (isOSX) {
                this.#deleteCommonFiles();
                this.#installOSXLoader();
            }
        } catch (err) {
            onerror(err);
        }
    }

    #installOSXLoader() {
        if (!fs.existsSync(this.#OSXLoaderCorePath)) {
            throw new Error(`'${this.#OSXLoaderCorePath}' not found`);
        }
        if (!this.#OSXLoaderPatched()) {
            fs.cpSync(this.#OSXLoaderCorePath, this.#OSXLoaderCorePath + '.orig', { errorOnExist: false, force: true });
        }
        fs.cpSync(OSXLoaderCore, this.#OSXLoaderCorePath, { force: true });
        fs.cpSync(OSXLoader, this.#loaderDllPath, { force: true });
    }

    async installPlugin(name, source) {
        const stats = fs.statSync(source);
        const path = parse(source);
        const plugin = join(this.#BepInExPaths.plugins, path.name + path.ext);
        const pluginDir = join(this.#BepInExPaths.plugins, path.name);

        const onerror = (err) => {
            this.uninstallPlugin(name);
            throw err;
        };

        if (stats.isDirectory()) {
            if (!fs.existsSync(pluginDir)) {
                fs.mkdirSync(pluginDir, { recursive: true });
            }
            try {
                fs.readdirSync(source).forEach((file) => {
                    fs.cpSync(join(source, file), join(pluginDir, file), { force: true, recursive: true });
                });
            } catch (err) {
                onerror(err);
            }
        } else if (stats.isFile()) {
            if (path.ext === '.zip') {
                if (!fs.existsSync(pluginDir)) {
                    fs.mkdirSync(pluginDir, { recursive: true });
                }
                try {
                    await unzip(source, pluginDir);
                } catch (err) {
                    onerror(err);
                }
            } else {
                fs.cpSync(source, plugin, { force: true });
            }
        } else {
            throw new Error('Unsupported source file type');
        }
    }

    isInstalled() {
        if (!fs.existsSync(this.#BepInExPaths.coreDll) || !fs.existsSync(this.#loaderDllPath)) {
            return false;
        }

        if (isOSX) {
            return this.#OSXLoaderPatched();
        }

        return true;
    }

    async isUpdatable() {
        if (!this.isInstalled() || !fs.existsSync(BepInExPackage)) {
            return Promise.resolve(false);
        }

        try {
            const localVersion = await cfv.getFileVersion(this.#BepInExPaths.coreDll);
            const tmpDll = join(tmpdir(), 'BepInEx-core' + Math.random());
            await unzipSingle(BepInExPackage, 'BepInEx/core/BepInEx.dll', tmpDll);
            const remoteVersion = await cfv.getFileVersion(tmpDll);
            return versionParse(localVersion) < versionParse(remoteVersion);
        } catch (err) {
            console.error(err);
        }

        return false;
    }

    #OSXLoaderPatched() {
        try {
            const core = fs.readFileSync(this.#OSXLoaderCorePath)
            const loaderCore = fs.readFileSync(OSXLoaderCore)
            return createHash('md5').update(core).digest('hex') === createHash('md5').update(loaderCore).digest('hex');
        } catch {
            return false;
        }
    }

    pluginInstalled(name) {
        return this.getPluginDll(name) !== null;
    }

    uninstall(withInstalledPlugin = false) {
        this.#deleteCommonFiles();
        if (isOSX) {
            if (!this.#OSXLoaderPatched()) {
                fs.rmSync(this.#OSXLoaderCorePath, { force: true });
                fs.rmSync(this.#loaderDllPath, { force: true });
                if (fs.existsSync(this.#OSXLoaderCorePath + '.orig')) {
                    fs.cpSync(this.#OSXLoaderCorePath + '.orig', this.#OSXLoaderCorePath);
                    fs.rmSync(this.#OSXLoaderCorePath + '.orig');
                }
            }
        }

        try {
            if (withInstalledPlugin) {
                fs.rmSync(this.#BepInExPaths.root, { force: true, recursive: true });
            } else {
                fs.rmSync(this.#BepInExPaths.core, { force: true, recursive: true });
            }
        } catch {

        }
    }

    uninstallPlugin(name) {
        const dll = this.getPluginDll(name);
        if (dll !== null) {
            fs.rmSync(dll);
        }
        const dir = this.getPluginDir(name);
        if (dir !== null) {
            fs.rmSync(dir, { recursive: true });
        }
    }

    static setBepInExPackage(files) {
        if (typeof files !== 'object') {
            return;
        }
        if (typeof files.BepInEx === 'string' && fs.existsSync(files.BepInEx)) {
            BepInExPackage = files.BepInEx;
        }
        if (typeof files.OSXLoader === 'string' && fs.existsSync(files.OSXLoader)) {
            OSXLoader = files.OSXLoader;
        }
        if (typeof files.OSXLoaderCore === 'string' && fs.existsSync(files.OSXLoaderCore)) {
            OSXLoaderCore = files.OSXLoaderCore;
        }
    }
}
