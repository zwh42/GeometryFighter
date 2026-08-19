// Thin WebGL 1.0 surface for the standalone renderer. Each frame is exactly
// one triangle-batch upload + draw call for the whole battlefield, followed by
// one textured quad per dirty HUD label. The GL context lives here so the rest
// of the game stays engine- and platform-free.

import type { TextLabel } from './text-surface.ts'
import type { VectorRenderer } from './renderer.ts'
import { TITLE_GLOW } from './design-tokens.ts'

const WORLD_VERTEX_SOURCE = `
attribute vec2 aPosition;
attribute vec4 aColor;
uniform vec2 uHalf;
uniform vec2 uOffset;
varying vec4 vColor;
void main() {
  gl_Position = vec4((aPosition - uOffset) / uHalf, 0.0, 1.0);
  vColor = aColor;
}
`

const WORLD_FRAGMENT_SOURCE = `
precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`

const TEXT_VERTEX_SOURCE = `
attribute vec2 aPosition;
attribute vec2 aUv;
uniform vec2 uHalf;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPosition / uHalf, 0.0, 1.0);
  vUv = aUv;
}
`

// uTint scales the premultiplied label texture; the crisp pass keeps it white
// while the neon passes multiply in a glow color and the flicker alpha.
const TEXT_FRAGMENT_SOURCE = `
precision mediump float;
uniform sampler2D uSampler;
uniform vec4 uTint;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uSampler, vUv) * uTint;
}
`

export interface FrameCamera {
  readonly halfWidth: number
  readonly halfHeight: number
  readonly offsetX: number
  readonly offsetY: number
}

export interface FrameOptions {
  readonly camera: FrameCamera
  readonly background: readonly [number, number, number]
}

function tintOf(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 0xff) / 0xff, ((value >> 8) & 0xff) / 0xff, (value & 0xff) / 0xff]
}

const GLOW_CYAN = tintOf(TITLE_GLOW.cyan)
const GLOW_MAGENTA = tintOf(TITLE_GLOW.magenta)

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader allocation failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown'
    gl.deleteShader(shader)
    throw new Error(`WebGL shader compile failed: ${log}`)
  }
  return shader
}

function link(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('WebGL program allocation failed')
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown'
    gl.deleteProgram(program)
    throw new Error(`WebGL program link failed: ${log}`)
  }
  return program
}

export class GlSurface {
  private readonly gl: WebGLRenderingContext
  private readonly canvas: { width: number; height: number }
  private readonly worldProgram: WebGLProgram
  private readonly worldPosition: number
  private readonly worldColor: number
  private readonly worldHalf: WebGLUniformLocation | null
  private readonly worldOffset: WebGLUniformLocation | null
  private readonly worldBuffer: WebGLBuffer
  private readonly textProgram: WebGLProgram
  private readonly textPosition: number
  private readonly textUv: number
  private readonly textHalf: WebGLUniformLocation | null
  private readonly textSampler: WebGLUniformLocation | null
  private readonly textTint: WebGLUniformLocation | null
  private readonly textBuffer: WebGLBuffer
  private readonly textVertices = new Float32Array(6 * 4)
  private readonly textures = new Map<TextLabel, WebGLTexture>()
  private uploadedBytes = 0

  constructor(canvas: unknown) {
    const glCanvas = canvas as { getContext(type: string, options?: WebGLContextAttributes): WebGLRenderingContext | null; width: number; height: number }
    const gl = glCanvas.getContext('webgl', { alpha: false, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('WebGL is unavailable on this device')
    this.gl = gl
    this.canvas = glCanvas

    this.worldProgram = link(gl, WORLD_VERTEX_SOURCE, WORLD_FRAGMENT_SOURCE)
    this.worldPosition = gl.getAttribLocation(this.worldProgram, 'aPosition')
    this.worldColor = gl.getAttribLocation(this.worldProgram, 'aColor')
    this.worldHalf = gl.getUniformLocation(this.worldProgram, 'uHalf')
    this.worldOffset = gl.getUniformLocation(this.worldProgram, 'uOffset')
    this.worldBuffer = gl.createBuffer() as WebGLBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.worldBuffer)

    this.textProgram = link(gl, TEXT_VERTEX_SOURCE, TEXT_FRAGMENT_SOURCE)
    this.textPosition = gl.getAttribLocation(this.textProgram, 'aPosition')
    this.textUv = gl.getAttribLocation(this.textProgram, 'aUv')
    this.textHalf = gl.getUniformLocation(this.textProgram, 'uHalf')
    this.textSampler = gl.getUniformLocation(this.textProgram, 'uSampler')
    this.textTint = gl.getUniformLocation(this.textProgram, 'uTint')
    this.textBuffer = gl.createBuffer() as WebGLBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.textVertices.byteLength, gl.DYNAMIC_DRAW)

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.enable(gl.BLEND)
  }

  drawFrame(renderer: VectorRenderer, labels: readonly TextLabel[], options: FrameOptions): void {
    const gl = this.gl
    const [red, green, blue] = options.background
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(red, green, blue, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.worldProgram)
    gl.uniform2f(this.worldHalf, options.camera.halfWidth, options.camera.halfHeight)
    gl.uniform2f(this.worldOffset, options.camera.offsetX, options.camera.offsetY)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.worldBuffer)
    const requiredBytes = renderer.data.byteLength
    if (requiredBytes > this.uploadedBytes) {
      gl.bufferData(gl.ARRAY_BUFFER, requiredBytes, gl.DYNAMIC_DRAW)
      this.uploadedBytes = requiredBytes
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, renderer.data.subarray(0, renderer.vertexCount * 6))
    gl.enableVertexAttribArray(this.worldPosition)
    gl.enableVertexAttribArray(this.worldColor)
    gl.vertexAttribPointer(this.worldPosition, 2, gl.FLOAT, false, 24, 0)
    gl.vertexAttribPointer(this.worldColor, 4, gl.FLOAT, false, 24, 8)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    if (renderer.vertexCount > 0) gl.drawArrays(gl.TRIANGLES, 0, renderer.vertexCount)

    this.drawText(labels, options.camera)
  }

  private drawText(labels: readonly TextLabel[], camera: FrameCamera): void {
    const gl = this.gl
    gl.useProgram(this.textProgram)
    gl.uniform2f(this.textHalf, camera.halfWidth, camera.halfHeight)
    gl.uniform1i(this.textSampler, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer)
    gl.enableVertexAttribArray(this.textPosition)
    gl.enableVertexAttribArray(this.textUv)
    gl.vertexAttribPointer(this.textPosition, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(this.textUv, 2, gl.FLOAT, false, 16, 8)

    for (const label of labels) {
      if (!label.visible || label.string === '') continue
      let texture = this.textures.get(label)
      if (!texture) {
        texture = gl.createTexture() as WebGLTexture
        this.textures.set(label, texture)
        label.dirty = true
      }
      if (label.dirty) this.uploadLabelTexture(texture, label)
      gl.bindTexture(gl.TEXTURE_2D, texture)

      if (label.glow > 0) {
        // Neon bloom: additive copies of the label raster spread past the
        // glyphs. Dark pixels add nothing under gl.ONE, so only the glyphs
        // flare; the flicker rides in on the tint alpha.
        const cyan = (TITLE_GLOW.cyanAlpha / 0xff) * label.glow
        const magenta = (TITLE_GLOW.magentaAlpha / 0xff) * label.glow
        gl.blendFunc(gl.ONE, gl.ONE)
        gl.uniform4f(this.textTint, GLOW_CYAN[0] * cyan, GLOW_CYAN[1] * cyan, GLOW_CYAN[2] * cyan, cyan)
        this.drawLabelQuad(label, TITLE_GLOW.cyanSpread, TITLE_GLOW.cyanOffsetX)
        gl.uniform4f(this.textTint, GLOW_MAGENTA[0] * magenta, GLOW_MAGENTA[1] * magenta, GLOW_MAGENTA[2] * magenta, magenta)
        this.drawLabelQuad(label, TITLE_GLOW.magentaSpread, TITLE_GLOW.magentaOffsetX)
      }
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.uniform4f(this.textTint, 1, 1, 1, 1)
      this.drawLabelQuad(label, 1, 0)
    }
  }

  private drawLabelQuad(label: TextLabel, spread: number, offsetX: number): void {
    const gl = this.gl
    const halfWidth = label.config.width * 0.5 * spread
    const halfHeight = label.config.height * 0.5 * spread
    const centerX = label.x + offsetX
    const left = centerX - halfWidth
    const right = centerX + halfWidth
    const bottom = label.y - halfHeight
    const top = label.y + halfHeight
    const vertices = this.textVertices
    vertices[0] = left
    vertices[1] = bottom
    vertices[2] = 0
    vertices[3] = 0
    vertices[4] = right
    vertices[5] = bottom
    vertices[6] = 1
    vertices[7] = 0
    vertices[8] = left
    vertices[9] = top
    vertices[10] = 0
    vertices[11] = 1
    vertices[12] = right
    vertices[13] = bottom
    vertices[14] = 1
    vertices[15] = 0
    vertices[16] = right
    vertices[17] = top
    vertices[18] = 1
    vertices[19] = 1
    vertices[20] = left
    vertices[21] = top
    vertices[22] = 0
    vertices[23] = 1
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private uploadLabelTexture(texture: WebGLTexture, label: TextLabel): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, label.raster as TexImageSource)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    label.dirty = false
  }
}
