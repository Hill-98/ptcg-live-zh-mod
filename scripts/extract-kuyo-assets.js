const fs = require('fs')
const { basename, join } = require('path')

const KUYO_ASSETS_DIR = process.argv.slice(2).shift()

if (!KUYO_ASSETS_DIR || !fs.existsSync(KUYO_ASSETS_DIR)) {
  console.error(`Usage: ${basename(__filename)} <kuyo assets directory>`)
  process.exit(1)
}

const names = fs.readdirSync(KUYO_ASSETS_DIR, { encoding: 'utf-8' })

if (!fs.existsSync(join(KUYO_ASSETS_DIR, 'assets'))) {
  fs.mkdirSync(join(KUYO_ASSETS_DIR, 'assets'))
}

for (const name of names) {
    const sub = join(KUYO_ASSETS_DIR, name)
    const files = fs.readdirSync(sub, { encoding: 'utf-8', recursive: true })
    const data = files.find((file) => file.endsWith('_data'))
    if (data) {
        fs.cpSync(join(sub, data), join(KUYO_ASSETS_DIR, 'assets', name))
    }
}
