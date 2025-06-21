import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const ENEMY_BULLET_WIDTH = 6;
const ENEMY_BULLET_HEIGHT = 12;
const ENEMY_BULLET_SPEED = 3;

export default class EnemyBullet extends Sprite {
  constructor() {
    super('', ENEMY_BULLET_WIDTH, ENEMY_BULLET_HEIGHT);
    // 尾焰粒子系统
    this.trailParticles = [];
  }

  init(x, y) {
    this.x = x - this.width / 2;
    this.y = y;
    this.speed = ENEMY_BULLET_SPEED;
    this.isActive = true;
    this.visible = true;
  }

  // 添加尾焰粒子
  addTrailParticle() {
    const particle = {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
      vx: (Math.random() - 0.5) * 1,
      vy: (Math.random() - 0.5) * 1,
      life: 1.0,
      decay: 0.05,
      size: Math.random() * 2 + 1
    };
    this.trailParticles.push(particle);
  }

  // 更新尾焰粒子
  updateTrailParticles() {
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const particle = this.trailParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;
      
      if (particle.life <= 0) {
        this.trailParticles.splice(i, 1);
      }
    }
  }

  // 渲染尾焰粒子
  renderTrailParticles(ctx) {
    ctx.save();
    
    for (const particle of this.trailParticles) {
      const alpha = particle.life;
      const size = particle.size * particle.life;
      
      // 绘制尾焰粒子
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size
      );
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.5, '#ff4400');
      gradient.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    
    ctx.restore();
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 直线下落
    this.y += this.speed;

    // 添加尾焰粒子
    this.addTrailParticle();
    
    // 更新尾焰粒子
    this.updateTrailParticles();

    // 超出屏幕外销毁
    if (this.y > SCREEN_HEIGHT || 
        this.x < -this.width || 
        this.x > SCREEN_WIDTH) {
      this.destroy();
    }
  }

  destroy() {
    this.isActive = false;
    this.visible = false;
    GameGlobal.databus.removeEnemyBullet(this);
  }

  render(ctx) {
    if (!this.visible) return;

    // 先渲染尾焰粒子
    this.renderTrailParticles(ctx);

    ctx.save();
    
    // 添加发光效果
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    
    // 绘制敌机子弹（三角形）
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.closePath();
    
    // 填充渐变
    const gradient = ctx.createLinearGradient(
      this.x, this.y,
      this.x + this.width, this.y + this.height
    );
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#ff4400');
    gradient.addColorStop(1, '#ff8800');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }
} 