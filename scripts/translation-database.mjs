#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { readFileSync as readFile, writeFileSync as writeFile, writeFileSync } from 'fs';
import { request } from 'https';
import { basename, join } from 'path';
import { createInterface } from 'readline/promises';

const argv = process.argv.slice(2);

if (argv.length < 1) {
    console.error(`Usage: ${basename(import.meta.url)} <card database>`);
    process.exit(1);
}

/**
 * @typedef {Object} DatabaseRowObject
 * @property {string} text
 * @property {string=} translated_text
 */

/** @type {Object<string, DatabaseRowObject>} */
const database = JSON.parse(readFile(argv[0], { encoding: 'utf8' }));
/** @type {Map<string, string>} */
const dictionary = new Map();

const copyText = function copyText(text) {
    writeFile(join(process.cwd(), '.translate.txt'), text, { encoding: 'utf8' });
    spawnSync('cmd.exe', ['/c', 'clip.exe < .translate.txt'], { cwd: process.cwd() });
};

// TODO: 待实现
const getDictionary = function getDictionary() {

};

/**
 * @param {string} key
 * @returns {Promise<string[]>}
 */
const queryPmtcgo = function queryPmtcgo(key) {
    return new Promise((resolve, reject) => {
        const req = request('https://www.pmtcgo.com/getCardNameList', {
            headers: {
                'accept': 'application/json',
                'cookie': process.env.PMTCGO_COOKIE,
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://www.pmtcgo.com',
                'referer': 'https://www.pmtcgo.com/database',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
                'x-csrf-token': process.env.PMTCGO_XSRF_TOKEN,
                'x-requested-with': 'XMLHttpRequest',
            },
            method: 'POST',
            timeout: 3,
        });
        req.once('error', reject);
        req.on('response', (res) => {
            res.setEncoding('utf8');
            if (res.statusCode !== 200) {
                reject(res);
                return;
            }
            let data = '';
            res.once('error', reject);
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.once('end', () => {
                try {
                    resolve(JSON.parse(data).map((item) => item.title));
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.write('key=' + encodeURIComponent(key));
        req.end();
    });
};

/**
 * @param {string} text
 * @returns {string}
 */
const tryTranslate = function tryTranslate(text) {
    if (text.includes('&')) {
        return text.split('&').map((t) => tryTranslate(t.trim())).join('&');
    }
    const keywords = ['M ', '-EX', ' BREAK', '-GX', ' V', ' VMAX', ' V-UNION', ' VSTAR', ' ex', ' {*}', ' ☆'];
    for (const key of keywords) {
        const t = text.replace(key, '').trim();
        const result = dictionary.get(t);
        if (result) {
            return text.replace(t, result).replace(key, key.trim());
        }
    }
    return '';
};

readFile(join(process.cwd(), 'dictionary.txt'), { encoding: 'utf8' }).split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i <= 0 || line.startsWith('#')) {
        return;
    }
    const text = line.substring(0, i).trim();
    const translated_text = line.substring(i + 1).trim();
    dictionary.set(text, translated_text);
});

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

let translatedCount = 0;
const translatedTotalCount = Object.keys(database).length;

for (const hash in database) {
    const row = database[hash];
    if (typeof row.translated_text === 'string' && row.translated_text.trim() !== '') {
        translatedCount++;
        continue;
    }
    console.log('hash: ' + hash);
    console.log('text: ' + row.text);
    copyText(row.text);

    let translate = tryTranslate(row.text);
    console.log('Try translate: ' + (translate ? translate : '(empty)'));

    let onlineResult = [];
    /** @type {string[]} */
    let result = await rl.question('Your translate: ');

    if (result === 'q') {
        console.log('Get online results...');
        try {
            onlineResult = await queryPmtcgo(row.text);
        } catch (err) {
            console.error(err);
        }
        if (onlineResult.length !== 0) {
            console.log('Online results:');
            onlineResult.forEach((value, i) => {
                console.log(`${i + 1}. ${value}`);
            });
        }
        result = await rl.question('Your translate: ');
    }

    const num = Number.parseInt(result);

    if (result === 's') {
        console.log('Skip');
        continue;
    } else if (!Number.isNaN(num) && num > 0 && num <= onlineResult.length) {
        translate = onlineResult[num - 1].trim();
    } else if (result.trim() !== '') {
        translate = result.trim();
    }

    if (translate.trim() !== '') {
        translatedCount++;
        row.translated_text = translate;
        console.log('translated_text: ' + row.translated_text);
        console.log(`Translated count: ${translatedCount}/${translatedTotalCount}`);
        writeFile(argv[0], JSON.stringify(database, null, 4), { encoding: 'utf8' });
    }
    console.log('');
}

process.exit(0);
