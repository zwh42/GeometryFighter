// One platform seam for the standalone runtime: WeChat mini-game on one side,
// browsers on the other. The game shell sees logical-pixel touches, window
// metrics with a y-down safe area, cached storage, and a rasterizing text
// factory; it never touches wx or DOM APIs directly.

import type { LabelConfig, RasterFactory, RasterHandle } from './text-surface.ts'
import { TextLabel, TEXT_RASTER_SCALE } from './text-surface.ts'
import { COLORS } from './design-tokens.ts'

export interface TouchPoint {
  readonly id: number
  readonly x: number
  readonly y: number
}

export interface KeyEvent {
  readonly key: string
}

export interface WindowMetrics {
  readonly width: number
  readonly height: number
  readonly safeLeft: number
  readonly safeRight: number
  readonly safeTop: number
  readonly safeBottom: number
  readonly menuBottom: number
}

export interface TouchHandlers {
  readonly start: (point: TouchPoint) => void
  readonly move: (point: TouchPoint) => void
  readonly end: (id: number) => void
}

export interface KeyHandlers {
  readonly down: (event: KeyEvent) => void
  readonly up: (event: KeyEvent) => void
}

export interface PlatformHost {
  readonly kind: 'wechat' | 'web'
  readonly glCanvas: unknown
  readonly createRaster: RasterFactory
  rasterizeLabel(label: TextLabel): void
  metrics(): WindowMetrics
  onResize(listener: () => void): void
  onTouch(handlers: TouchHandlers): void
  onKey(handlers: KeyHandlers): void
  onVisibility(listener: (visible: boolean) => void): void
  onFontLoaded?(listener: () => void): void
  storageGet(key: string): string
  storageSet(key: string, value: string): void
  requestFrame(callback: () => void): void
  now(): number
}

// The subset of CanvasRenderingContext2D the label rasterizer needs; both the
// WeChat offscreen canvas and a browser canvas provide it.
export interface RasterContext2D {
  font: string
  textBaseline: string
  textAlign: string
  lineWidth: number
  strokeStyle: string
  fillStyle: string
  clearRect(x: number, y: number, width: number, height: number): void
  strokeText(text: string, x: number, y: number): void
  fillText(text: string, x: number, y: number): void
}

const MONO_STACK = "ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace"
const SANS_STACK = "system-ui,-apple-system,'PingFang SC','Noto Sans SC',sans-serif"

// The bundled display face is the unmodified DingTalk JinBuTi (钉钉进步体,
// permanently free for commercial use; see fonts/LICENSE-NOTE.txt). Every
// other label stays on the stacks above.
const DISPLAY_FONT_FAMILY = 'jihekongzhan-title'
const DISPLAY_FONT_SOURCE = 'fonts/DingTalk-JinBuTi.ttf'
// wx.loadFont registers the face under the family name baked into the TTF
// ("DingTalk JinBuTi"), not under a caller-chosen name like the web FontFace
// API, so the WeChat platform adopts the returned name here.
let displayFontFamily = DISPLAY_FONT_FAMILY

function fontFor(config: LabelConfig): string {
  if (config.display) return `${Math.round(config.fontSize * TEXT_RASTER_SCALE)}px '${displayFontFamily}','PingFang SC','Noto Sans SC',sans-serif`
  return `700 ${Math.round(config.fontSize * TEXT_RASTER_SCALE)}px ${config.monospace ? MONO_STACK : SANS_STACK}`
}

// The display face registers during platform boot (synchronously through
// wx.loadFont, asynchronously through the web FontFace), so each platform
// gates a one-shot notification; the shell then re-rasterizes labels that
// were first drawn against the system CJK fallback.
class DisplayFontGate {
  private ready = false
  private listeners: (() => void)[] = []

  notify(): void {
    if (this.ready) return
    this.ready = true
    for (const listener of this.listeners) listener()
    this.listeners = []
  }

  add(listener: () => void): void {
    if (this.ready) listener()
    else this.listeners.push(listener)
  }
}

export function rasterizeLabelWith(context: RasterContext2D, label: TextLabel, pixelWidth: number, pixelHeight: number): void {
  const config = label.config
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.font = fontFor(config)
  context.textBaseline = 'middle'
  context.textAlign = config.align
  const lines = label.string.split('\n')
  const originX = config.align === 'left' ? 0 : config.align === 'right' ? pixelWidth : pixelWidth * 0.5
  for (let index = 0; index < lines.length; index += 1) {
    const y = (index + 0.5) * config.lineHeight * TEXT_RASTER_SCALE
    if (config.outlineWidth > 0) {
      context.lineWidth = config.outlineWidth * 2 * TEXT_RASTER_SCALE
      context.strokeStyle = COLORS.background
      context.strokeText(lines[index], originX, y)
    }
    context.fillStyle = label.colorHex
    context.fillText(lines[index], originX, y)
  }
  label.dirty = false
}

interface MiniGameSafeArea {
  readonly left?: number
  readonly right?: number
  readonly top?: number
  readonly bottom?: number
}

interface MiniGameTouch {
  readonly identifier: number
  readonly clientX: number
  readonly clientY: number
}

interface MiniGameTouchEvent {
  readonly changedTouches: readonly MiniGameTouch[]
}

interface MiniGameKeyboardEvent {
  readonly type: 'keydown' | 'keyup'
  readonly key: string
}

interface MiniGameWindowInfo {
  readonly windowWidth?: number
  readonly windowHeight?: number
  readonly safeArea?: MiniGameSafeArea
}

interface MiniGameApi {
  createCanvas(): unknown
  createOffscreenCanvas?(options?: { readonly type?: '2d' | 'webgl'; readonly width?: number; readonly height?: number }): unknown
  createWebAudioContext?(): AudioContext
  createInnerAudioContext?(): {
    loop: boolean
    autoplay: boolean
    volume: number
    src: string
    play?(): void
    readonly currentTime?: number
    readonly duration?: number
    onEnded?(callback: () => void): void
  }
  loadSubpackage?(options: { readonly name: string; readonly success: () => void }): void
  getWindowInfo?(): MiniGameWindowInfo
  getSystemInfoSync?(): MiniGameWindowInfo
  getMenuButtonBoundingClientRect?(): { readonly bottom: number }
  onWindowResize(listener: () => void): void
  onTouchStart(listener: (event: MiniGameTouchEvent) => void): void
  onTouchMove(listener: (event: MiniGameTouchEvent) => void): void
  onTouchEnd(listener: (event: MiniGameTouchEvent) => void): void
  onTouchCancel(listener: (event: MiniGameTouchEvent) => void): void
  onKeyboardEvent?(listener: (event: MiniGameKeyboardEvent) => void): void
  onHide(listener: () => void): void
  onShow(listener: () => void): void
  getStorageSync(key: string): string
  setStorageSync(key: string, value: string): void
  setPreferredFramesPerSecond?(fps: number): void
  loadFont?(path: string): string
}

export type { MiniGameApi }

declare global {
  // eslint-disable-next-line no-var
  var wx: MiniGameApi | undefined
}

function asRasterContext(handle: unknown): RasterContext2D {
  return handle as RasterContext2D
}

interface WxRasterCanvas {
  getContext?(type: '2d'): unknown
  width?: number
  height?: number
}

// wx.createOffscreenCanvas is absent on some reviewed device combinations —
// the 1.7.0 submission was rejected on iPhone 13 / iOS 26.5 / WeChat 8.0.75
// with "createOffscreenCanvas is not a function" freezing the boot screen —
// and clients predating base library 2.16.1 only provide the argument-free
// legacy form. Probe every form and finally fall back to repeated
// wx.createCanvas() calls: the constructor's first call already claimed the
// on-screen canvas for GL, so each later call returns an offscreen canvas.
function createWeChatRaster(api: MiniGameApi, width: number, height: number): RasterHandle {
  if (typeof api.createOffscreenCanvas === 'function') {
    const offscreen = api.createOffscreenCanvas.bind(api)
    const modern = sizedRaster(() => offscreen({ type: '2d', width, height }), width, height)
    if (modern !== null) return modern
    const legacy = sizedRaster(() => offscreen(), width, height)
    if (legacy !== null) return legacy
  }
  const canvas = api.createCanvas() as WxRasterCanvas
  canvas.width = width
  canvas.height = height
  return canvas
}

function sizedRaster(create: () => unknown, width: number, height: number): RasterHandle | null {
  let canvas: WxRasterCanvas | null = null
  try {
    canvas = create() as WxRasterCanvas | null
  } catch (error) {
    return null
  }
  if (!canvas || typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) return null
  try {
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
  } catch (error) {
    // Locked-size legacy canvases are unusable; take the next fallback form.
    return null
  }
  return canvas.width === width && canvas.height === height ? canvas : null
}

export class WeChatPlatform implements PlatformHost {
  readonly kind = 'wechat' as const
  readonly glCanvas: unknown
  readonly createRaster: RasterFactory
  private readonly api: MiniGameApi
  private readonly displayFont = new DisplayFontGate()

  constructor() {
    const api = globalThis.wx
    if (!api) throw new Error('WeChatPlatform requires the wx mini-game runtime')
    this.api = api
    this.glCanvas = api.createCanvas()
    this.createRaster = (width, height) => createWeChatRaster(api, width, height)
    api.setPreferredFramesPerSecond?.(60)
    try {
      const loadedFamily = api.loadFont?.(DISPLAY_FONT_SOURCE)
      if (typeof loadedFamily === 'string' && loadedFamily !== '' && loadedFamily !== 'sans-serif') {
        displayFontFamily = loadedFamily
      }
    } catch (error) {
      // An unreadable font leaves labels on the system CJK stacks below.
    }
    this.displayFont.notify()
  }

  onFontLoaded(listener: () => void): void {
    this.displayFont.add(listener)
  }

  rasterizeLabel(label: TextLabel): void {
    const canvas = label.raster as { getContext(type: '2d'): unknown }
    rasterizeLabelWith(asRasterContext(canvas.getContext('2d')), label, label.pixelWidth, label.pixelHeight)
  }

  metrics(): WindowMetrics {
    const info = this.api.getWindowInfo?.() ?? this.api.getSystemInfoSync?.() ?? {}
    const width = info.windowWidth ?? 390
    const height = info.windowHeight ?? 844
    const area = info.safeArea ?? {}
    return {
      width,
      height,
      safeLeft: area.left ?? 0,
      safeRight: width - (area.right ?? width),
      safeTop: area.top ?? 0,
      safeBottom: height - (area.bottom ?? height),
      menuBottom: this.api.getMenuButtonBoundingClientRect?.().bottom ?? 0
    }
  }

  onResize(listener: () => void): void {
    this.api.onWindowResize(listener)
  }

  onTouch(handlers: TouchHandlers): void {
    const toPoint = (touch: MiniGameTouch): TouchPoint => ({ id: touch.identifier, x: touch.clientX, y: touch.clientY })
    this.api.onTouchStart((event) => { for (const touch of event.changedTouches) handlers.start(toPoint(touch)) })
    this.api.onTouchMove((event) => { for (const touch of event.changedTouches) handlers.move(toPoint(touch)) })
    const finish = (event: MiniGameTouchEvent) => { for (const touch of event.changedTouches) handlers.end(touch.identifier) }
    this.api.onTouchEnd(finish)
    this.api.onTouchCancel(finish)
  }

  onKey(handlers: KeyHandlers): void {
    this.api.onKeyboardEvent?.((event) => {
      if (event.type === 'keydown') handlers.down({ key: event.key })
      else handlers.up({ key: event.key })
    })
  }

  onVisibility(listener: (visible: boolean) => void): void {
    this.api.onHide(() => listener(false))
    this.api.onShow(() => listener(true))
  }

  storageGet(key: string): string {
    return this.api.getStorageSync(key) || ''
  }

  storageSet(key: string, value: string): void {
    this.api.setStorageSync(key, value)
  }

  requestFrame(callback: () => void): void {
    requestAnimationFrame(callback)
  }

  now(): number {
    return Date.now()
  }
}

export interface DomCanvas {
  getContext(type: 'webgl' | '2d', options?: unknown): unknown
  width: number
  height: number
  addEventListener(type: string, listener: (event: unknown) => void): void
  style: Record<string, string>
}

interface PointerEventLike {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly key?: string
  preventDefault?(): void
}

// The preview package ships the display font beside index.html; a missing file
// or unsupported FontFace API just keeps the system CJK fallback.
function loadWebDisplayFont(win: WebWindow, doc: WebDocument, gate: DisplayFontGate): void {
  const FontFace = win.FontFace
  if (!FontFace || !doc.fonts) return
  const face = new FontFace(DISPLAY_FONT_FAMILY, `url(${DISPLAY_FONT_SOURCE})`)
  face.load().then(() => {
    doc.fonts?.add(face)
    gate.notify()
  }).catch(() => undefined)
}

export interface WebWindow {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void }
  readonly FontFace?: new (family: string, source: string) => { load(): Promise<unknown> }
  addEventListener(type: string, listener: (event: unknown) => void): void
}

export interface WebDocument {
  readonly visibilityState: string
  readonly fonts?: { add(font: unknown): void }
  createElement(tag: 'canvas'): DomCanvas
  getElementById(id: string): DomCanvas | null
  addEventListener(type: string, listener: () => void): void
}

export class WebPlatform implements PlatformHost {
  readonly kind = 'web' as const
  readonly glCanvas: unknown
  readonly createRaster: RasterFactory
  private readonly win: WebWindow
  private readonly doc: WebDocument
  private readonly canvas: DomCanvas
  private readonly displayFont = new DisplayFontGate()

  constructor(win: WebWindow, doc: WebDocument, canvas: DomCanvas) {
    this.win = win
    this.doc = doc
    this.canvas = canvas
    this.glCanvas = canvas
    this.createRaster = (width, height) => {
      const raster = doc.createElement('canvas')
      raster.width = width
      raster.height = height
      return raster
    }
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.touchAction = 'none'
    canvas.style.display = 'block'
    loadWebDisplayFont(win, doc, this.displayFont)
  }

  onFontLoaded(listener: () => void): void {
    this.displayFont.add(listener)
  }

  rasterizeLabel(label: TextLabel): void {
    rasterizeLabelWith(asRasterContext((label.raster as DomCanvas).getContext('2d')), label, label.pixelWidth, label.pixelHeight)
  }

  metrics(): WindowMetrics {
    return {
      width: this.win.innerWidth,
      height: this.win.innerHeight,
      safeLeft: 0,
      safeRight: 0,
      safeTop: 0,
      safeBottom: 0,
      menuBottom: 0
    }
  }

  onResize(listener: () => void): void {
    this.win.addEventListener('resize', listener)
  }

  onTouch(handlers: TouchHandlers): void {
    const canvas = this.canvas
    canvas.addEventListener('pointerdown', (raw) => {
      const event = raw as PointerEventLike
      event.preventDefault?.()
      handlers.start({ id: event.pointerId, x: event.clientX, y: event.clientY })
    })
    canvas.addEventListener('pointermove', (raw) => {
      const event = raw as PointerEventLike
      handlers.move({ id: event.pointerId, x: event.clientX, y: event.clientY })
    })
    const finish = (raw: unknown) => handlers.end((raw as PointerEventLike).pointerId)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
  }

  onKey(handlers: KeyHandlers): void {
    this.win.addEventListener('keydown', (raw) => handlers.down({ key: (raw as PointerEventLike).key ?? '' }))
    this.win.addEventListener('keyup', (raw) => handlers.up({ key: (raw as PointerEventLike).key ?? '' }))
  }

  onVisibility(listener: (visible: boolean) => void): void {
    this.doc.addEventListener('visibilitychange', () => listener(this.doc.visibilityState === 'visible'))
  }

  storageGet(key: string): string {
    return this.win.localStorage.getItem(key) || ''
  }

  storageSet(key: string, value: string): void {
    this.win.localStorage.setItem(key, value)
  }

  requestFrame(callback: () => void): void {
    requestAnimationFrame(callback)
  }

  now(): number {
    return Date.now()
  }
}
