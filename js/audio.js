class AudioSystem {
  constructor(platform) {
    this.platform = platform
    this.context = null
    this.enabled = true
    this.nextBeat = 0
    this.beatStep = 0
  }

  unlock() {
    if (this.context || !this.enabled || !this.platform.createWebAudioContext) return
    try {
      this.context = this.platform.createWebAudioContext()
      if (this.context.resume) this.context.resume()
    } catch (error) {
      this.enabled = false
    }
  }

  tone(frequency, duration, type, volume, endFrequency) {
    if (!this.context || !this.enabled) return
    try {
      var now = this.context.currentTime
      var oscillator = this.context.createOscillator()
      var gain = this.context.createGain()
      oscillator.type = type || 'sine'
      oscillator.frequency.setValueAtTime(frequency, now)
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration)
      gain.gain.setValueAtTime(Math.max(0.0001, volume), now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain)
      gain.connect(this.context.destination)
      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (error) {
      this.enabled = false
    }
  }

  shot() {
    this.tone(620, 0.035, 'square', 0.025, 410)
  }

  hit() {
    this.tone(210, 0.06, 'sawtooth', 0.035, 90)
  }

  explode(size) {
    this.tone(size > 1 ? 120 : 180, size > 1 ? 0.32 : 0.16, 'sawtooth', size > 1 ? 0.11 : 0.055, 42)
  }

  bomb() {
    this.tone(72, 0.8, 'sawtooth', 0.18, 24)
    this.tone(880, 0.45, 'sine', 0.07, 110)
  }

  life() {
    this.tone(440, 0.12, 'square', 0.05, 880)
  }

  update(time, active) {
    if (!active || !this.context || time < this.nextBeat) return
    var notes = [55, 55, 82.4, 65.4, 55, 110, 73.4, 82.4]
    this.tone(notes[this.beatStep % notes.length], 0.08, 'square', 0.012, 45)
    this.beatStep += 1
    this.nextBeat = time + 0.38
  }
}

module.exports = AudioSystem
