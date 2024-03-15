#!/usr/bin/env node
const { createHash } = require('crypto');
const fs = require('fs');
const { basename, join } = require('path');

const argv = process.argv.slice(2);

if (argv.length < 1) {
    console.error(`Usage: ${basename(__filename)} <cards directory>`);
    process.exit(1);
}

const cardsDir = argv.shift();
const databaseDir = join(process.cwd(), 'CardDatabases');

if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir);
}

/**
 * @typedef {Object} AttackObject
 * @property {number} id
 * @property {string=} name
 * @property {string=} text
 */

class CardObject {
    #archetypeID = 0;

    /** @type {AttackObject[]} */
    #attacks = [];

    /** @type {string=} */
    #id;

    /** @type {string=} */
    #name;

    /**
     * @param {string} text
     */
    constructor(text) {
        /** @type Map<string, string> */
        const row = new Map();
        let lastKey = '';
        text.split('\n').forEach((line) => {
            const i = line.indexOf(':');
            if (i <= 0) {
                // 预防多行文本
                if (row.has(lastKey)) {
                    row.set(lastKey, row.get(lastKey).concat('\n', line));
                }
                return;
            }
            lastKey = line.substring(0, i);
            const value = line.substring(i + 1);
            row.set(lastKey, value);
        });

        this.#archetypeID = Number.parseInt(row.get('archetypeID'));
        if (Number.isNaN(this.#archetypeID)) {
            this.#archetypeID = 0;
        }

        this.#id = row.get('cardID');
        this.#name = row.get('LocalizedCardName');
        for (let i = 0; i < 4; i++) {
            const id = Number.parseInt(row.get('attackID' + i));
            if (Number.isNaN(id)) {
                continue;
            }
            const keySuffix = i <= 0 ? '' : ` ${i + 1}`;
            const name = row.get('EN Attack Name' + keySuffix);
            const text = row.get('EN Attack Text' + keySuffix);
            this.#attacks.push({
                id,
                name,
                text,
            });
        }
    }

    get archetypeID() {
        return this.#archetypeID;
    }

    get attacks() {
        return this.#attacks;
    }

    get id() {
        return this.#id;
    }

    get name() {
        return this.#name;
    }
};

/**
 * @typedef {Object} DatabaseRowObject
 * @property {string} text
 * @property {string[]} cardIDs
 */

class CardDatabase {
    #file = '';
    /** @type {Object<string, DatabaseRowObject>} */
    #json = Object.create(null);

    constructor(file) {
        this.#file = file;
        try {
            this.#json = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
        } catch { }
    }

    append(text, cardID) {
        const hash = createHash('md5').update(text).digest('hex');
        if (!Object.prototype.hasOwnProperty.bind(this.#json)(hash)) {
            this.#json[hash] = {
                text,
                cardIDs: [],
            };
        }
        if (!this.#json[hash].cardIDs.includes(cardID)) {
            this.#json[hash].cardIDs.push(cardID);
        };
    };

    get count() {
        return Object.keys(this.#json).length;
    }

    save() {
        fs.writeFileSync(this.#file, JSON.stringify(this.#json, null, 4), { encoding: 'utf8' });
    }
}

const namesDatabase = new CardDatabase(join(databaseDir, 'names.json'));
const attksNameDatabase = new CardDatabase(join(databaseDir, 'attks-name.json'));
const attksTextDatabase = new CardDatabase(join(databaseDir, 'attks-text.json'));

const cardFiles = fs.readdirSync(cardsDir);

cardFiles.forEach((file) => {
    const card = new CardObject(fs.readFileSync(join(cardsDir, file), { encoding: 'utf-8' }));
    if (card.archetypeID === 0) {
        console.warn(card.id + "'s archetypeID is 0");
    } else {
        namesDatabase.append(card.name, card.id);
    }
    card.attacks.forEach((attk) => {
        if (typeof attk.name === 'string' && attk.name !== '') {
            attksNameDatabase.append(attk.name, card.id);
        }
        if (typeof attk.text === 'string' && attk.text !== '') {
            attksTextDatabase.append(attk.text, card.id);
        }
    });
});

namesDatabase.save();
attksNameDatabase.save();
attksTextDatabase.save();
