const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { join, parse } = require('node:path');
const fs = require('node:fs');
const info = require('./package.json');

const KEEP_LANGUAGES = ['en', 'en-US', 'zh_CN', 'zh-CN', 'zh_TW', 'zh-TW'];
const NO_ASAR = process.env.NO_ASAR === 'yes';

const deleteUselessLanguageFile = function deleteUselessLanguageFile(ext, item) {
    const fullPath = join(item.path, item.name);
    const path = parse(fullPath);
    if (path.ext === '.' + ext && !KEEP_LANGUAGES.includes(path.name)) {
        fs.rmSync(fullPath, { recursive: true });
    }
};

/** @type {ForgeConfig} */
const config = {
    packagerConfig: {
        appBundleId: info.name,
        appCopyright: 'Copyright (c) 2024 Hill-98@GitHub',
        appVersion: info.version,
        icon: __dirname + '/icons/app',
        name: info.productName,
        asar: NO_ASAR ? false : {
            unpack: join('**', '{bin,files}', '**'),
        },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'win32'],
        },
    ],
    plugins: [
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: !NO_ASAR,
        }),
    ],
    hooks: {
        generateAssets() {
        },
        postPackage(config, packageResult) {
            const outPath = packageResult.outputPaths[0];
            const contentsPath = packageResult.platform === 'darwin' ? join(outPath, (config.packagerConfig.name || info.name) + '.app', 'Contents') : outPath;
            const resourcesPath = join(contentsPath, 'Resources');
            const appAsarUnpackedPath = join(resourcesPath, NO_ASAR ? 'app' : 'app.asar.unpacked');
            const appFilesPath = join(appAsarUnpackedPath, 'files');

            fs.renameSync(join(outPath, 'LICENSE'), join(outPath, 'LICENSE.electron.txt'));
            fs.copyFileSync(join(__dirname, '..', 'LICENSE'), join(outPath, 'LICENSE.txt'));
            fs.rmSync(join(outPath, 'version'));
            if (packageResult.platform === 'darwin') {
                [
                    ...fs.readdirSync(join(contentsPath, 'Frameworks/Electron Framework.framework/Versions/Current/Resources'), { withFileTypes: true }),
                    ...fs.readdirSync(resourcesPath, { withFileTypes: true }),
                ].forEach(deleteUselessLanguageFile.bind(this, 'lproj'));
                fs.rmSync(join(appFilesPath, 'BepInEx_x64_5.4.22.0.zip'));
            } else if (packageResult.platform === 'win32') {
                fs.readdirSync(join(outPath, 'locales'), { withFileTypes: true }).forEach(deleteUselessLanguageFile.bind(this, 'pak'));
                fs.rmSync(join(appFilesPath, 'BepInExOSXLoader'), { recursive: true });
                fs.rmSync(join(appFilesPath, 'BepInEx_unix_5.4.22.0.zip'));
            }
        }
    }
};

module.exports = config;
