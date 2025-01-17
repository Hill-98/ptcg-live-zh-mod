#!/usr/bin/env node
const fs = require('fs')
const { basename, join } = require('path')

const argv = process.argv.slice(2)

if (argv.length < 1) {
  console.error(`Usage: ${basename(__filename)} <untranslated.txt>`)
  process.exit(1)
}

const textUntranslatedFile = join(process.cwd(), 'text_untranslated/all.json')
const textTranslatedFile = join(process.cwd(), 'text_zh-CN/all.json')

const data = fs.readFileSync(argv.shift(), { encoding: 'utf-8' })
const textTranslated = JSON.parse(fs.readFileSync(textTranslatedFile, { encoding: 'utf-8' }))
const textUntranslated = Object.create(null)
const textTranslatedNew = Object.create(null)

data.split('\n').forEach((line) => {
  const index = line.indexOf(':')
  if (index === -1) {
    return
  }
  const key = line.substring(0, index)
  const value = line.substring(index + 1)
  if (value.trim() !== '') {
    textUntranslated[key] = value
  }
})

Object.keys(textUntranslated).forEach((key) => {
  if (Object.prototype.hasOwnProperty.call(textTranslated, key)) {
    textTranslatedNew[key] = textTranslated[key]
  }
})

fs.writeFileSync(textTranslatedFile, JSON.stringify(textTranslatedNew, null, 4))
fs.writeFileSync(textUntranslatedFile, JSON.stringify(textUntranslated, null, 4))
