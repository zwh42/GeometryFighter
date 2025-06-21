import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import PowerUp from '../player/powerup';


// 敌机类型配置
const ENEMY_TYPES = [
  {
    size: 25,  // 小型战斗机
    health: 1,
    speed: 6, // 速度最快
    color: ['#ff0000', '#cc0000'],
    shape: 'fighter_small',
    score: 1,
    canShoot: false // 小型敌机不能发射导弹
  },
  {
    size: 35,  // 中型战斗机
    health: 2,
    speed: 4, // 中等速度
    color: ['#ff4400', '#cc2200'],
    shape: 'fighter_medium',
    score: 2,
    canShoot: false, // 中型敌机也不能发射导弹
    shootInterval: 120
  },
  {
    size: 45,  // 大型战斗机
    health: 3,
    speed: 2, // 较慢速度
    color: ['#ff8800', '#cc6600'],
    shape: 'fighter_large',
    score: 3,
    dropRate: 0.3,
    canShoot: true, // 大型敌机可以发射导弹
    shootInterval: 90
  },
  {
    size: 30,  // 轰炸机
    health: 2,
    speed: 3, // 中等偏慢速度
    color: ['#ff0066', '#cc0044'],
    shape: 'bomber',
    score: 2,
    canShoot: false // 轰炸机不能发射导弹
  },
  {
    size: 40,  // 重型战斗机
    health: 4,
    speed: 1, // 最慢速度
    color: ['#ff6600', '#cc4400'],
    shape: 'heavy_fighter',
    score: 4,
    dropRate: 0.4,
    canShoot: true, // 重型战斗机可以发射导弹
    shootInterval: 60
  }
];

export default class Enemy extends Animation {
  constructor() {
    super('', 0, 0);
    this.type = null;
    
    // 尾焰粒子系统
    this.trailParticles = [];
    this.lastX = 0;
    this.lastY = 0;
  }

  init() {
    // 随机选择敌机类型
    this.type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    this.width = this.type.size;
    this.height = this.type.size;
    this.health = this.type.health;
    this.speed = this.type.speed;
    this.canShoot = this.type.canShoot;
    this.shootInterval = this.type.shootInterval || 0;
    this.lastShootTime = 0;
    
    // 冲刺相关属性
    this.isDashing = false;
    this.dashSpeed = this.speed * 1.1; // 1.1倍速冲刺
    this.dashThreshold = SCREEN_HEIGHT * 0.7; // 在屏幕70%位置开始冲刺
    
    // 初始化爆炸动画（19帧几何粒子爆炸效果）
    this.count = 19;
    this.imgList = [];
    
    // 推入到全局动画池
    GameGlobal.databus.animations.push(this);
    
    this.x = this.getRandomX();
    this.y = -this.height;

    this.isActive = true;
    this.visible = true;
  }

  // 生成随机 X 坐标
  getRandomX() {
    return Math.floor(Math.random() * (SCREEN_WIDTH - this.width));
  }


  // 敌机射击
  shoot() {
    if (!this.canShoot || GameGlobal.databus.isGameOver) {
      return;
    }

    // 检查射击间隔
    if (GameGlobal.databus.frame - this.lastShootTime < this.shootInterval) {
      return;
    }

    const EnemyBullet = require('./enemybullet').default;
    const bullet = GameGlobal.databus.pool.getItemByClass('enemybullet', EnemyBullet);
    bullet.init(this.x + this.width / 2, this.y + this.height);
    GameGlobal.databus.enemyBullets.push(bullet);
    
    this.lastShootTime = GameGlobal.databus.frame;
  }

  // 每一帧更新敌人位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 检测移动并添加尾焰粒子
    if (this.x !== this.lastX || this.y !== this.lastY) {
      this.addTrailParticle();
      this.lastX = this.x;
      this.lastY = this.y;
    }

    // 更新尾焰粒子
    this.updateTrailParticles();

    // 检查小型敌机的冲刺条件
    if (this.type.shape === 'fighter_small' && !this.isDashing && this.y >= this.dashThreshold) {
      this.isDashing = true;
    }

    // 获取当前移动速度
    const currentSpeed = this.isDashing ? this.dashSpeed : this.speed;

    // 获取玩家位置
    const player = GameGlobal.databus.player;
    if (player) {
      // 计算到玩家的方向
      const dx = player.x + player.width / 2 - (this.x + this.width / 2);
      const dy = player.y + player.height / 2 - (this.y + this.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 检查敌机是否在玩家下方30px以上
      const verticalDistance = this.y - (player.y + player.height);
      const isTooFarBelow = verticalDistance > 30;
      
      // 只有当距离较远且不在玩家下方太远时才追踪玩家
      const trackingDistance = 150; // 追踪距离阈值
      
      if (distance > trackingDistance && !isTooFarBelow) {
        // 距离较远且不在下方太远时，标准化方向向量并追踪
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // 移动敌机
        this.x += dirX * currentSpeed;
        this.y += dirY * currentSpeed;
      } else {
        // 距离较近或在下方太远时，保持当前方向继续移动
        // 使用简单的直线移动
        this.y += currentSpeed;
      }
    } else {
      // 如果没有玩家信息，使用原来的直线下落
      this.y += currentSpeed;
    }

    // 尝试射击
    this.shoot();

    // 对象回收
    if (this.y > SCREEN_HEIGHT + this.height || 
        this.x < -this.width || 
        this.x > SCREEN_WIDTH + this.width) {
      this.remove();
    }
  }

  // 受到伤害
  takeDamage() {
    this.health--;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  destroy() {
    this.isActive = false;
    // 播放销毁动画后移除
    this.playAnimation();
    GameGlobal.musicManager.playExplosion();
    wx.vibrateShort({
      type: 'light'
    });

    // 如果是大型敌机，有概率掉落宝物
    if (this.type.size === 40 && Math.random() < this.type.dropRate) {
      this.dropPowerUp();
    }

    this.on('stopAnimation', () => this.remove.bind(this));
  }

  // 掉落宝物
  dropPowerUp() {
    const powerUp = GameGlobal.databus.pool.getItemByClass('powerup', PowerUp);
    powerUp.init(this.x + this.width / 2, this.y + this.height / 2);
    GameGlobal.databus.powerUps.push(powerUp);
  }

  remove() {
    this.isActive = false;
    this.visible = false;
    GameGlobal.databus.removeEnemy(this);
  }

  render(ctx) {
    if (!this.visible) return;

    // 先渲染尾焰粒子
    this.renderTrailParticles(ctx);

    ctx.save();
    
    // 添加发光效果
    ctx.shadowColor = this.type.color[0];
    ctx.shadowBlur = 15;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // 根据敌机类型渲染不同的形状
    switch (this.type.shape) {
      case 'fighter_small':
        this.renderSmallFighter(ctx, centerX, centerY);
        break;
      case 'fighter_medium':
        this.renderMediumFighter(ctx, centerX, centerY);
        break;
      case 'fighter_large':
        this.renderLargeFighter(ctx, centerX, centerY);
        break;
      case 'bomber':
        this.renderBomber(ctx, centerX, centerY);
        break;
      case 'heavy_fighter':
        this.renderHeavyFighter(ctx, centerX, centerY);
        break;
    }
    
    ctx.restore();
  }

  // 渲染小型战斗机
  renderSmallFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称三角形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(centerX, this.y + height); // 机头（朝下）
    ctx.lineTo(centerX - width * 0.3, this.y); // 左后角
    ctx.lineTo(centerX + width * 0.3, this.y); // 右后角
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(centerX - 2, centerY + 2);
    ctx.lineTo(centerX - width * 0.4, centerY + 3); // 左翼尖
    ctx.lineTo(centerX - width * 0.3, centerY - 5);
    ctx.lineTo(centerX + 2, centerY + 2);
    ctx.lineTo(centerX + width * 0.4, centerY + 3); // 右翼尖
    ctx.lineTo(centerX + width * 0.3, centerY - 5);
    ctx.closePath();
    ctx.stroke();
  }

  // 渲染中型战斗机
  renderMediumFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称六边形）
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = centerX + width * 0.3 * Math.cos(angle);
      const y = centerY + height * 0.3 * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(centerX - 3, centerY + 2);
    ctx.lineTo(centerX - width * 0.4, centerY + 4); // 左翼尖
    ctx.lineTo(centerX - width * 0.35, centerY - 6);
    ctx.lineTo(centerX + 3, centerY + 2);
    ctx.lineTo(centerX + width * 0.4, centerY + 4); // 右翼尖
    ctx.lineTo(centerX + width * 0.35, centerY - 6);
    ctx.closePath();
    ctx.stroke();
  }

  // 渲染大型战斗机
  renderLargeFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称矩形）
    ctx.beginPath();
    ctx.rect(centerX - width * 0.3, centerY - height * 0.3, width * 0.6, height * 0.6);
    ctx.stroke();
    
    // 机翼（对称大三角形）
    ctx.beginPath();
    ctx.moveTo(centerX - 4, centerY + 3);
    ctx.lineTo(centerX - width * 0.5, centerY + 5); // 左翼尖
    ctx.lineTo(centerX - width * 0.4, centerY - 8);
    ctx.lineTo(centerX + 4, centerY + 3);
    ctx.lineTo(centerX + width * 0.5, centerY + 5); // 右翼尖
    ctx.lineTo(centerX + width * 0.4, centerY - 8);
    ctx.closePath();
    ctx.stroke();
    
    // 尾翼（对称）
    ctx.beginPath();
    ctx.moveTo(centerX - 3, this.y + 2);
    ctx.lineTo(centerX - width * 0.2, this.y);
    ctx.lineTo(centerX + 3, this.y + 2);
    ctx.lineTo(centerX + width * 0.2, this.y);
    ctx.closePath();
    ctx.stroke();
  }

  // 渲染轰炸机
  renderBomber(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称椭圆形）
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, width * 0.4, height * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // 机翼（对称矩形）
    ctx.beginPath();
    ctx.rect(centerX - width * 0.6, centerY - 2, width * 1.2, 4);
    ctx.stroke();
    
    // 尾翼（对称）
    ctx.beginPath();
    ctx.rect(centerX - width * 0.15, this.y + 2, width * 0.3, 4);
    ctx.stroke();
  }

  // 渲染重型战斗机
  renderHeavyFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称复杂多边形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(centerX, this.y + height); // 机头（朝下）
    ctx.lineTo(centerX - width * 0.3, this.y + height * 0.7); // 左前
    ctx.lineTo(centerX - width * 0.4, this.y + height * 0.3); // 左中
    ctx.lineTo(centerX - width * 0.3, this.y); // 左后
    ctx.lineTo(centerX + width * 0.3, this.y); // 右后
    ctx.lineTo(centerX + width * 0.4, this.y + height * 0.3); // 右中
    ctx.lineTo(centerX + width * 0.3, this.y + height * 0.7); // 右前
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称复杂形状）
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY + 3);
    ctx.lineTo(centerX - width * 0.6, centerY + 5); // 左翼尖
    ctx.lineTo(centerX - width * 0.5, centerY - 3);
    ctx.lineTo(centerX - width * 0.3, centerY - 5);
    ctx.lineTo(centerX + 5, centerY + 3);
    ctx.lineTo(centerX + width * 0.6, centerY + 5); // 右翼尖
    ctx.lineTo(centerX + width * 0.5, centerY - 3);
    ctx.lineTo(centerX + width * 0.3, centerY - 5);
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（中心圆形）
    ctx.beginPath();
    ctx.arc(centerX, centerY + 1, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 添加尾焰粒子
  addTrailParticle() {
    const particle = {
      x: this.x + this.width / 2,
      y: this.y, // 从敌机机头发射（朝向玩家）
      vx: (Math.random() - 0.5) * 1, // 减少水平扩散
      vy: -(Math.random() * 2 + 2), // 向上喷射（朝向玩家方向）
      life: 1.0,
      decay: 0.03,
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
      
      // 绘制敌机尾焰粒子（红色系）
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
      gradient.addColorStop(0.5, '#cc0000');
      gradient.addColorStop(1, 'rgba(204, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    
    ctx.restore();
  }

  // 检查与机翼的碰撞
  isCollideWithWings(sprite) {
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // 根据敌机类型定义机翼的碰撞区域
    let wingLeft, wingRight, wingTop, wingBottom;
    
    switch (this.type.shape) {
      case 'fighter_small':
        wingLeft = this.x - 5;
        wingRight = this.x + this.width + 5;
        wingTop = centerY - 3;
        wingBottom = centerY + 8;
        break;
      case 'fighter_medium':
        wingLeft = this.x - 8;
        wingRight = this.x + this.width + 8;
        wingTop = centerY - 3;
        wingBottom = centerY + 10;
        break;
      case 'fighter_large':
        wingLeft = this.x - 12;
        wingRight = this.x + this.width + 12;
        wingTop = centerY - 5;
        wingBottom = centerY + 15;
        break;
      case 'bomber':
        wingLeft = this.x - 5;
        wingRight = this.x + this.width + 5;
        wingTop = centerY - 2;
        wingBottom = centerY + 2;
        break;
      case 'heavy_fighter':
        wingLeft = this.x - 15;
        wingRight = this.x + this.width + 15;
        wingTop = centerY - 5;
        wingBottom = centerY + 8;
        break;
      default:
        return false;
    }
    
    // 检查sprite是否与机翼区域重叠
    return !(
      sprite.x + sprite.width < wingLeft ||
      sprite.x > wingRight ||
      sprite.y + sprite.height < wingTop ||
      sprite.y > wingBottom
    );
  }

  // 扩展的碰撞检测，包括机翼
  isCollideWith(sprite) {
    // 先检查主体碰撞
    if (!(
      sprite.x + sprite.width < this.x ||
      sprite.x > this.x + this.width ||
      sprite.y + sprite.height < this.y ||
      sprite.y > this.y + this.height
    )) {
      return true;
    }
    
    // 再检查机翼碰撞
    return this.isCollideWithWings(sprite);
  }
}
