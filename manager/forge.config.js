const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { createHash } = require('node:crypto');
const { join, parse } = require('node:path');
const fs = require('node:fs');
const pkg = require('./package.json');

const KEEP_LANGUAGES = ['en', 'en-US', 'zh_CN', 'zh-CN', 'zh_TW', 'zh-TW'];
const NO_ASAR = ['yes', 'true'].includes(process.env.NO_ASAR ?? 'x');

const deleteUselessLanguageFile = function deleteUselessLanguageFile(ext, item) {
    const fullPath = join(item.path, item.name);
    const path = parse(fullPath);
    if (path.ext === '.' + ext && !KEEP_LANGUAGES.includes(path.name)) {
        fs.rmSync(fullPath, { recursive: true });
    }
};
const unpackDirs = ['bin', 'files'];

/** @type {ForgeConfig} */
const config = {
    packagerConfig: {
        appBundleId: pkg.name,
        appCopyright: 'Copyright (c) 2024 Hill-98@GitHub',
        appVersion: pkg.version,
        icon: join(__dirname, 'icons/app'),
        name: pkg.productName,
        asar: NO_ASAR ? false : {
            unpack: join('**', `{${unpackDirs.join(',')}}`, '**'),
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
        packageAfterPrune(config, buildPath) {
            const checksums = fs.readdirSync(buildPath, { recursive: true })
                .map((path) => path.replaceAll('\\', '/'))
                .filter((path) => fs.statSync(join(buildPath, path)).isFile())
                .filter((path) => {
                    if (path.match(/\/\.gitignore$/)) {
                        fs.rmSync(join(buildPath, path));
                        return false;
                    }
                    return unpackDirs.find((dir) => path.startsWith(`${dir}/`));
                })
                .map((path) => ({
                    path,
                    hash: createHash('sha1').update(fs.readFileSync(join(buildPath, path))).digest('hex'),
                }));
            fs.writeFileSync(join(buildPath, 'checksums.json'), JSON.stringify(checksums), { encoding: 'utf8' });
        },
        postPackage(config, packageResult) {
            const outPath = packageResult.outputPaths[0];
            const contentsPath = packageResult.platform === 'darwin' ? join(outPath, (config.packagerConfig.name || pkg.name) + '.app', 'Contents') : outPath;
            const resourcesPath = join(contentsPath, 'Resources');

            fs.renameSync(join(outPath, 'LICENSE'), join(outPath, 'LICENSE.electron.txt'));
            fs.copyFileSync(join(__dirname, '..', 'LICENSE'), join(outPath, 'LICENSE.txt'));
            fs.rmSync(join(outPath, 'version'));
            if (packageResult.platform === 'darwin') {
                [
                    ...fs.readdirSync(join(contentsPath, 'Frameworks/Electron Framework.framework/Versions/Current/Resources'), { withFileTypes: true }),
                    ...fs.readdirSync(resourcesPath, { withFileTypes: true }),
                ].forEach(deleteUselessLanguageFile.bind(this, 'lproj'));
            } else if (packageResult.platform === 'win32') {
                fs.readdirSync(join(outPath, 'locales'), { withFileTypes: true })
                    .forEach(deleteUselessLanguageFile.bind(this, 'pak'));
            }
        },
    },
};

module.exports = config;
