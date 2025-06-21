import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BULLET_WIDTH = 8;
const BULLET_HEIGHT = 15;

export default class Bullet extends Sprite {
  constructor() {
    super('', 4, 10);
    // 尾焰粒子系统
    this.trailParticles = [];
  }

  init(x, y, speed, angle = 0) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.angle = angle * Math.PI / 180; // 转换为弧度
    this.isActive = true;
    this.visible = true;
  }

  // 添加尾焰粒子
  addTrailParticle() {
    const particle = {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 1.0,
      decay: 0.03, // 降低衰减速度，让尾焰更长
      size: Math.random() * 3 + 2 // 增大粒子尺寸
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
      
      // 绘制金黄色尾焰粒子
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 12;
      
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size
      );
      gradient.addColorStop(0, '#ffff00');
      gradient.addColorStop(0.3, '#ffdd00');
      gradient.addColorStop(0.7, '#ffaa00');
      gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    
    ctx.restore();
  }

  // 每一帧更新子弹位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 检查是否需要追踪敌机
    this.checkAndUpdateTracking();
  
    // 根据角度更新位置
    this.x += Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;

    // 添加尾焰粒子
    this.addTrailParticle();
    
    // 更新尾焰粒子
    this.updateTrailParticles();

    // 超出屏幕外销毁
    if (this.y < -this.height || this.x < -this.width || this.x > SCREEN_WIDTH) {
      this.destroy();
    }
  }

  // 检查并更新追踪目标
  checkAndUpdateTracking() {
    const bulletCenterX = this.x + this.width / 2;
    const bulletCenterY = this.y + this.height / 2;
    
    // 寻找最近的敌机
    let nearestEnemy = null;
    let nearestDistance = Infinity;
    
    GameGlobal.databus.enemys.forEach(enemy => {
      if (!enemy.isActive) return;
      
      // 检查子弹是否在敌机的边界框内
      const enemyLeft = enemy.x;
      const enemyRight = enemy.x + enemy.width;
      const enemyTop = enemy.y;
      const enemyBottom = enemy.y + enemy.height;
      
      if (bulletCenterX >= enemyLeft && bulletCenterX <= enemyRight &&
          bulletCenterY >= enemyTop && bulletCenterY <= enemyBottom) {
        
        // 计算到敌机中心的距离
        const enemyCenterX = enemy.x + enemy.width / 2;
        const enemyCenterY = enemy.y + enemy.height / 2;
        const distance = Math.sqrt(
          Math.pow(bulletCenterX - enemyCenterX, 2) + 
          Math.pow(bulletCenterY - enemyCenterY, 2)
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = enemy;
        }
      }
    });
    
    // 如果找到目标敌机，更新子弹角度
    if (nearestEnemy) {
      const enemyCenterX = nearestEnemy.x + nearestEnemy.width / 2;
      const enemyCenterY = nearestEnemy.y + nearestEnemy.height / 2;
      
      // 计算到敌机中心的方向
      const dx = enemyCenterX - bulletCenterX;
      const dy = enemyCenterY - bulletCenterY;
      
      // 更新子弹角度，使其朝向敌机中心
      this.angle = Math.atan2(dx, -dy);
    }
  }

  destroy() {
    this.isActive = false;
    // 子弹没有销毁动画，直接移除
    this.remove();
  }

  remove() {
    this.isActive = false;
    this.visible = false;
    // 回收子弹对象
    GameGlobal.databus.removeBullets(this);
  }

  render(ctx) {
    if (!this.visible) return;

    // 先渲染尾焰粒子
    this.renderTrailParticles(ctx);

    ctx.save();
    
    // 添加更强的金黄色发光效果
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 25;
    
    // 绘制子弹（菱形）
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height / 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height);
    ctx.lineTo(this.x, this.y + this.height / 2);
    ctx.closePath();
    
    // 填充金黄色渐变
    const gradient = ctx.createLinearGradient(
      this.x, this.y,
      this.x + this.width, this.y + this.height
    );
    gradient.addColorStop(0, '#ffff00');
    gradient.addColorStop(0.3, '#ffdd00');
    gradient.addColorStop(0.7, '#ffaa00');
    gradient.addColorStop(1, '#ff8800');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // 添加内部高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    
    ctx.restore();
  }
}
