'use strict'

// Offline beat-map extractor for the rhythm-spawn feature. Decodes every
// soundtrack in music/ to mono PCM via ffmpeg, estimates a steady 4/4 beat
// grid (tempo, phase, downbeat) from the onset envelope, and regenerates
// assets/scripts/beatmaps.ts. Tracks whose onsets do not fit one constant
// grid are left out so the runtime falls back to the legacy spawn pacing
// rather than spawning off-beat. Re-run after replacing any file in music/:
//
//   node scripts/analyze-beats.js

const { execFileSync } = require('node:child_process')
const { readdirSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const project = resolve(__dirname, '..')
const musicDirectory = join(project, 'music')
const outputFile = join(project, 'assets', 'scripts', 'beatmaps.ts')

const SAMPLE_RATE = 22050
const FRAME_SIZE = 1024
const HOP_SIZE = 512
const HOP_SECONDS = HOP_SIZE / SAMPLE_RATE
const LOW_BAND_HZ = 150
const MIN_BPM = 70
const MAX_BPM = 180
const BPM_STEP = 0.5
const BPM_REFINE_STEP = 0.02
const PRIOR_CENTER_BPM = 122
const PRIOR_WIDTH_OCTAVES = 0.45
const HARMONIC_HALF_WEIGHT = 0.35
const HARMONIC_DOUBLE_WEIGHT = 0.2
const TEMPO_SCAN_SECONDS = 300
const ONSET_TOLERANCE_SECONDS = 0.07
const MIN_GRID_RATIO = 1.5
const MIN_ONSET_ALIGNMENT = 0.45
const MAX_SEGMENT_DEVIATION_SECONDS = 0.055
const SEGMENT_SECONDS = 60

function decodePcm(file) {
  const buffer = execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'],
    { maxBuffer: 512 * 1024 * 1024 }
  )
  const sampleCount = Math.floor(buffer.byteLength / 4)
  if (sampleCount < SAMPLE_RATE * 10) throw new Error(`Decoded audio too short: ${file}`)
  return new Float32Array(buffer.buffer, buffer.byteOffset, sampleCount)
}

function frameEnergy(pcm, lowBandOnly) {
  const frameCount = Math.floor((pcm.length - FRAME_SIZE) / HOP_SIZE) + 1
  const energy = new Float64Array(frameCount)
  const lowPassCoef = Math.exp((-2 * Math.PI * LOW_BAND_HZ) / SAMPLE_RATE)
  let lowPassState = 0
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * HOP_SIZE
    let sum = 0
    for (let index = 0; index < FRAME_SIZE; index += 1) {
      let sample = pcm[start + index]
      if (lowBandOnly) {
        lowPassState = sample + lowPassCoef * (lowPassState - sample)
        sample = lowPassState
      }
      sum += sample * sample
    }
    energy[frame] = Math.log(1 + 2000 * Math.sqrt(sum / FRAME_SIZE))
  }
  return energy
}

function onsetFlux(energy) {
  const flux = new Float64Array(energy.length)
  for (let frame = 1; frame < energy.length; frame += 1) {
    flux[frame] = Math.max(0, energy[frame] - energy[frame - 1])
  }
  return flux
}

function maxSmooth(envelope, radius) {
  const smoothed = new Float64Array(envelope.length)
  for (let frame = 0; frame < envelope.length; frame += 1) {
    let peak = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = frame + offset
      if (index >= 0 && index < envelope.length && envelope[index] > peak) peak = envelope[index]
    }
    smoothed[frame] = peak
  }
  return smoothed
}

function sampleAt(envelope, positionFrames) {
  const lower = Math.floor(positionFrames)
  if (lower < 0 || lower + 1 >= envelope.length) return 0
  const fraction = positionFrames - lower
  return envelope[lower] * (1 - fraction) + envelope[lower + 1] * fraction
}

function meanGridScore(envelope, secondsPerBeat, offsetSeconds, fromSeconds, toSeconds) {
  const step = secondsPerBeat / HOP_SECONDS
  const start = offsetSeconds / HOP_SECONDS
  const limit = toSeconds / HOP_SECONDS
  let total = 0
  let count = 0
  for (let position = start; position < limit; position += step) {
    total += sampleAt(envelope, position)
    count += 1
  }
  return count === 0 ? 0 : total / count
}

function tempoPrior(bpm) {
  const octaves = Math.log(bpm / PRIOR_CENTER_BPM) / Math.LN2
  return Math.exp(-0.5 * (octaves / PRIOR_WIDTH_OCTAVES) ** 2)
}

function bestPhaseScore(envelope, secondsPerBeat, durationSeconds) {
  let best = 0
  const phaseSteps = Math.max(1, Math.round(secondsPerBeat / HOP_SECONDS))
  for (let step = 0; step < phaseSteps; step += 1) {
    const offset = (step * secondsPerBeat) / phaseSteps
    const score = meanGridScore(envelope, secondsPerBeat, offset, 0, durationSeconds)
    if (score > best) best = score
  }
  return best
}

function estimateTempo(flux, durationSeconds) {
  const scanDuration = Math.min(durationSeconds, TEMPO_SCAN_SECONDS)
  let bestBpm = 0
  let bestScore = -Infinity
  for (let bpm = MIN_BPM; bpm <= MAX_BPM + 1e-9; bpm += BPM_STEP) {
    const score =
      (bestPhaseScore(flux, 60 / bpm, scanDuration) +
        HARMONIC_HALF_WEIGHT * bestPhaseScore(flux, 120 / bpm, scanDuration) +
        HARMONIC_DOUBLE_WEIGHT * bestPhaseScore(flux, 30 / bpm, scanDuration)) *
      tempoPrior(bpm)
    if (score > bestScore) {
      bestScore = score
      bestBpm = bpm
    }
  }
  let refined = bestBpm
  let refinedScore = bestScore
  for (let bpm = bestBpm - BPM_STEP; bpm <= bestBpm + BPM_STEP; bpm += BPM_REFINE_STEP) {
    if (bpm < MIN_BPM || bpm > MAX_BPM) continue
    const score =
      (bestPhaseScore(flux, 60 / bpm, scanDuration) +
        HARMONIC_HALF_WEIGHT * bestPhaseScore(flux, 120 / bpm, scanDuration)) *
      tempoPrior(bpm)
    if (score > refinedScore) {
      refinedScore = score
      refined = bpm
    }
  }
  return refined
}

function estimateOffset(flux, secondsPerBeat, durationSeconds) {
  const raw = flux
  let bestOffset = 0
  let bestScore = -Infinity
  const fineSteps = Math.max(16, Math.round(secondsPerBeat / 0.001))
  for (let step = 0; step < fineSteps; step += 1) {
    const offset = (step * secondsPerBeat) / fineSteps
    const score = meanGridScore(raw, secondsPerBeat, offset, 0, durationSeconds)
    if (score > bestScore) {
      bestScore = score
      bestOffset = offset
    }
  }
  return bestOffset
}

function estimateDownbeat(lowEnergy, secondsPerBeat, offset, durationSeconds) {
  let bestIndex = 0
  let bestScore = -Infinity
  for (let index = 0; index < 4; index += 1) {
    const score = meanGridScore(lowEnergy, secondsPerBeat * 4, offset + index * secondsPerBeat, 0, durationSeconds)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestIndex
}

function onsetPeaks(flux) {
  const peaks = []
  let sum = 0
  for (const value of flux) sum += value
  const threshold = (sum / flux.length) * 1.4
  for (let frame = 1; frame < flux.length - 1; frame += 1) {
    if (flux[frame] >= threshold && flux[frame] >= flux[frame - 1] && flux[frame] > flux[frame + 1]) {
      peaks.push({ time: frame * HOP_SECONDS, strength: flux[frame] })
    }
  }
  peaks.sort((a, b) => b.strength - a.strength)
  return peaks.slice(0, Math.max(64, Math.floor(peaks.length * 0.5)))
}

function distanceToGrid(time, offset, secondsPerBeat) {
  const phase = (time - offset) / secondsPerBeat
  return Math.abs(phase - Math.round(phase)) * secondsPerBeat
}

function analyzeTrack(file) {
  const pcm = decodePcm(file)
  const duration = pcm.length / SAMPLE_RATE
  // The beat carrier is the kick drum, so every grid decision below runs on
  // the low-band flux; full-band onsets (hats, melody) only blur the metrics.
  const lowEnergy = frameEnergy(pcm, true)
  const flux = onsetFlux(lowEnergy)
  const scoringFlux = maxSmooth(flux, 1)

  const bpm = estimateTempo(scoringFlux, duration)
  const secondsPerBeat = 60 / bpm
  let offset = estimateOffset(scoringFlux, secondsPerBeat, duration)
  const downbeat = estimateDownbeat(lowEnergy, secondsPerBeat, offset, duration)
  offset = (offset + downbeat * secondsPerBeat) % secondsPerBeat

  const peaks = onsetPeaks(flux)
  let alignedStrength = 0
  let totalStrength = 0
  for (const peak of peaks) {
    totalStrength += peak.strength
    if (distanceToGrid(peak.time, offset, secondsPerBeat) <= ONSET_TOLERANCE_SECONDS) alignedStrength += peak.strength
  }
  const alignment = totalStrength === 0 ? 0 : alignedStrength / totalStrength

  const gridMean = meanGridScore(flux, secondsPerBeat, offset, 0, duration)
  let overallMean = 0
  for (const value of flux) overallMean += value
  overallMean /= flux.length
  const gridRatio = overallMean === 0 ? 0 : gridMean / overallMean

  // A constant-BPM grid must hold for the whole track: if any 60s segment
  // prefers a phase far from the global one the tempo drifts and the runtime
  // grid would slide off the audible beats late in the track.
  let worstSegmentDeviation = 0
  for (let start = 0; start < duration; start += SEGMENT_SECONDS) {
    const end = Math.min(duration, start + SEGMENT_SECONDS)
    if (end - start < 20) continue
    let bestScore = -Infinity
    let bestShift = 0
    for (let shift = -secondsPerBeat / 2; shift <= secondsPerBeat / 2 + 1e-9; shift += 0.002) {
      let shifted = (offset + shift) % secondsPerBeat
      if (shifted < 0) shifted += secondsPerBeat
      const score = meanGridScore(scoringFlux, secondsPerBeat, shifted, start, end)
      if (score > bestScore) {
        bestScore = score
        bestShift = shift
      }
    }
    worstSegmentDeviation = Math.max(worstSegmentDeviation, Math.abs(bestShift))
  }

  const reasons = []
  if (gridRatio < MIN_GRID_RATIO) reasons.push(`grid ratio ${gridRatio.toFixed(2)} < ${MIN_GRID_RATIO}`)
  if (alignment < MIN_ONSET_ALIGNMENT) {
    reasons.push(`kick strength on grid ${(alignment * 100).toFixed(0)}% < ${(MIN_ONSET_ALIGNMENT * 100).toFixed(0)}%`)
  }
  if (worstSegmentDeviation > MAX_SEGMENT_DEVIATION_SECONDS) {
    reasons.push(`segment phase drift ${(worstSegmentDeviation * 1000).toFixed(0)}ms > ${(MAX_SEGMENT_DEVIATION_SECONDS * 1000).toFixed(0)}ms`)
  }

  return {
    bpm: Math.round(bpm * 100) / 100,
    offset: Math.round(offset * 1000) / 1000,
    duration,
    gridRatio,
    alignment,
    worstSegmentDeviation,
    rejected: reasons
  }
}

function renderBeatmaps(results) {
  const accepted = results.filter((result) => result.rejected.length === 0)
  const rejected = results.filter((result) => result.rejected.length > 0)
  const lines = [
    '// Generated by scripts/analyze-beats.js — do not edit by hand.',
    '// Re-run the script after replacing any file in music/. Tracks whose',
    '// onsets do not lock to one constant grid are omitted here on purpose:',
    '// the spawner falls back to its legacy pacing for those tracks.',
    'export interface Beatmap {',
    '  readonly bpm: number',
    "  // seconds from track start to the first downbeat's onset",
    '  readonly offset: number',
    '}',
    '',
    `export const BEATMAPS: Record<string, Beatmap> = {`
  ]
  for (const result of accepted) {
    lines.push(`  '${result.file}': { bpm: ${result.bpm}, offset: ${result.offset} },`)
  }
  for (const result of rejected) {
    lines.push(`  // '${result.file}' excluded: ${result.rejected.join('; ')}`)
  }
  lines.push('}', '')
  return lines.join('\n')
}

function main() {
  const files = readdirSync(musicDirectory).filter((name) => name.endsWith('.mp3')).sort()
  if (files.length === 0) throw new Error(`No mp3 files found in ${musicDirectory}`)
  const results = []
  for (const file of files) {
    process.stdout.write(`Analyzing ${file} ... `)
    const analysis = analyzeTrack(join(musicDirectory, file))
    results.push({ file, ...analysis })
    const verdict = analysis.rejected.length === 0 ? 'OK' : `EXCLUDED (${analysis.rejected.join('; ')})`
    console.log(
      `${analysis.bpm} BPM, offset ${analysis.offset.toFixed(3)}s, ${analysis.duration.toFixed(0)}s, ` +
        `grid ${analysis.gridRatio.toFixed(2)}, align ${(analysis.alignment * 100).toFixed(0)}%, ` +
        `drift ${(analysis.worstSegmentDeviation * 1000).toFixed(0)}ms — ${verdict}`
    )
  }
  writeFileSync(outputFile, renderBeatmaps(results))
  const accepted = results.filter((result) => result.rejected.length === 0).length
  console.log(`\nWrote ${outputFile} (${accepted}/${results.length} tracks mapped).`)
}

module.exports = {
  SAMPLE_RATE,
  HOP_SECONDS,
  decodePcm,
  frameEnergy,
  onsetFlux,
  maxSmooth,
  estimateTempo,
  estimateOffset,
  meanGridScore,
  onsetPeaks,
  distanceToGrid
}

if (require.main === module) main()
