// HUD text renders through offscreen 2D canvases rasterized only when their
// string or color changes, then composited as textured quads by the GL layer.
// This module owns label state only; the platform layer performs rasterization.

export interface LabelConfig {
  readonly width: number
  readonly height: number
  readonly fontSize: number
  readonly lineHeight: number
  readonly outlineWidth: number
  readonly align: 'left' | 'center' | 'right'
  readonly monospace: boolean
  readonly display?: boolean
}

export type RasterHandle = unknown

export type RasterFactory = (pixelWidth: number, pixelHeight: number) => RasterHandle

// Raster canvases supersample at 1.5 px per design unit so text stays crisp
// from 390 px phones up to tablets without any resize-time re-raster.
export const TEXT_RASTER_SCALE = 1.5

export class TextLabel {
  string = ''
  colorHex = '#ffffff'
  visible = true
  x = 0
  y = 0
  dirty = true
  readonly pixelWidth: number
  readonly pixelHeight: number
  readonly config: LabelConfig
  readonly raster: RasterHandle

  constructor(config: LabelConfig, factory: RasterFactory) {
    this.config = config
    this.pixelWidth = Math.ceil(config.width * TEXT_RASTER_SCALE)
    this.pixelHeight = Math.ceil(config.height * TEXT_RASTER_SCALE)
    this.raster = factory(this.pixelWidth, this.pixelHeight)
  }

  setText(value: string): void {
    if (this.string === value) return
    this.string = value
    this.dirty = true
  }

  setColor(hex: string): void {
    if (this.colorHex === hex) return
    this.colorHex = hex
    this.dirty = true
  }
}
