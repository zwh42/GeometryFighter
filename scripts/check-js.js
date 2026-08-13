'use strict'

const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const { join } = require('node:path')

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(path)
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [path] : []
  })
}

const files = [
  'game.js',
  ...collectJavaScriptFiles('js'),
  ...collectJavaScriptFiles('scripts'),
  ...collectJavaScriptFiles('tests')
].sort()

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
}

console.log(`Checked ${files.length} JavaScript files.`)
