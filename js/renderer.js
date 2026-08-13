const math = require('./math')
const config = require('./config')

class Renderer {
  constructor(canvas, context, input, grid, particles) {
    this.ctx = context
    this.input = input
    this.grid = grid
    this.particles = particles
    this.width = 0
    this.height = 0
    this.stars = []
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.stars.length = 0
    var count = Math.floor(width * height / 4300)
    for (var i = 0; i < count; i += 1) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: math.randomRange(0.35, 1.4),
        phase: Math.random() * Math.PI * 2
      })
    }
  }

  render(game) {
    var ctx = this.ctx
    var shakeX = game.shake > 0 ? math.randomRange(-game.shake, game.shake) : 0
    var shakeY = game.shake > 0 ? math.randomRange(-game.shake, game.shake) : 0
    ctx.save()
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0)
    ctx.fillStyle = config.COLORS.background
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.translate(shakeX, shakeY)
    this.drawStars(game.time)
    this.drawGrid(game)
    this.drawShockwaves(game)
    this.drawPlayerTrail(game.player)
    this.particles.draw(ctx)
    this.drawBullets(game.bullets)
    this.drawEnemies(game.enemies, game.time)
    this.drawPlayer(game.player, game.time)
    this.drawPopups(game.popups)
    this.drawHud(game)
    this.drawControls(game)
    ctx.restore()
    if (game.flash > 0) {
      ctx.save()
      ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0)
      ctx.globalAlpha = math.clamp(game.flash, 0, 0.72)
      ctx.fillStyle = config.COLORS.white
      ctx.fillRect(0, 0, this.width, this.height)
      ctx.restore()
    }
    if (game.state !== 'playing' || game.paused) this.drawOverlay(game)
  }

  font(tokenName, size) {
    var token = config.TYPOGRAPHY[tokenName]
    var fontSize = size === undefined ? token.size : size
    return (token.weight === 'normal' ? '' : token.weight + ' ') + fontSize + 'px ' + token.family
  }

  drawStars(time) {
    var ctx = this.ctx
    ctx.save()
    for (var i = 0; i < this.stars.length; i += 1) {
      var star = this.stars[i]
      ctx.globalAlpha = 0.16 + (Math.sin(time * 1.9 + star.phase) + 1) * 0.13
      ctx.fillStyle = config.COLORS.white
      ctx.fillRect(star.x, star.y, star.size, star.size)
    }
    ctx.restore()
  }

  drawGrid(game) {
    var ctx = this.ctx
    var margin = config.WORLD.margin
    var step = config.WORLD.gridSize
    var left = margin
    var top = margin
    var right = this.width - margin
    var bottom = this.height - margin
    var blackholes = game.blackholes
    ctx.save()
    ctx.strokeStyle = config.COLORS.grid
    ctx.lineWidth = 0.7
    ctx.globalAlpha = 0.27
    for (var y = top; y <= bottom; y += step) {
      ctx.beginPath()
      for (var x = left; x <= right; x += 12) {
        var horizontal = this.grid.distort(x, y, blackholes)
        if (x === left) ctx.moveTo(horizontal.x, horizontal.y)
        else ctx.lineTo(horizontal.x, horizontal.y)
      }
      ctx.stroke()
    }
    for (var gx = left; gx <= right; gx += step) {
      ctx.beginPath()
      for (var gy = top; gy <= bottom; gy += 12) {
        var vertical = this.grid.distort(gx, gy, blackholes)
        if (gy === top) ctx.moveTo(vertical.x, vertical.y)
        else ctx.lineTo(vertical.x, vertical.y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = config.COLORS.white
    ctx.lineWidth = 1.5
    ctx.shadowColor = config.COLORS.cyan
    ctx.shadowBlur = 10
    ctx.strokeRect(left, top, right - left, bottom - top)
    ctx.restore()
  }

  drawShockwaves(game) {
    var ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (var i = 0; i < game.shockwaves.length; i += 1) {
      var wave = game.shockwaves[i]
      ctx.globalAlpha = wave.life * 0.8
      ctx.strokeStyle = wave.color
      ctx.lineWidth = 2 + wave.life * 4
      ctx.shadowColor = wave.color
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawPlayerTrail(player) {
    if (!player || player.trail.length < 2) return
    var ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (var i = 1; i < player.trail.length; i += 1) {
      var previous = player.trail[i - 1]
      var current = player.trail[i]
      ctx.globalAlpha = (i / player.trail.length) * 0.35
      ctx.strokeStyle = config.COLORS.orange
      ctx.lineWidth = 1 + i / player.trail.length * 2
      ctx.beginPath()
      ctx.moveTo(previous.x, previous.y)
      ctx.lineTo(current.x, current.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawBullets(bullets) {
    var ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    for (var i = 0; i < bullets.length; i += 1) {
      var bullet = bullets[i]
      ctx.globalAlpha = math.clamp(bullet.life * 2, 0.25, 1)
      ctx.strokeStyle = bullet.color
      ctx.lineWidth = bullet.width
      ctx.shadowColor = bullet.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(bullet.oldX, bullet.oldY)
      ctx.lineTo(bullet.x, bullet.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawPlayer(player, time) {
    if (!player || player.deadTimer > 0) return
    if (player.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) return
    var ctx = this.ctx
    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(player.angle)
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = config.COLORS.white
    ctx.shadowColor = config.COLORS.cyan
    ctx.shadowBlur = config.FIGHTER.glowBlur
    this.drawFighterPath(config.FIGHTER.outerPath, config.FIGHTER.outerStroke)
    this.drawFighterPath(config.FIGHTER.innerPath, config.FIGHTER.innerStroke)
    ctx.restore()
  }

  drawFighterPath(points, stroke) {
    var ctx = this.ctx
    ctx.lineWidth = stroke
    ctx.beginPath()
    for (var index = 0; index < points.length; index += 1) {
      if (index === 0) ctx.moveTo(points[index][0], points[index][1])
      else ctx.lineTo(points[index][0], points[index][1])
    }
    ctx.stroke()
  }

  drawEnemies(enemies, time) {
    for (var i = 0; i < enemies.length; i += 1) {
      this.drawEnemy(enemies[i], time)
    }
  }

  prepareEnemy(enemy) {
    var ctx = this.ctx
    var spawnScale = enemy.spawn > 0 ? math.clamp(1 - enemy.spawn / 0.55, 0.08, 1) : 1
    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.rotate(enemy.angle)
    ctx.scale(spawnScale, spawnScale)
    ctx.globalAlpha = enemy.spawn > 0 ? 0.35 + spawnScale * 0.65 : 1
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = enemy.color
    ctx.fillStyle = enemy.color
    ctx.lineWidth = 1.7
    ctx.shadowColor = enemy.color
    ctx.shadowBlur = 11
  }

  drawEnemy(enemy, time) {
    var ctx = this.ctx
    this.prepareEnemy(enemy)
    if (enemy.type === 'wanderer') {
      for (var arm = 0; arm < 4; arm += 1) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(2, 0)
        ctx.lineTo(enemy.radius * 0.42, -enemy.radius * 0.32)
        ctx.lineTo(enemy.radius, -enemy.radius * 0.08)
        ctx.lineTo(enemy.radius * 0.58, enemy.radius * 0.2)
        ctx.stroke()
      }
    } else if (enemy.type === 'grunt') {
      this.polygon(enemy.radius, 4, Math.PI / 4)
      ctx.beginPath()
      ctx.moveTo(-enemy.radius * 0.7, 0)
      ctx.lineTo(enemy.radius * 0.7, 0)
      ctx.moveTo(0, -enemy.radius * 0.7)
      ctx.lineTo(0, enemy.radius * 0.7)
      ctx.stroke()
    } else if (enemy.type === 'weaver') {
      ctx.strokeRect(-enemy.radius * 0.65, -enemy.radius * 0.65, enemy.radius * 1.3, enemy.radius * 1.3)
      this.polygon(enemy.radius * 0.74, 4, Math.PI / 4)
      ctx.beginPath()
      ctx.moveTo(-enemy.radius * 0.65, -enemy.radius * 0.65)
      ctx.lineTo(0, -enemy.radius * 0.74)
      ctx.moveTo(enemy.radius * 0.65, -enemy.radius * 0.65)
      ctx.lineTo(enemy.radius * 0.74, 0)
      ctx.stroke()
    } else if (enemy.type === 'spinner') {
      ctx.strokeRect(-enemy.radius * 0.72, -enemy.radius * 0.72, enemy.radius * 1.44, enemy.radius * 1.44)
      ctx.beginPath()
      ctx.moveTo(-enemy.radius * 0.72, -enemy.radius * 0.72)
      ctx.lineTo(enemy.radius * 0.72, enemy.radius * 0.72)
      ctx.moveTo(enemy.radius * 0.72, -enemy.radius * 0.72)
      ctx.lineTo(-enemy.radius * 0.72, enemy.radius * 0.72)
      ctx.stroke()
    } else if (enemy.type === 'snake') {
      ctx.restore()
      this.drawSnake(enemy)
      return
    } else if (enemy.type === 'repulsar') {
      ctx.beginPath()
      ctx.moveTo(enemy.radius, 0)
      ctx.lineTo(enemy.radius * 0.15, -enemy.radius * 0.62)
      ctx.lineTo(-enemy.radius * 0.72, -enemy.radius * 0.42)
      ctx.lineTo(-enemy.radius * 0.35, 0)
      ctx.lineTo(-enemy.radius * 0.72, enemy.radius * 0.42)
      ctx.lineTo(enemy.radius * 0.15, enemy.radius * 0.62)
      ctx.closePath()
      ctx.stroke()
      ctx.strokeStyle = config.COLORS.cyan
      ctx.shadowColor = config.COLORS.cyan
      ctx.beginPath()
      ctx.moveTo(-enemy.radius * 0.72, -enemy.radius * 0.42)
      ctx.lineTo(-enemy.radius, 0)
      ctx.lineTo(-enemy.radius * 0.72, enemy.radius * 0.42)
      ctx.stroke()
    } else if (enemy.type === 'blackhole') {
      this.drawBlackhole(enemy, time)
    }
    if (enemy.spawn > 0) {
      ctx.globalAlpha = enemy.spawn / 0.55
      ctx.beginPath()
      ctx.arc(0, 0, enemy.radius * (1.7 + enemy.spawn * 3), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  polygon(radius, sides, rotation) {
    var ctx = this.ctx
    ctx.beginPath()
    for (var i = 0; i < sides; i += 1) {
      var angle = rotation + i / sides * Math.PI * 2
      var x = Math.cos(angle) * radius
      var y = Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  drawSnake(enemy) {
    var ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = enemy.color
    ctx.shadowColor = enemy.color
    ctx.shadowBlur = 10
    ctx.lineWidth = 1.7
    for (var i = enemy.segments.length - 1; i >= 0; i -= 1) {
      var segment = enemy.segments[i]
      var size = enemy.radius * (0.46 + (enemy.segments.length - i) * 0.045)
      ctx.save()
      ctx.translate(segment.x, segment.y)
      ctx.rotate(segment.angle)
      ctx.strokeRect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4)
      ctx.restore()
    }
    ctx.strokeStyle = config.COLORS.cyan
    ctx.shadowColor = config.COLORS.cyan
    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.rotate(enemy.angle)
    ctx.beginPath()
    ctx.moveTo(enemy.radius, 0)
    ctx.lineTo(-enemy.radius * 0.55, -enemy.radius * 0.72)
    ctx.lineTo(-enemy.radius * 0.25, 0)
    ctx.lineTo(-enemy.radius * 0.55, enemy.radius * 0.72)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
    ctx.restore()
  }

  drawBlackhole(enemy, time) {
    var ctx = this.ctx
    var radius = enemy.radius + enemy.mass * 0.55
    ctx.fillStyle = config.COLORS.background
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    for (var ring = 0; ring < 3; ring += 1) {
      ctx.strokeStyle = ring === 1 ? config.COLORS.orange : config.COLORS.red
      ctx.beginPath()
      ctx.arc(0, 0, radius + ring * 5, time * (1.2 + ring * 0.3) + ring, time * (1.2 + ring * 0.3) + ring + Math.PI * (1.15 + ring * 0.17))
      ctx.stroke()
    }
    ctx.strokeStyle = config.COLORS.violet
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.48, -time * 1.7, -time * 1.7 + Math.PI * 1.35)
    ctx.stroke()
  }

  drawPopups(popups) {
    var ctx = this.ctx
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = this.font('popup')
    for (var i = 0; i < popups.length; i += 1) {
      var popup = popups[i]
      ctx.globalAlpha = math.clamp(popup.life * 1.8, 0, 1)
      ctx.fillStyle = popup.color
      ctx.shadowColor = popup.color
      ctx.shadowBlur = 8
      ctx.fillText(popup.text, popup.x, popup.y)
    }
    ctx.restore()
  }

  drawHud(game) {
    var ctx = this.ctx
    var top = 24
    ctx.save()
    ctx.fillStyle = config.COLORS.hud
    ctx.shadowColor = config.COLORS.hud
    ctx.shadowBlur = 7
    ctx.textBaseline = 'top'
    ctx.font = this.font('hudLabel')
    ctx.textAlign = 'left'
    ctx.fillText('SCORE', 28, top)
    ctx.font = this.font('hudValue')
    ctx.fillText(this.formatScore(game.score), 28, top + 13)
    ctx.textAlign = 'right'
    ctx.font = this.font('hudLabel')
    ctx.fillText('HIGH SCORE', this.width - 28, top)
    ctx.font = this.font('hudValue')
    ctx.fillText(this.formatScore(game.highScore), this.width - 28, top + 13)
    ctx.textAlign = 'center'
    ctx.font = this.font('hudMultiplier')
    ctx.fillText('×' + game.multiplier, this.width * 0.5, top + 6)
    this.drawLifeBombIcons(game, top + 31)
    if (game.messageTimer > 0) {
      ctx.globalAlpha = math.clamp(game.messageTimer, 0, 1)
      ctx.font = this.font('message')
      ctx.fillStyle = config.COLORS.white
      ctx.shadowColor = config.COLORS.cyan
      ctx.fillText(game.message, this.width * 0.5, 71)
    }
    ctx.restore()
  }

  drawLifeBombIcons(game, y) {
    var ctx = this.ctx
    var totalWidth = game.lives * 14 + game.bombs * 14 + 18
    var x = this.width * 0.5 - totalWidth * 0.5
    ctx.save()
    ctx.lineWidth = 1.4
    for (var i = 0; i < game.lives; i += 1) {
      ctx.strokeStyle = config.COLORS.hud
      ctx.beginPath()
      ctx.moveTo(x + 10, y)
      ctx.lineTo(x, y - 5)
      ctx.lineTo(x + 3, y)
      ctx.lineTo(x, y + 5)
      ctx.closePath()
      ctx.stroke()
      x += 14
    }
    x += 12
    for (var j = 0; j < game.bombs; j += 1) {
      ctx.strokeStyle = config.COLORS.hud
      ctx.beginPath()
      ctx.arc(x + 4, y, 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + 4, y, 1.5, 0, Math.PI * 2)
      ctx.stroke()
      x += 14
    }
    ctx.restore()
  }

  formatScore(score) {
    var raw = String(Math.max(0, Math.floor(score)))
    while (raw.length < 7) raw = '0' + raw
    return raw
  }

  drawControls(game) {
    if (game.state !== 'playing' || game.paused) return
    var heading = this.input.singleHanded && game.hasFireHeading ? game.fireHeading : null
    this.drawStick(this.input.left, config.COLORS.cyan, heading)
    if (!this.input.singleHanded) this.drawStick(this.input.right, config.COLORS.magenta, null)
    var ctx = this.ctx
    var x = this.input.singleHanded ? this.width - config.TOUCH.bombOffset : this.width * 0.5
    var y = this.height - config.TOUCH.bombOffset
    ctx.save()
    ctx.globalAlpha = 0.024
    ctx.strokeStyle = config.COLORS.orange
    ctx.fillStyle = config.COLORS.orange
    ctx.shadowColor = config.COLORS.orange
    ctx.shadowBlur = config.TOUCH.bombGlow
    ctx.lineWidth = config.TOUCH.bombStroke
    ctx.beginPath()
    ctx.arc(x, y, config.TOUCH.bombRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.3
    ctx.stroke()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = config.COLORS.orange
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = this.font('controlLabel')
    ctx.fillText('BOMB', x, y)
    ctx.restore()
  }

  drawStick(stick, color, heading) {
    var ctx = this.ctx
    ctx.save()
    if (stick.active && heading !== null && heading !== undefined) {
      var sectorRadius = config.TOUCH.sectorRadius
      ctx.globalAlpha = 0.34
      ctx.strokeStyle = color
      ctx.lineWidth = config.TOUCH.sectorStroke
      ctx.shadowColor = color
      ctx.shadowBlur = config.TOUCH.sectorGlow
      ctx.beginPath()
      ctx.moveTo(stick.baseX, stick.baseY)
      ctx.lineTo(stick.baseX + Math.cos(heading - config.WORLD.aimAssistHalfAngle) * sectorRadius, stick.baseY + Math.sin(heading - config.WORLD.aimAssistHalfAngle) * sectorRadius)
      ctx.moveTo(stick.baseX, stick.baseY)
      ctx.lineTo(stick.baseX + Math.cos(heading + config.WORLD.aimAssistHalfAngle) * sectorRadius, stick.baseY + Math.sin(heading + config.WORLD.aimAssistHalfAngle) * sectorRadius)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(stick.baseX, stick.baseY, sectorRadius, heading - config.WORLD.aimAssistHalfAngle, heading + config.WORLD.aimAssistHalfAngle)
      ctx.stroke()
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.moveTo(stick.baseX, stick.baseY)
      ctx.lineTo(stick.baseX + Math.cos(heading) * config.TOUCH.headingRay, stick.baseY + Math.sin(heading) * config.TOUCH.headingRay)
      ctx.stroke()
    }
    ctx.globalAlpha = stick.active ? 0.48 : 0.2
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = config.TOUCH.stickStroke
    ctx.shadowColor = color
    ctx.shadowBlur = config.TOUCH.stickGlow
    ctx.beginPath()
    ctx.arc(stick.baseX, stick.baseY, config.TOUCH.ringRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha *= 1.45
    ctx.beginPath()
    ctx.arc(stick.knobX, stick.knobY, config.TOUCH.knobRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha *= 0.3
    ctx.fill()
    ctx.restore()
  }

  drawOverlay(game) {
    var ctx = this.ctx
    ctx.save()
    ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0)
    ctx.globalAlpha = 0.67
    ctx.fillStyle = config.COLORS.background
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.globalAlpha = 1
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (game.state === 'title') {
      this.overlayTitle(game)
    } else if (game.state === 'gameover') {
      this.overlayGameOver(game)
    } else if (game.paused) {
      ctx.fillStyle = config.COLORS.white
      ctx.shadowColor = config.COLORS.cyan
      ctx.shadowBlur = 15
      ctx.font = this.font('pauseTitle')
      ctx.fillText('GRID PAUSED', this.width * 0.5, this.height * 0.42)
      ctx.font = this.font('body')
      ctx.fillText('轻触继续', this.width * 0.5, this.height * 0.58)
    }
    ctx.restore()
  }

  overlayTitle(game) {
    var ctx = this.ctx
    var titleSize = math.clamp(this.width * 0.055, config.TYPOGRAPHY.title.minSize, config.TYPOGRAPHY.title.maxSize)
    ctx.fillStyle = config.COLORS.white
    ctx.strokeStyle = config.COLORS.cyan
    ctx.shadowColor = config.COLORS.cyan
    ctx.shadowBlur = 22
    ctx.lineWidth = 1.2
    ctx.font = this.font('title', titleSize)
    ctx.fillText('GEOMETRY', this.width * 0.5, this.height * 0.32)
    ctx.fillStyle = config.COLORS.hud
    ctx.shadowColor = config.COLORS.hud
    ctx.fillText('FIGHTER', this.width * 0.5, this.height * 0.32 + titleSize * 0.9)
    ctx.shadowBlur = 8
    ctx.fillStyle = config.COLORS.cyan
    ctx.font = this.font('subtitle')
    ctx.fillText('RETRO GRID // SURVIVAL', this.width * 0.5, this.height * 0.32 + titleSize * 1.62)
    ctx.fillStyle = config.COLORS.white
    ctx.font = this.font('body')
    ctx.fillText('竖屏单手 · 拖动方向自动射击 · 保持倍率', this.width * 0.5, this.height * 0.71)
    var pulse = 0.55 + Math.sin(game.time * 4) * 0.3
    ctx.globalAlpha = pulse
    ctx.fillStyle = config.COLORS.hud
    ctx.font = this.font('prompt')
    ctx.fillText('TOUCH TO ENGAGE', this.width * 0.5, this.height * 0.82)
  }

  overlayGameOver(game) {
    var ctx = this.ctx
    ctx.fillStyle = config.COLORS.red
    ctx.shadowColor = config.COLORS.red
    ctx.shadowBlur = 18
    ctx.font = this.font('gameOverTitle')
    ctx.fillText('GRID COLLAPSED', this.width * 0.5, this.height * 0.34)
    ctx.shadowBlur = 7
    ctx.fillStyle = config.COLORS.hud
    ctx.font = this.font('gameOverScore')
    ctx.fillText('SCORE  ' + this.formatScore(game.score), this.width * 0.5, this.height * 0.52)
    ctx.fillStyle = config.COLORS.white
    ctx.font = this.font('bodyCompact')
    ctx.fillText('存活 ' + Math.floor(game.elapsed) + ' 秒 · 击破 ' + game.totalKills + ' 个目标', this.width * 0.5, this.height * 0.62)
    if (game.gameOverTimer > 0.7) {
      ctx.globalAlpha = 0.55 + Math.sin(game.time * 4) * 0.3
      ctx.fillStyle = config.COLORS.hud
      ctx.font = this.font('gameOverPrompt')
      ctx.fillText('TOUCH TO RESTART', this.width * 0.5, this.height * 0.78)
    }
  }
}

module.exports = Renderer
