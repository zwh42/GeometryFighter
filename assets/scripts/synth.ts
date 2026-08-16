const MUSIC_NOTES = [110, 110, 164.81, 130.81, 110, 220, 146.83, 164.81] as const
const MUSIC_STEP_SECONDS = 0.36
const MUSIC_TRACKS = [
  'music/bgm.mp3',
  'music/grid-pressure.mp3',
  'music/grid-runner-pulse.mp3',
  'music/gravity-coin.mp3',
  'music/gravity-coin-alt.mp3'
] as const
const MUSIC_ROTATION_SECONDS = 60
const MUSIC_VOLUME = 0.24

export type AudioContextFactory = () => AudioContext | null
export type RandomSource = () => number

interface InnerAudioContext {
  loop: boolean
  autoplay: boolean
  volume: number
  src: string
  play?(): void
}

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
  private readonly random: RandomSource
  private musicPackageReady: boolean
  private musicUnlocked = false
  private musicTrackIndex = -1
  private nextMusicTrackAt: number | null = null
  private nextBeat = 0
  private beatStep = 0

  constructor(contextFactory: AudioContextFactory = createAudioContext, random: RandomSource = Math.random) {
    this.contextFactory = contextFactory
    this.random = random
    const platform = globalThis.wx
    this.musicPackageReady = !platform?.loadSubpackage
    platform?.loadSubpackage?.({
      name: 'music',
      success: () => {
        this.musicPackageReady = true
        this.startMusic()
      }
    })
  }

  private nextTrackIndex(): number {
    if (this.musicTrackIndex < 0) return Math.min(MUSIC_TRACKS.length - 1, Math.floor(this.random() * MUSIC_TRACKS.length))
    const candidate = Math.min(MUSIC_TRACKS.length - 2, Math.floor(this.random() * (MUSIC_TRACKS.length - 1)))
    return candidate >= this.musicTrackIndex ? candidate + 1 : candidate
  }

  private rotateMusic(): void {
    const music = this.music
    if (!music?.play) return
    this.musicTrackIndex = this.nextTrackIndex()
    music.src = MUSIC_TRACKS[this.musicTrackIndex]
    music.play()
  }

  private startMusic(): void {
    const platform = globalThis.wx
    if (!this.musicUnlocked || !this.musicPackageReady || this.music || !platform?.createInnerAudioContext) return
    try {
      const music = platform.createInnerAudioContext()
      if (!music.play) return
      music.loop = true
      music.autoplay = false
      music.volume = MUSIC_VOLUME
      this.musicTrackIndex = this.nextTrackIndex()
      music.src = MUSIC_TRACKS[this.musicTrackIndex]
      this.music = music
      music.play()
    } catch (error) {
      this.music = null
      if (!(error instanceof Error)) throw error
    }
  }

  unlock(): void {
    this.musicUnlocked = true
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
    if (this.music) {
      if (this.nextMusicTrackAt === null) this.nextMusicTrackAt = time + MUSIC_ROTATION_SECONDS
      while (time >= this.nextMusicTrackAt) {
        this.rotateMusic()
        this.nextMusicTrackAt += MUSIC_ROTATION_SECONDS
      }
      this.nextBeat = time
      return
    }
    if (!active || !this.context) {
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
