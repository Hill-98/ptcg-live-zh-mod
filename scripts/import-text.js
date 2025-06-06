#!/usr/bin/env node
const fs = require('fs')
const { basename, dirname, join} = require('path')

const ROOT_DIR = dirname(__dirname)

const argv = process.argv.slice(2)

if (argv.length < 1) {
  console.error(`Usage: ${basename(__filename)} <untranslated.txt>`)
  process.exit(1)
}

const untranslatedTextFile = join(ROOT_DIR, 'text_untranslated/all.json')
const translatedTextFile = join(ROOT_DIR, 'text_zh-CN/all.json')

const data = fs.readFileSync(argv.shift(), { encoding: 'utf-8' })
const translatedTextMap = JSON.parse(fs.readFileSync(translatedTextFile, { encoding: 'utf-8' }))
const untranslatedTextMap = Object.create(null)
const newTranslatedTextMap = Object.create(null)

data.split('\n').forEach((line) => {
  const index = line.indexOf(':')
  if (index === -1) {
    return
  }
  const key = line.substring(0, index)
  const value = line.substring(index + 1)
  if (value.trim() !== '') {
    untranslatedTextMap[key] = value
  }
})

Object.keys(untranslatedTextMap).forEach((key) => {
  if (Object.prototype.hasOwnProperty.call(translatedTextMap, key)) {
    newTranslatedTextMap[key] = translatedTextMap[key]
  }
})

fs.writeFileSync(translatedTextFile, JSON.stringify(newTranslatedTextMap, null, 4))
fs.writeFileSync(untranslatedTextFile, JSON.stringify(untranslatedTextMap, null, 4))
