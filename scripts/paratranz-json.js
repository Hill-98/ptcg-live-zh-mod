#!/usr/bin/env node
const fs = require('fs');
const { basename, join } = require('path');

const databaseDir = join(process.cwd(), 'databases');
const databasesUntranslatedDir = join(process.cwd(), 'databases_untranslated');
const databasesTranslatedDir = join(process.cwd(), 'databases_zh-CN');
const textUntranslatedDir = join(process.cwd(), 'text_untranslated');
const textTranslatedDir = join(process.cwd(), 'text_zh-CN');

const argv = process.argv.slice(2);
const action = argv[0];

if (argv.length < 1 || ['export', 'import'].includes(action) === false) {
    console.error(`Usage: ${basename(__filename)} <export|import>`);
    process.exit(1);
}

if (action === 'export') {
    fs.readdirSync(databaseDir).forEach((name) => {
        const database = JSON.parse(fs.readFileSync(join(databaseDir, name), { encoding: 'utf-8' }));
        const textMap = JSON.parse(fs.readFileSync(join(databasesUntranslatedDir, name), { encoding: 'utf-8' }));
        const translatedTextMap = fs.existsSync(join(databasesTranslatedDir, name)) ? JSON.parse(fs.readFileSync(join(databasesTranslatedDir, name), { encoding: 'utf-8' })) : {};

        const paratranz = [];

        for (const hash in database) {
            paratranz.push({
                key: hash,
                original: textMap[hash],
                translation: translatedTextMap[hash],
                context: 'In cards: ' + database[hash].join(', '),
            });
        }

        fs.writeFileSync(join(process.cwd(), 'paratranz/' + name), JSON.stringify(paratranz), { encoding: 'utf-8' });
    });

    fs.readdirSync(textUntranslatedDir).forEach((name) => {
        const textMap = JSON.parse(fs.readFileSync(join(textUntranslatedDir, name), { encoding: 'utf-8' }));
        const translatedTextMap = fs.existsSync(join(textTranslatedDir, name)) ? JSON.parse(fs.readFileSync(join(textTranslatedDir, name), { encoding: 'utf-8' })) : {};

        const paratranz = [];

        for (const hash in textMap) {
            paratranz.push({
                key: hash,
                original: textMap[hash],
                translation: translatedTextMap[hash],
            });
        }

        fs.writeFileSync(join(process.cwd(), 'paratranz/' + name), JSON.stringify(paratranz), { encoding: 'utf-8' });
    });
}
