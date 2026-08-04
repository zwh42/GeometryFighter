const math = require('./math')
const config = require('./config')

class ParticleSystem {
  constructor() {
    this.items = []
  }

  add(x, y, vx, vy, color, life, width, drag) {
    if (this.items.length >= config.WORLD.maxParticles) this.items.shift()
    this.items.push({
      x: x,
      y: y,
      oldX: x,
      oldY: y,
      vx: vx,
      vy: vy,
      color: color,
      life: life,
      maxLife: life,
      width: width || 1.5,
      drag: drag === undefined ? 0.965 : drag
    })
  }

  burst(x, y, color, count, speed, options) {
    var settings = options || {}
    for (var i = 0; i < count; i += 1) {
      var angle = Math.random() * Math.PI * 2
      var velocity = speed * math.randomRange(0.28, 1)
      var life = math.randomRange(settings.minLife || 0.28, settings.maxLife || 0.8)
      this.add(
        x + Math.cos(angle) * math.randomRange(0, settings.radius || 5),
        y + Math.sin(angle) * math.randomRange(0, settings.radius || 5),
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity,
        Math.random() < 0.18 ? config.COLORS.white : color,
        life,
        math.randomRange(settings.minWidth || 1, settings.maxWidth || 2.6),
        settings.drag
      )
    }
  }

  trail(x, y, vx, vy, color) {
    this.add(
      x + math.randomRange(-2, 2),
      y + math.randomRange(-2, 2),
      -vx * 0.2 + math.randomRange(-24, 24),
      -vy * 0.2 + math.randomRange(-24, 24),
      color,
      math.randomRange(0.16, 0.34),
      math.randomRange(0.8, 1.8),
      0.91
    )
  }

  update(dt, blackholes) {
    for (var i = this.items.length - 1; i >= 0; i -= 1) {
      var particle = this.items[i]
      particle.life -= dt
      if (particle.life <= 0) {
        this.items.splice(i, 1)
        continue
      }
      particle.oldX = particle.x
      particle.oldY = particle.y
      for (var j = 0; j < blackholes.length; j += 1) {
        var hole = blackholes[j]
        var dx = hole.x - particle.x
        var dy = hole.y - particle.y
        var distance = Math.max(28, math.length(dx, dy))
        if (distance < 230) {
          var pull = (1 - distance / 230) * 1700 * dt
          particle.vx += dx / distance * pull
          particle.vy += dy / distance * pull
        }
      }
      var damping = Math.pow(particle.drag, dt * 60)
      particle.vx *= damping
      particle.vy *= damping
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
    }
  }

  draw(ctx) {
    if (!this.items.length) return
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (var i = 0; i < this.items.length; i += 1) {
      var particle = this.items[i]
      var alpha = math.clamp(particle.life / particle.maxLife, 0, 1)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = particle.color
      ctx.lineWidth = particle.width
      ctx.shadowColor = particle.color
      ctx.shadowBlur = particle.width * 3
      ctx.beginPath()
      ctx.moveTo(particle.oldX, particle.oldY)
      ctx.lineTo(particle.x, particle.y)
      ctx.stroke()
    }
    ctx.restore()
  }
}

class GridField {
  constructor() {
    this.impulses = []
    this.time = 0
  }

  pulse(x, y, strength, color) {
    this.impulses.push({
      x: x,
      y: y,
      strength: strength,
      life: 1,
      age: 0,
      color: color || config.COLORS.gridHot
    })
    if (this.impulses.length > 14) this.impulses.shift()
  }

  update(dt) {
    this.time += dt
    for (var i = this.impulses.length - 1; i >= 0; i -= 1) {
      var impulse = this.impulses[i]
      impulse.age += dt
      impulse.life -= dt * 0.72
      if (impulse.life <= 0) this.impulses.splice(i, 1)
    }
  }

  distort(x, y, blackholes) {
    var offsetX = Math.sin(y * 0.025 + this.time * 0.7) * 0.7
    var offsetY = Math.sin(x * 0.021 - this.time * 0.55) * 0.7
    for (var i = 0; i < this.impulses.length; i += 1) {
      var impulse = this.impulses[i]
      var dx = x - impulse.x
      var dy = y - impulse.y
      var distance = Math.max(1, math.length(dx, dy))
      if (distance < 230) {
        var wave = Math.sin(distance * 0.075 - impulse.age * 9.5)
        var force = impulse.strength * impulse.life * (1 - distance / 230) * wave
        offsetX += dx / distance * force
        offsetY += dy / distance * force
      }
    }
    for (var j = 0; j < blackholes.length; j += 1) {
      var hole = blackholes[j]
      var hx = hole.x - x
      var hy = hole.y - y
      var holeDistance = Math.max(18, math.length(hx, hy))
      if (holeDistance < 190) {
        var pull = (1 - holeDistance / 190) * (32 + hole.mass * 2)
        offsetX += hx / holeDistance * pull
        offsetY += hy / holeDistance * pull
      }
    }
    return { x: x + offsetX, y: y + offsetY }
  }
}

module.exports = {
  ParticleSystem: ParticleSystem,
  GridField: GridField
}
