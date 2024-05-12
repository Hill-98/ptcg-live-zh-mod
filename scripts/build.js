#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { basename, dirname, join, parse } = require('path');
const assert = require('assert');
const fs = require('fs');

const ROOT_DIR = dirname(__dirname);
const isOSX = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

const findBinaryInPath = function findBinaryInPath(name) {
    const env = process.env['PATH'] ?? process.env['path'];
    if (typeof env !== 'string' || env.trim() === '') {
        return false;
    }

    const extensions = isWindows ? ['.cmd', '.exe'] : [''];
    const paths = env.split(isWindows ? ';' : ':');

    for (const path of paths) {
        const ext = extensions.find((value) => {
            const fullPath = join(path, name + value);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.accessSync(fullPath, fs.constants.X_OK);
                    return fs.statSync(fullPath).isFile();
                } catch {
                }
            }
            return false;
        });
        if (ext !== undefined) {
            return name + ext;
        }
    }
};

const databasesDir = join(ROOT_DIR, 'databases_zh-CN');
const managerDir = join(ROOT_DIR, 'manager');
const managerBinDir = join(managerDir, 'bin');
const managerFilesDir = join(managerDir, 'files');
const managerModDir = join(managerFilesDir, 'PTCGLiveZhMod');
const modDir = join(ROOT_DIR, 'mod');
const PTCGLUtilityDir = join(ROOT_DIR, 'NeuExt.PTCGLUtility');
const textDir = join(ROOT_DIR, 'text_zh-CN');
const spawnOptions = {
    cwd: ROOT_DIR,
    shell: true,
    stdio: 'inherit',
};

if (fs.existsSync(managerModDir)) {
    fs.rmSync(managerModDir, { recursive: true });
}
fs.mkdirSync(managerModDir);

const curlCLI = findBinaryInPath('curl');

if (process.env.CI === 'true') {
    console.log('- Downloading mod dll');
    if (curlCLI) {
        const dll = join(managerModDir, 'PTCGLiveZhMod.dll');
        const curl = spawnSync(curlCLI, [
            '--connect-timeout',
            '3',
            '--fail',
            '--location',
            '--output',
            dll + '.tmp',
            'https://github.com/Hill-98/ptcg-live-zh-mod/releases/latest/download/PTCGLiveZhMod.dll',
        ], { ...spawnOptions, cwd: modDir });
        assert(curl.status === 0, 'An error occurred while Downloading the mod dll.');
        fs.renameSync(dll + '.tmp', dll);
    } else {
        console.log('* curl does not exist, skip downloading.');
    }
}

if (isWindows) {
    console.log('- Building NeuExt.PTCGLUtility');
    const msbuildCLI = findBinaryInPath('msbuild');
    if (msbuildCLI) {
        const msbuild = spawnSync(msbuildCLI, [
            '-noLogo',
            '-target:Clean,Build',
            '-property:Configuration=Release',
        ], { ...spawnOptions, cwd: PTCGLUtilityDir });
        assert(msbuild.status === 0, 'An error occurred while building the NeuExt.PTCGLUtility.');
        fs.cpSync(join(PTCGLUtilityDir, 'bin/Release/NeuExt.PTCGLUtility.exe'), join(managerBinDir, 'NeuExt.PTCGLUtility.exe'), { force: true });
        fs.cpSync(join(PTCGLUtilityDir, 'bin/Release/NeuExt.PTCGLUtility.exe.config'), join(managerBinDir, 'NeuExt.PTCGLUtility.exe.config'), { force: true });
    } else {
        console.log('* MSBuild.exe does not exist, skip building.');
    }
}

console.log('- Building localization files');
[
    ...fs.readdirSync(databasesDir, { withFileTypes: true }),
    ...fs.readdirSync(textDir, { withFileTypes: true }),
].forEach((file) => {
    const fullPath = join(file.path, file.name);
    const textMap = JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf8' }));
    const path = parse(fullPath);
    const outputFile = join(managerModDir, file.path === databasesDir ? `databases/${path.name}.txt` : `text/${path.name}.txt`);
    const outputFilePath = parse(outputFile);

    console.log('* ' + fullPath);

    if (fs.existsSync(outputFile)) {
        fs.rmSync(outputFile);
    }
    if (!fs.existsSync(outputFilePath.dir)) {
        fs.mkdirSync(outputFilePath.dir);
    }

    for (const key in textMap) {
        const text = textMap[key];
        fs.appendFileSync(outputFile, key + ':' + text + '\n', { encoding: 'utf8' });
    }
});

console.log('- Downloading BepInEx');
const BepInExZipUrl = isWindows
    ? 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.22/BepInEx_x64_5.4.22.0.zip'
    : 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.22/BepInEx_unix_5.4.22.0.zip';
const BepInExZip = join(managerFilesDir, 'BepInEx_5.4.22.0.zip');
if (fs.existsSync(BepInExZip)) {
    console.log('- ' + basename(BepInExZip) + ' already exists, skip downloading.');
} else if (curlCLI) {
    const curl = spawnSync(curlCLI, [
        '--connect-timeout',
        '3',
        '--fail',
        '--location',
        '--output',
        BepInExZip + '.tmp',
        BepInExZipUrl,
    ], spawnOptions);
    assert(curl.status === 0, 'An error occurred while downloading BepInEx.');
    fs.renameSync(BepInExZip + '.tmp', BepInExZip);
} else {
    console.log('* curl does not exist, skip downloading.');
}

console.log('- Copy files to manager');
const fontFileName = 'NotoSansSC_sdf32_optimized_12k_lzma_2019';
if (isOSX) {
    fs.rmSync(join(managerFilesDir, 'BepInExOSXLoader'), { force: true, recursive: true });
    fs.cpSync(join(ROOT_DIR, 'BepInExOSXLoader'), join(managerFilesDir, 'BepInExOSXLoader'), { recursive: true });
}
fs.cpSync(
    join(ROOT_DIR, `fonts/${fontFileName + (isWindows ? '_windows' : '_macos') + '.asset'}`),
    join(managerModDir, `fonts/${fontFileName}`),
    { recursive: true }
);
fs.cpSync(join(ROOT_DIR, 'LICENSE'), join(managerModDir, 'LICENSE'));

console.log('- Building mod manager');
const npmCLI = findBinaryInPath('npm');
const yarnCLI = findBinaryInPath('yarn');
if (npmCLI || yarnCLI) {
    const cli = yarnCLI || npmCLI;
    spawnSync(cli, ['install'], { ...spawnOptions, cwd: managerDir });
    const nCLI = spawnSync(cli, [
        'run',
        'make',
    ], { ...spawnOptions, cwd: managerDir });
    assert(nCLI.status === 0, 'An error occurred while building the mod manager.');
} else {
    console.log('* npm or yarn does not exist, skip building.');
}

console.log('- Done');
