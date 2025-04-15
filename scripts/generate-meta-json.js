const { createHash } = require('crypto')
const fs = require('fs')
const { basename, join } = require('path')

const argv = process.argv.slice(2)

if (argv.length < 2) {
  console.error(`Usage: ${basename(__filename)} <assets directory> <assets version>`)
  process.exit(1)
}

const ASSETS_DIR = argv[0]

const json = {
  "fromVersion": 0,
  "version": Number.parseInt(argv[1]),
  "hashType": "SHA-256",
  "provider": "",
  files: [],
}

const files = fs.readdirSync(ASSETS_DIR);

for (const id of files) {
  const hash = createHash('sha256').update(fs.readFileSync(join(ASSETS_DIR, id))).digest('hex').toLowerCase()
  json.files.push({
    id,
    hash,
  })
}

fs.writeFileSync(join(ASSETS_DIR, 'meta.json'), JSON.stringify(json, null, 2))
