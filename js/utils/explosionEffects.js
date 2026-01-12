/**
 * Geometry Wars风格的爆炸效果系统 - 增强重力、发光和网格互动版本
 */
class ExplosionEffects {
  constructor() {
    this.explosions = [];
    this.maxExplosions = 15;
    this.particlePool = []; // 粒子对象池
  }

  /**
   * 从对象池获取或创建粒子
   */
  getParticle() {
    return this.particlePool.pop() || {};
  }

  /**
   * 将粒子回收到对象池
   */
  releaseParticle(p) {
    if (this.particlePool.length < 500) {
      this.particlePool.push(p);
    }
  }

  createExplosion(x, y, color = '#ff6600', size = 30, isFullScreen = false) {
    if (GameGlobal.main && GameGlobal.main.bg) {
      const strength = isFullScreen ? 60 : 30;
      const radius = isFullScreen ? 300 : size * 4;
      GameGlobal.main.bg.ripple(x, y, strength, radius);
    }

    let isMobile = GameGlobal.databus.isMobile;
    const maxExplosions = isMobile ? 8 : this.maxExplosions;
    
    if (this.explosions.length >= maxExplosions) {
      const oldExp = this.explosions.shift();
      if (oldExp) {
        oldExp.particles.forEach(p => this.releaseParticle(p));
      }
    }
    
    const explosionSize = isFullScreen ? size * 2.5 : size;
    
    const explosion = {
      x, y, color,
      life: 1.0,
      decay: 0.02,
      particles: this.createParticles(x, y, color, explosionSize),
      isActive: true
    };
    
    this.explosions.push(explosion);
  }

  createParticles(x, y, color, size) {
    const particles = [];
    const isMobile = GameGlobal.databus.isMobile;
    // WebGL 性能极佳，可以大幅增加粒子数量
    const count = isMobile ? 60 : 200; 
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 12 + 2;
        const p = this.getParticle();
        
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * velocity;
        p.vy = Math.sin(angle) * velocity;
        p.size = Math.random() * 4 + 2;
        p.life = 1.0;
        p.decay = Math.random() * 0.04 + 0.01;
        p.color = color;
        
        particles.push(p);
    }
    return particles;
  }

  update() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
        const exp = this.explosions[i];
        exp.life -= exp.decay;
        
        for (let j = exp.particles.length - 1; j >= 0; j--) {
            const p = exp.particles[j];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life -= p.decay;
            
            if (p.life <= 0) {
                this.releaseParticle(exp.particles.splice(j, 1)[0]);
            }
        }
        
        if (exp.life <= 0 || exp.particles.length === 0) {
            const removed = this.explosions.splice(i, 1)[0];
            removed.particles.forEach(p => this.releaseParticle(p));
        }
    }
  }

  /**
   * 爆炸渲染函数 - 使用 WebGL 批处理
   */
  render(dummyCtx) {
    if (!GameGlobal.renderer || this.explosions.length === 0) return;

    for (const exp of this.explosions) {
        // 解析颜色
        const colorHex = exp.color;
        const r = parseInt(colorHex.slice(1, 3), 16) / 255;
        const g = parseInt(colorHex.slice(3, 5), 16) / 255;
        const b = parseInt(colorHex.slice(5, 7), 16) / 255;

        for (const p of exp.particles) {
            const alpha = p.life * exp.life;
            // 绘制为短线以模拟动感模糊
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const tailSize = speed * 0.5;
            
            GameGlobal.renderer.drawLine(
                p.x, p.y, 
                p.x - p.vx * tailSize, p.y - p.vy * tailSize, 
                r, g, b, alpha
            );
        }
    }
  }

  createHitEffect(x, y, color = '#ffffff') {
    this.createExplosion(x, y, color, 12);
  }

  clear() {
    this.explosions.forEach(exp => {
      exp.particles.forEach(p => this.releaseParticle(p));
    });
    this.explosions = [];
  }

  test() {}
}

const explosionEffects = new ExplosionEffects();
export default explosionEffects;
 