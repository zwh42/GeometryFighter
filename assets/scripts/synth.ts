const MUSIC_NOTES = [110, 110, 164.81, 130.81, 110, 220, 146.83, 164.81] as const
const MUSIC_STEP_SECONDS = 0.36

interface MiniGamePlatform {
  createWebAudioContext?(): AudioContext
}

declare const wx: MiniGamePlatform | undefined

export type AudioContextFactory = () => AudioContext | null

function createAudioContext(): AudioContext | null {
  if (typeof wx !== 'undefined' && wx.createWebAudioContext) return wx.createWebAudioContext()
  if (typeof AudioContext !== 'undefined') return new AudioContext()
  return null
}

export class Synth {
  private context: AudioContext | null = null
  private readonly contextFactory: AudioContextFactory
  private nextBeat = 0
  private beatStep = 0

  constructor(contextFactory: AudioContextFactory = createAudioContext) {
    this.contextFactory = contextFactory
  }

  unlock(): void {
    if (!this.context) this.context = this.contextFactory()
    if (this.context?.state === 'suspended') void this.context.resume()
  }

  update(time: number, active: boolean): void {
    if (!active || !this.context) {
      this.nextBeat = time
      return
    }
    if (time < this.nextBeat) return
    const frequency = MUSIC_NOTES[this.beatStep % MUSIC_NOTES.length]
    this.tone(frequency, 0.16, 0.02, 'triangle', 0.72)
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
