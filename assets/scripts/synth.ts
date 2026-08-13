const MUSIC_NOTES = [110, 110, 164.81, 130.81, 110, 220, 146.83, 164.81] as const
const MUSIC_STEP_SECONDS = 0.36
const MUSIC_TRACK = 'music/bgm.mp3'
const MUSIC_VOLUME = 0.24

interface InnerAudioContext {
  loop: boolean
  autoplay: boolean
  volume: number
  src: string
  play?(): void
}

interface MiniGamePlatform {
  createWebAudioContext?(): AudioContext
  createInnerAudioContext?(): InnerAudioContext
}

declare global {
  var wx: MiniGamePlatform | undefined
}

export type AudioContextFactory = () => AudioContext | null

function createAudioContext(): AudioContext | null {
  const platform = globalThis.wx
  if (platform?.createWebAudioContext) return platform.createWebAudioContext()
  if (typeof globalThis.AudioContext !== 'undefined') return new globalThis.AudioContext()
  return null
}

export class Synth {
  private context: AudioContext | null = null
  private music: InnerAudioContext | null = null
  private readonly contextFactory: AudioContextFactory
  private nextBeat = 0
  private beatStep = 0

  constructor(contextFactory: AudioContextFactory = createAudioContext) {
    this.contextFactory = contextFactory
  }

  private startMusic(): void {
    const platform = globalThis.wx
    if (this.music || !platform?.createInnerAudioContext) return
    try {
      const music = platform.createInnerAudioContext()
      if (!music.play) return
      music.loop = true
      music.autoplay = false
      music.volume = MUSIC_VOLUME
      music.src = MUSIC_TRACK
      this.music = music
      music.play()
    } catch (error) {
      this.music = null
      if (!(error instanceof Error)) throw error
    }
  }

  unlock(): void {
    this.startMusic()
    if (!this.context) {
      try {
        this.context = this.contextFactory()
      } catch (error) {
        this.context = null
        if (!(error instanceof Error)) throw error
      }
    }
    if (this.context?.state === 'suspended') void this.context.resume()
  }

  update(time: number, active: boolean): void {
    if (!active || !this.context || this.music) {
      this.nextBeat = time
      return
    }
    if (time < this.nextBeat) return
    const frequency = MUSIC_NOTES[this.beatStep % MUSIC_NOTES.length]
    this.tone(frequency, 0.16, 0.045, 'triangle', 0.72)
    this.beatStep += 1
    this.nextBeat = time + MUSIC_STEP_SECONDS
  }

  tone(frequency: number, duration: number, volume: number, type: OscillatorType, slide = 1): void {
    const context = this.context
    if (!context) return
    const start = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency * slide), start + duration)
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }
}
