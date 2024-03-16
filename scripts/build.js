#!/usr/bin/env node
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const { join, parse } = require('path');

if (process.platform !== 'win32') {
    console.error('Currently only building on Windows is supported.');
    process.exit(1);
}

const cardDatabasesDir = join(process.cwd(), 'database_zh-CN');
const managerReleaseDir = join(process.cwd(), 'bin/Release/Manager');
const spawnOptions = {
    cwd: process.cwd(),
    stdio: 'inherit',
};

if (!fs.existsSync(managerReleaseDir)) {
    fs.mkdirSync(managerReleaseDir);
}

// TODO: 构建 DL
console.log('- Building mod dll');

console.log('- Building card databases');
fs.readdirSync(cardDatabasesDir).forEach((v) => {
    const file = join(cardDatabasesDir, v);
    /** @type {Object<string, string>} */
    const database = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
    const outputFile = join(managerReleaseDir, parse(file).name + '.txt');
    if (fs.existsSync(outputFile)) {
        fs.rmSync(outputFile);
    }
    console.log('- Building card database: ' + file);

    for (const hash in database) {
        const text = database[hash];
        fs.appendFileSync(outputFile, hash + ':' + text + '\n', { encoding: 'utf8' });
    }
});

console.log('- Downloading BepInEx');
const curl = spawnSync('curl.exe', [
    '--connect-timeout',
    '3',
    '--fail',
    '--location',
    '--output',
    join(managerReleaseDir, 'BepInEx.zip'),
    'https://github.com/BepInEx/BepInEx/releases/download/v5.4.22/BepInEx_x64_5.4.22.0.zip'
], spawnOptions);
assert(curl.status === 0, 'An error occurred while downloading BepInEx.');

console.log('- Building mod manager');
const ahk2exe = spawnSync('C:\\Program Files\\AutoHotkey\\Compiler\\Ahk2Exe.exe', [
    '/in',
    join(process.cwd(), 'Manager.ahk'),
    '/silent',
    'verbose',
], spawnOptions);
assert(ahk2exe.status === 0, 'An error occurred while building the mod manager.');
