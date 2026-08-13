'use strict'

const { spawnSync } = require('node:child_process')
const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')

const project = resolve(__dirname, '..')
const outputName = process.argv[2] || 'wechat-v1-5-2'
if (!/^[a-zA-Z0-9._-]+$/.test(outputName)) throw new Error(`Invalid output name: ${outputName}`)

const creator = process.env.COCOS_CREATOR_PATH || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator'
const buildRoot = join(project, 'build')
const output = join(buildRoot, outputName)
const startedAt = Date.now()
const result = spawnSync(creator, [
  '--no-sandbox',
  '--disable-gpu',
  '--project', project,
  '--build', `platform=wechatgame;buildPath=${buildRoot};outputName=${outputName}`,
  '--log-level', '4'
], { stdio: 'inherit' })

const logDirectory = join(project, 'temp', 'builder', 'log')
const latestLog = readdirSync(logDirectory)
  .filter((name) => name.startsWith('wechatgame') && name.endsWith('.log'))
  .map((name) => ({ name, modified: statSync(join(logDirectory, name)).mtimeMs }))
  .filter((entry) => entry.modified >= startedAt - 2000)
  .sort((left, right) => right.modified - left.modified)[0]

const log = latestLog ? readFileSync(join(logDirectory, latestLog.name), 'utf8') : ''
const finished = log.includes(`build Task (${outputName}) Finished`)
const requiredFiles = ['game.js', 'game.json', 'application.js', 'assets/main/index.js']
const missing = requiredFiles.filter((name) => !existsSync(join(output, name)))

if (!finished || missing.length > 0) {
  const reason = missing.length > 0 ? `missing ${missing.join(', ')}` : 'completion marker absent'
  throw new Error(`Cocos build failed (${reason}, process status ${String(result.status)})`)
}

const musicDirectory = join(output, 'music')
mkdirSync(musicDirectory, { recursive: true })
copyFileSync(join(project, 'music', 'bgm.mp3'), join(musicDirectory, 'bgm.mp3'))

if (result.status !== 0) {
  process.stderr.write(`Cocos finished successfully; ignored macOS helper teardown status ${String(result.status)}.\n`)
}
process.stdout.write(`WeChat release ready: ${output}\n`)
