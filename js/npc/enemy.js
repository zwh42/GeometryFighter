import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import PowerUp from '../player/powerup';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的敌机基准尺寸
const enemySize = deviceAdapter.getEnemySize();
const BASE_ENEMY_SIZE = enemySize.width;

// 敌机类型配置 - 使用适配后的尺寸
// 敌机类型配置 - Geometry Wars 风格
const ENEMY_TYPES = [
  {
    name: 'Grunt', // 蓝色菱形 - 追踪玩家
    size: Math.round(BASE_ENEMY_SIZE * 0.6),
    health: 1,
    speed: deviceAdapter.adaptSpeed(3),
    color: ['#0088ff', '#004488'],
    shape: 'grunt',
    score: 10,
    canShoot: false,
    dropRate: 0.1
  },
  {
    name: 'Wanderer', // 紫色方形 - 随机移动
    size: Math.round(BASE_ENEMY_SIZE * 0.5),
    health: 1,
    speed: deviceAdapter.adaptSpeed(2),
    color: ['#aa00ff', '#550088'],
    shape: 'wanderer',
    score: 20,
    canShoot: false,
    dropRate: 0.15
  },
  {
    name: 'Pinwheel', // 蓝色旋转十字 - 快速旋转
    size: Math.round(BASE_ENEMY_SIZE * 0.55),
    health: 1,
    speed: deviceAdapter.adaptSpeed(4),
    color: ['#00ffff', '#008888'],
    shape: 'pinwheel',
    score: 30,
    canShoot: false,
    dropRate: 0.2
  },
  {
    name: 'Diamond', // 橙色快速菱形 - 速度快
    size: Math.round(BASE_ENEMY_SIZE * 0.5),
    health: 1,
    speed: deviceAdapter.adaptSpeed(6),
    color: ['#ff8800', '#884400'],
    shape: 'diamond',
    score: 50,
    canShoot: false,
    dropRate: 0.25
  }
];

export default class Enemy extends Animation {
  constructor() {
    super('', 0, 0);
    this.type = null;
    this.rotation = 0; // 用于旋转动画
    
    // 尾焰粒子系统
    this.trailParticles = [];
    this.lastX = 0;
    this.lastY = 0;
  }

  init() {
    // 随机选择敌机类型
    this.type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    this.name = this.type.name;
    this.width = this.type.size;
    this.height = this.type.size;
    this.health = this.type.health;
    this.speed = this.type.speed;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    
    // 漫游者方向
    if (this.type.shape === 'wanderer') {
      this.angle = Math.random() * Math.PI * 2;
    }
    
    // 初始化爆炸动画
    this.count = 19;
    this.imgList = [];
    
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

  // 每一帧更新敌人位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 更新旋转
    this.rotation += this.rotationSpeed;
    if (this.type.shape === 'pinwheel') {
      this.rotation += 0.15; // 旋转十字转得更快
    }

    // 更新位置逻辑
    const player = GameGlobal.databus.player;
    
    switch (this.type.shape) {
      case 'grunt':
      case 'diamond':
        // 追踪玩家
        if (player) {
          const dx = player.x + player.width / 2 - (this.x + this.width / 2);
          const dy = player.y + player.height / 2 - (this.y + this.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
          }
        } else {
          this.y += this.speed;
        }
        break;
        
      case 'wanderer':
        // 随机移动
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        // 边界反弹
        if (this.x < 0 || this.x > SCREEN_WIDTH - this.width) {
          this.angle = Math.PI - this.angle;
        }
        if (this.y < 0 || this.y > SCREEN_HEIGHT) {
          this.angle = -this.angle;
        }
        
        // 随机改变方向
        if (Math.random() < 0.02) {
          this.angle += (Math.random() - 0.5) * 1.5;
        }
        break;
        
      case 'pinwheel':
        // 快速直冲，偶尔转向玩家
        if (player && Math.random() < 0.01) {
          const dx = player.x + player.width / 2 - (this.x + this.width / 2);
          const dy = player.y + player.height / 2 - (this.y + this.height / 2);
          this.targetAngle = Math.atan2(dy, dx);
          this.angle = this.targetAngle;
        }
        if (this.angle === undefined) this.angle = Math.PI / 2;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        
        // 边界反弹
        if (this.x < 0 || this.x > SCREEN_WIDTH - this.width) this.angle = Math.PI - this.angle;
        if (this.y < -50 || this.y > SCREEN_HEIGHT) this.angle = -this.angle;
        break;
    }

    // 对象回收
    if (this.y > SCREEN_HEIGHT + 100 || this.y < -200 || this.x < -100 || this.x > SCREEN_WIDTH + 100) {
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
    this.playAnimation();
    GameGlobal.musicManager.playExplosion();

    if (Math.random() < (this.type.dropRate || 0.1)) {
      this.dropPowerUp();
    }

    this.on('stopAnimation', () => this.remove.bind(this));
  }

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

    ctx.save();
    
    const glowLevel = (GameGlobal.main && GameGlobal.main.glowLevel !== undefined) ? GameGlobal.main.glowLevel : 1.0;
    
    if (glowLevel > 0) {
      ctx.shadowColor = this.type.color[0];
      ctx.shadowBlur = 20 * glowLevel;
    }
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const s = this.width / 2;
    
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);
    
    ctx.beginPath();
    
    switch (this.type.shape) {
      case 'grunt': // 菱形
      case 'diamond':
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.8, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.8, 0);
        ctx.closePath();
        break;
        
      case 'wanderer': // 内部有线条的正方形
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.moveTo(-s, -s);
        ctx.lineTo(s, s);
        ctx.moveTo(s, -s);
        ctx.lineTo(-s, s);
        break;
        
      case 'pinwheel': // 旋转十字/星形
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.7);
        }
        break;
    }
    
    ctx.stroke();
    
    // 添加中心高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  // 添加尾焰粒子
  addTrailParticle() {
    // 检测是否为移动设备
    let isMobile = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
      } catch (e) {
        isMobile = true;
      }
    }
    
    // 移动设备禁用粒子或减少数量
    const maxParticles = isMobile ? 0 : 5;
    
    // 限制粒子数量，避免性能问题
    if (this.trailParticles.length >= maxParticles) {
      return;
    }
    
    const particle = {
      x: this.x + this.width / 2,
      y: this.y, // 从敌机机头发射（朝向玩家）
      vx: (Math.random() - 0.5) * 0.5, // 减少水平扩散
      vy: -(Math.random() * 1.5 + 1.5), // 向上喷射（朝向玩家方向）
      life: 1.0,
      decay: 0.04, // 加快衰减速度
      size: Math.random() * 1.5 + 0.5 // 减小粒子大小
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

  // 渲染尾焰粒子 - 优化版本
  renderTrailParticles(ctx) {
    if (this.trailParticles.length === 0) {
      return;
    }
    
    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 批量渲染粒子，减少状态切换
    for (const particle of this.trailParticles) {
      const alpha = particle.life;
      const size = Math.floor(particle.size * particle.life);
      
      // 像素风格渲染，使用方形粒子
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ff0000';
      
      // 绘制像素风格的方形粒子
      ctx.fillRect(
        Math.floor(particle.x - size / 2), 
        Math.floor(particle.y - size / 2), 
        size, 
        size
      );
      
      // 添加像素风格的高光
      if (size > 1) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          Math.floor(particle.x - size / 2), 
          Math.floor(particle.y - size / 2), 
          1, 
          1
        );
      }
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
      case 'scout':
        wingLeft = this.x - 3;
        wingRight = this.x + this.width + 3;
        wingTop = centerY - 2;
        wingBottom = centerY + 5;
        break;
      case 'interceptor':
        wingLeft = this.x - 6;
        wingRight = this.x + this.width + 6;
        wingTop = centerY - 3;
        wingBottom = centerY + 7;
        break;
      case 'stealth':
        wingLeft = this.x - 10;
        wingRight = this.x + this.width + 10;
        wingTop = centerY - 4;
        wingBottom = centerY + 6;
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
