'use strict'

// Standalone release builder. Compiles the engine-free TypeScript sources to
// CommonJS with tsc, fuses them into one self-contained game.js bundle, and
// emits the WeChat mini-game package plus a browser preview package. The
// former Cocos Creator build path is retired; nothing here needs the editor.

const { execFileSync } = require('node:child_process')
const { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const project = resolve(__dirname, '..')
const outputName = process.argv[2] || 'wechat-1-8-0'
if (!/^[a-zA-Z0-9._-]+$/.test(outputName)) throw new Error(`Invalid output name: ${outputName}`)
const musicFiles = ['game.js', 'bgm.mp3', 'grid-pressure.mp3', 'grid-runner-pulse.mp3', 'gravity-coin.mp3', 'gravity-coin-alt.mp3']
const fontFiles = ['fonts/DingTalk-JinBuTi.ttf', 'fonts/LICENSE-NOTE.txt']
const sourcesDirectory = join(project, 'assets', 'scripts')
const stageDirectory = join(project, 'temp', 'standalone-stage')
const distDirectory = join(project, 'temp', 'standalone-dist')
const buildRoot = join(project, 'build')
const wechatOutput = join(buildRoot, outputName)
const webOutput = join(buildRoot, 'web-preview')

function stageSources() {
  rmSync(stageDirectory, { recursive: true, force: true })
  rmSync(distDirectory, { recursive: true, force: true })
  mkdirSync(stageDirectory, { recursive: true })
  for (const name of readdirSync(sourcesDirectory)) {
    if (!name.endsWith('.ts')) continue
    const source = readFileSync(join(sourcesDirectory, name), 'utf8').replace(/from '([^']+)\.ts'/g, "from '$1'")
    writeFileSync(join(stageDirectory, name), source)
  }
}

function compileTypeScript() {
  const config = {
    compilerOptions: {
      target: 'ES2018',
      module: 'CommonJS',
      moduleResolution: 'node',
      lib: ['ES2020', 'DOM'],
      strict: true,
      noImplicitOverride: true,
      outDir: distDirectory,
      rootDir: stageDirectory,
      sourceMap: false,
      declaration: false,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: [join(stageDirectory, '*.ts')]
  }
  const configPath = join(project, 'temp', 'tsconfig.standalone.json')
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  execFileSync(process.execPath, [join(project, 'node_modules', 'typescript', 'bin', 'tsc'), '--project', configPath], { stdio: 'inherit' })
}

function moduleOrder(dist) {
  const emitted = readdirSync(dist).filter((name) => name.endsWith('.js')).map((name) => name.replace(/\.js$/, ''))
  const requiresOf = {}
  for (const name of emitted) {
    const code = readFileSync(join(dist, `${name}.js`), 'utf8')
    const specifiers = []
    for (const match of code.matchAll(/require\("([^"]+)"\)/g)) {
      if (match[1].startsWith('./')) specifiers.push(match[1].replace(/^\.\//, ''))
    }
    requiresOf[name] = specifiers
  }
  const order = []
  const visited = new Set()
  const visit = (name) => {
    if (visited.has(name)) return
    visited.add(name)
    for (const dependency of requiresOf[name] || []) visit(dependency)
    order.push(name)
  }
  visit('main')
  for (const name of emitted) visit(name)
  return order
}

function bundle() {
  const order = moduleOrder(distDirectory)
  const parts = [
    '(function () {',
    "'use strict';",
    'var __modules = {};',
    'var __cache = {};',
    'function __def(name, factory) { __modules[name] = factory }',
    'function __require(name) {',
    '  var cached = __cache[name];',
    '  if (cached) return cached.exports;',
    '  var factory = __modules[name];',
    "  if (!factory) throw new Error('missing module: ' + name);",
    '  var module = { exports: {} };',
    '  __cache[name] = module;',
    '  factory(module, module.exports);',
    '  return module.exports;',
    '}'
  ]
  for (const name of order) {
    const code = readFileSync(join(distDirectory, `${name}.js`), 'utf8')
      .replace(/^"use strict";\r?\n/, '')
      .replace(/require\("\.\/([^"]+)"\)/g, "__require('$1')")
    parts.push(`__def('${name}', function (module, exports) {\n${code}\n});`)
  }
  parts.push("__require('main');")
  parts.push('})();')
  return parts.join('\n')
}

function writeWeChatPackage(bundleSource) {
  rmSync(wechatOutput, { recursive: true, force: true })
  mkdirSync(wechatOutput, { recursive: true })
  writeFileSync(join(wechatOutput, 'game.js'), `${bundleSource}\n`)
  const gameConfig = { deviceOrientation: 'portrait', networkTimeout: { request: 5000, connectSocket: 5000, uploadFile: 5000, downloadFile: 500000 }, subpackages: [{ name: 'music', root: 'music' }] }
  writeFileSync(join(wechatOutput, 'game.json'), `${JSON.stringify(gameConfig)}\n`)
  const projectConfig = JSON.parse(readFileSync(join(project, 'project.config.json'), 'utf8'))
  if (typeof projectConfig.appid !== 'string' || !projectConfig.appid.startsWith('wx')) {
    throw new Error('Missing release AppID in project.config.json')
  }
  writeFileSync(join(wechatOutput, 'project.config.json'), `${JSON.stringify(projectConfig)}\n`)
  const musicDirectory = join(wechatOutput, 'music')
  mkdirSync(musicDirectory, { recursive: true })
  for (const musicFile of musicFiles) copyFileSync(join(project, 'music', musicFile), join(musicDirectory, musicFile))
  copyFontFiles(wechatOutput)
}

function copyFontFiles(output) {
  mkdirSync(join(output, 'fonts'), { recursive: true })
  for (const fontFile of fontFiles) copyFileSync(join(project, fontFile), join(output, fontFile))
}

function writeWebPackage(bundleSource) {
  rmSync(webOutput, { recursive: true, force: true })
  mkdirSync(webOutput, { recursive: true })
  writeFileSync(join(webOutput, 'game.js'), `${bundleSource}\n`)
  copyFontFiles(webOutput)
  writeFileSync(join(webOutput, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>几何空战</title>
<style>
html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000006; overflow: hidden; }
canvas { position: fixed; inset: 0; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script src="game.js"></script>
</body>
</html>
`)
}

stageSources()
compileTypeScript()
const bundleSource = bundle()
writeWeChatPackage(bundleSource)
writeWebPackage(bundleSource)
for (const required of [join(wechatOutput, 'game.js'), join(wechatOutput, 'game.json'), join(wechatOutput, 'project.config.json'), join(wechatOutput, 'music', 'bgm.mp3'), join(wechatOutput, 'fonts', 'DingTalk-JinBuTi.ttf'), join(webOutput, 'index.html'), join(webOutput, 'game.js'), join(webOutput, 'fonts', 'DingTalk-JinBuTi.ttf')]) {
  if (!existsSync(required) || !statSync(required).isFile()) throw new Error(`build product missing: ${required}`)
}
process.stdout.write(`Standalone release ready: ${wechatOutput}\nBrowser preview ready: ${webOutput}\n`)
