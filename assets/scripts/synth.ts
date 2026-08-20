import { BEATMAPS } from './beatmaps.ts'

const MUSIC_NOTES = [110, 110, 164.81, 130.81, 110, 220, 146.83, 164.81] as const
const MUSIC_STEP_SECONDS = 0.36
const MUSIC_TRACKS = [
  'music/bgm.mp3',
  'music/grid-pressure.mp3',
  'music/grid-runner-pulse.mp3',
  'music/gravity-coin.mp3',
  'music/gravity-coin-alt.mp3'
] as const
const MUSIC_VOLUME = 0.24
// Fallback rotation for environments that expose neither onEnded nor duration;
// every observable InnerAudioContext rotates at the natural track end instead.
const MUSIC_FALLBACK_ROTATION_SECONDS = 60
// A track switch is accepted at most once per guard window so the onEnded
// callback and the duration poll cannot both fire for the same ending.
const MUSIC_REROTATE_GUARD_SECONDS = 1
const MUSIC_END_POLL_SECONDS = 0.2
// Re-anchor the integrated music clock onto currentTime readings once they
// drift apart by more than this; absorbs play() buffering delay, coarse
// update granularity, and slow clock drift.
const BEAT_SNAP_SECONDS = 0.12
// Keeps beat indices positive so a simple % 4 still identifies downbeats.
const BEAT_INDEX_BASE = 4096

export type AudioContextFactory = () => AudioContext | null
export type RandomSource = () => number

export interface BeatState {
  readonly secondsPerBeat: number
  readonly nextBeatIn: number
  // Index of the upcoming beat boundary; index % 4 === 0 marks a downbeat.
  readonly nextBeatIndex: number
}

interface InnerAudioContext {
  loop: boolean
  autoplay: boolean
  volume: number
  src: string
  play?(): void
  readonly currentTime?: number
  readonly duration?: number
  onEnded?(callback: () => void): void
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
  private trackEndObservable = false
  private musicPosition = 0
  private lastRotateGuardAt = -Infinity
  private lastSynthTime: number | null = null
  private beat: BeatState | null = null
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
    const now = this.lastSynthTime ?? 0
    if (now - this.lastRotateGuardAt < MUSIC_REROTATE_GUARD_SECONDS) return
    this.lastRotateGuardAt = now
    this.musicTrackIndex = this.nextTrackIndex()
    music.src = MUSIC_TRACKS[this.musicTrackIndex]
    this.musicPosition = 0
    music.play()
  }

  private startMusic(): void {
    const platform = globalThis.wx
    if (!this.musicUnlocked || !this.musicPackageReady || this.music || !platform?.createInnerAudioContext) return
    try {
      const music = platform.createInnerAudioContext()
      if (!music.play) return
      // Tracks play through in full; rotation happens at the natural end.
      music.loop = false
      music.autoplay = false
      music.volume = MUSIC_VOLUME
      this.trackEndObservable = typeof music.onEnded === 'function' || typeof music.duration === 'number'
      if (typeof music.onEnded === 'function') music.onEnded(() => this.rotateMusic())
      this.musicTrackIndex = this.nextTrackIndex()
      music.src = MUSIC_TRACKS[this.musicTrackIndex]
      this.music = music
      this.musicPosition = 0
      this.nextMusicTrackAt = null
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
    const step = this.lastSynthTime === null ? 0 : Math.max(0, time - this.lastSynthTime)
    this.lastSynthTime = time
    if (this.music) {
      this.musicPosition += step
      const observed = this.music.currentTime
      if (
        typeof observed === 'number' &&
        Number.isFinite(observed) &&
        observed >= 0 &&
        Math.abs(observed - this.musicPosition) > BEAT_SNAP_SECONDS
      ) {
        this.musicPosition = observed
      }
      if (this.trackEndObservable) {
        const duration = this.music.duration
        if (typeof duration === 'number' && duration > 0 && this.musicPosition >= duration - MUSIC_END_POLL_SECONDS) {
          this.rotateMusic()
        }
      } else {
        if (this.nextMusicTrackAt === null) this.nextMusicTrackAt = time + MUSIC_FALLBACK_ROTATION_SECONDS
        while (time >= this.nextMusicTrackAt) {
          this.rotateMusic()
          this.nextMusicTrackAt += MUSIC_FALLBACK_ROTATION_SECONDS
        }
      }
      this.beat = this.beatFromMusic()
      this.nextBeat = time
      return
    }
    if (!active || !this.context) {
      this.nextBeat = time
      this.beat = null
      return
    }
    if (time < this.nextBeat) {
      this.beat = {
        secondsPerBeat: MUSIC_STEP_SECONDS,
        nextBeatIn: this.nextBeat - time,
        nextBeatIndex: this.beatStep
      }
      return
    }
    const frequency = MUSIC_NOTES[this.beatStep % MUSIC_NOTES.length]
    this.tone(frequency, 0.16, 0.045, 'triangle', 0.72)
    this.beatStep += 1
    this.nextBeat = time + MUSIC_STEP_SECONDS
    this.beat = {
      secondsPerBeat: MUSIC_STEP_SECONDS,
      nextBeatIn: MUSIC_STEP_SECONDS,
      nextBeatIndex: this.beatStep
    }
  }

  beatSnapshot(): BeatState | null {
    return this.beat
  }

  private beatFromMusic(): BeatState | null {
    const track = MUSIC_TRACKS[this.musicTrackIndex]
    if (!track) return null
    const beatmap = BEATMAPS[track.replace(/^music\//, '')]
    if (!beatmap) return null
    const secondsPerBeat = 60 / beatmap.bpm
    const nextBeatIndex = Math.floor((this.musicPosition - beatmap.offset) / secondsPerBeat) + 1 + BEAT_INDEX_BASE
    const nextBeatAt = beatmap.offset + (nextBeatIndex - BEAT_INDEX_BASE) * secondsPerBeat
    return {
      secondsPerBeat,
      nextBeatIn: Math.max(0, nextBeatAt - this.musicPosition),
      nextBeatIndex
    }
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
