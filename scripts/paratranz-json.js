#!/usr/bin/env node
const fs = require('fs');
const { basename, join } = require('path');

const databasesDir = join(process.cwd(), 'databases');
const databasesUntranslatedDir = join(process.cwd(), 'databases_untranslated');
const databasesTranslatedDir = join(process.cwd(), 'databases_zh-CN');
const paratranzDir = join(process.cwd(), 'paratranz');
const textUntranslatedDir = join(process.cwd(), 'text_untranslated');
const textTranslatedDir = join(process.cwd(), 'text_zh-CN');

const argv = process.argv.slice(2);
const action = argv[0];

if (argv.length < 1 || ['export', 'import'].includes(action) === false) {
    console.error(`Usage: ${basename(__filename)} <export|import>`);
    process.exit(1);
}

if (action === 'export') {
    fs.readdirSync(databasesDir).forEach((name) => {
        const database = JSON.parse(fs.readFileSync(join(databasesDir, name), { encoding: 'utf-8' }));
        const namesDatabase = JSON.parse(fs.readFileSync(join(databasesDir, 'names.json'), { encoding: 'utf-8' }));
        const textMap = JSON.parse(fs.readFileSync(join(databasesUntranslatedDir, name), { encoding: 'utf-8' }));
        const translatedTextMap = fs.existsSync(join(databasesTranslatedDir, name)) ? JSON.parse(fs.readFileSync(join(databasesTranslatedDir, name), { encoding: 'utf-8' })) : {};
        const namesTranslatedTextMap = JSON.parse(fs.readFileSync(join(databasesTranslatedDir, 'names.json'), { encoding: 'utf-8' }));

        const paratranz = [];

        for (const hash in database) {
            paratranz.push({
                key: hash,
                original: textMap[hash],
                translation: translatedTextMap[hash],
                context: 'In cards: ' + database[hash].map((cardId) => {
                    const nameHash = Object.keys(namesDatabase).find((k) => namesDatabase[k].includes(cardId));
                    if (nameHash) {
                        const name = namesTranslatedTextMap[nameHash];
                        return `${cardId} (${name})`;
                    } else {
                        return cardId;
                    }
                }).join(', '),
            });
        }

        fs.writeFileSync(join(paratranzDir, name), JSON.stringify(paratranz), { encoding: 'utf-8' });
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

if (action === 'import') {
    [
        ...fs.readdirSync(databasesUntranslatedDir, { withFileTypes: true }),
        ...fs.readdirSync(textUntranslatedDir, { withFileTypes: true }),
    ].forEach((file) => {
        const paratranz = JSON.parse(fs.readFileSync(join(paratranzDir, file.name), { encoding: 'utf-8' }));
        const targetFile = file.path === databasesUntranslatedDir ? join(databasesTranslatedDir, file.name) : join(textTranslatedDir, file.name);
        const targetMap = Object.create(null);

        paratranz.forEach((item) => {
            targetMap[item.key] = item.translation.replaceAll('\\n', '\n');
        });

        fs.writeFileSync(targetFile, JSON.stringify(targetMap, null, 4), { encoding: 'utf-8' });
    });
}
