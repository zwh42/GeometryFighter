// Runtime entry for both targets: the WeChat mini-game package and the
// browser preview build. The bundle boots the standalone renderer stack —
// no engine layer sits between the game and WebGL.

import { GameApp } from './game-app.ts'
import { GlSurface } from './gl-surface.ts'
import { WebPlatform, WeChatPlatform } from './platform.ts'
import type { DomCanvas, PlatformHost, WebDocument, WebWindow } from './platform.ts'

function boot(): void {
  let platform: PlatformHost
  if (globalThis.wx) platform = new WeChatPlatform()
  else {
    const win = window as unknown as WebWindow
    const doc = document as unknown as WebDocument
    const canvas = doc.getElementById('game') as DomCanvas | null
    if (!canvas) throw new Error('missing #game canvas element')
    platform = new WebPlatform(win, doc, canvas)
  }
  const surface = new GlSurface(platform.glCanvas)
  const app = new GameApp(platform, surface)
  ;(globalThis as { __geometryFighter?: GameApp }).__geometryFighter = app
  if (!globalThis.wx) armWebPreviewDemo(app)
  app.start()
}

// Browser-preview-only art QA hook: `?demo=play|missile` starts a hands-free
// run so combat frames (and the homing missile silhouette) can be screenshotted
// without touch input. Inert in the WeChat package.
function armWebPreviewDemo(app: GameApp): void {
  const query = new URLSearchParams((globalThis as { location?: { search: string } }).location?.search ?? '')
  const mode = query.get('demo')
  if (mode !== 'play' && mode !== 'missile') return
  app.runHandsFreeDemo(mode === 'missile')
}

boot()
