import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import PowerUp from '../player/powerup';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的敌机基准尺寸
const enemySize = deviceAdapter.getEnemySize();
const BASE_ENEMY_SIZE = enemySize.width;

// 敌机类型配置 - 使用适配后的尺寸
const ENEMY_TYPES = [
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.6),  // 中型战斗机
    health: 2,
    speed: deviceAdapter.adaptSpeed(4), // 中等速度
    color: ['#ff4400', '#cc2200'],
    shape: 'fighter_medium',
    score: 2,
    canShoot: false, // 中型敌机也不能发射导弹
    shootInterval: 120,
    dropRate: 0.2 // 增加掉落概率
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.75),  // 大型战斗机
    health: 3,
    speed: deviceAdapter.adaptSpeed(2), // 较慢速度
    color: ['#ff8800', '#cc6600'],
    shape: 'fighter_large',
    score: 3,
    dropRate: 0.4, // 增加掉落概率
    canShoot: true, // 大型敌机可以发射导弹
    shootInterval: 90
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.5),  // 轰炸机
    health: 2,
    speed: deviceAdapter.adaptSpeed(3), // 中等偏慢速度
    color: ['#ff0066', '#cc0044'],
    shape: 'bomber',
    score: 2,
    canShoot: false, // 轰炸机不能发射导弹
    dropRate: 0.15 // 增加掉落概率
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.67),  // 重型战斗机
    health: 4,
    speed: deviceAdapter.adaptSpeed(1), // 最慢速度
    color: ['#ff6600', '#cc4400'],
    shape: 'heavy_fighter',
    score: 4,
    dropRate: 0.5, // 增加掉落概率
    canShoot: true, // 重型战斗机可以发射导弹
    shootInterval: 60
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.45),  // 侦察机
    health: 1,
    speed: deviceAdapter.adaptSpeed(8), // 最快速度
    color: ['#00ff00', '#00cc00'],
    shape: 'scout',
    score: 1,
    canShoot: false, // 侦察机不能发射导弹
    dropRate: 0.1 // 较低掉落概率
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.55),  // 拦截机
    health: 2,
    speed: deviceAdapter.adaptSpeed(5), // 高速
    color: ['#0088ff', '#0066cc'],
    shape: 'interceptor',
    score: 2,
    canShoot: true, // 拦截机可以发射导弹
    shootInterval: 80,
    dropRate: 0.25 // 中等掉落概率
  },
  {
    size: Math.round(BASE_ENEMY_SIZE * 0.7),  // 隐形战机
    health: 3,
    speed: deviceAdapter.adaptSpeed(3), // 中等速度
    color: ['#888888', '#666666'],
    shape: 'stealth',
    score: 3,
    canShoot: true, // 隐形战机可以发射导弹
    shootInterval: 100,
    dropRate: 0.35 // 较高掉落概率
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
    bullet.init(this.x + this.width / 2, this.y + this.height, this.type.color[0]);
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

    // 检查侦察机的冲刺条件
    if (this.type.shape === 'scout' && !this.isDashing && this.y >= this.dashThreshold) {
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

    // 根据敌机类型和概率掉落宝物
    if (Math.random() < this.type.dropRate) {
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
      case 'scout':
        this.renderScout(ctx, centerX, centerY);
        break;
      case 'interceptor':
        this.renderInterceptor(ctx, centerX, centerY);
        break;
      case 'stealth':
        this.renderStealth(ctx, centerX, centerY);
        break;
    }
    
    ctx.restore();
  }

  // 渲染小型战斗机
  renderSmallFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称三角形，机头朝下）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称三角形）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 2), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.4), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(centerY - 5));
    ctx.lineTo(Math.floor(centerX + 2), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.4), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(centerY - 5));
    ctx.closePath();
    ctx.stroke();
    
    // 添加像素风格的装饰点 - 移到机翼边缘
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - width * 0.35), Math.floor(centerY - 3), 2, 2);
    ctx.fillRect(Math.floor(centerX + width * 0.33), Math.floor(centerY - 3), 2, 2);
  }

  // 渲染中型战斗机
  renderMediumFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（流线型三角形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(this.y + height * 0.3));
    ctx.lineTo(Math.floor(centerX - width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(this.y + height * 0.3));
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称三角形）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 3), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.4), Math.floor(centerY + 4));
    ctx.lineTo(Math.floor(centerX - width * 0.35), Math.floor(centerY - 6));
    ctx.lineTo(Math.floor(centerX + 3), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.4), Math.floor(centerY + 4));
    ctx.lineTo(Math.floor(centerX + width * 0.35), Math.floor(centerY - 6));
    ctx.closePath();
    ctx.stroke();
    
    // 尾翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 2), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.15), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + 2), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.15), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（小圆形）
    ctx.beginPath();
    ctx.arc(Math.floor(centerX), Math.floor(centerY + 1), 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // 添加像素风格的装饰点 - 移到机翼边缘
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - width * 0.38), Math.floor(centerY - 4), 2, 2);
    ctx.fillRect(Math.floor(centerX + width * 0.36), Math.floor(centerY - 4), 2, 2);
  }

  // 渲染大型战斗机
  renderLargeFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（流线型矩形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(this.y + height * 0.4));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(this.y + height * 0.4));
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称大三角形）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 4), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX - width * 0.5), Math.floor(centerY + 5));
    ctx.lineTo(Math.floor(centerX - width * 0.4), Math.floor(centerY - 8));
    ctx.lineTo(Math.floor(centerX + 4), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX + width * 0.5), Math.floor(centerY + 5));
    ctx.lineTo(Math.floor(centerX + width * 0.4), Math.floor(centerY - 8));
    ctx.closePath();
    ctx.stroke();
    
    // 尾翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 3), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + 3), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.2), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（矩形）
    ctx.beginPath();
    ctx.rect(Math.floor(centerX - 3), Math.floor(centerY - 1), 6, 2);
    ctx.stroke();
    
    // 添加像素风格的装饰点 - 移到机翼边缘
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - width * 0.45), Math.floor(centerY - 6), 2, 2);
    ctx.fillRect(Math.floor(centerX + width * 0.43), Math.floor(centerY - 6), 2, 2);
  }

  // 渲染轰炸机
  renderBomber(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（流线型椭圆形，机头朝下）
    ctx.beginPath();
    ctx.ellipse(Math.floor(centerX), Math.floor(centerY), 
                Math.floor(width * 0.4), Math.floor(height * 0.3), 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // 机翼（对称矩形）- 像素化处理
    ctx.beginPath();
    ctx.rect(Math.floor(centerX - width * 0.6), Math.floor(centerY - 2), 
             Math.floor(width * 1.2), 4);
    ctx.stroke();
    
    // 尾翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - width * 0.15), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.1), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.1), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.15), Math.floor(this.y + 2));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（小圆形）
    ctx.beginPath();
    ctx.arc(Math.floor(centerX), Math.floor(centerY - 2), 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // 添加像素风格的装饰点 - 移到机翼边缘
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - width * 0.55), Math.floor(centerY - 1), 2, 2);
    ctx.fillRect(Math.floor(centerX + width * 0.53), Math.floor(centerY - 1), 2, 2);
  }

  // 渲染重型战斗机
  renderHeavyFighter(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（对称复杂多边形，机头朝下）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(this.y + height * 0.7));
    ctx.lineTo(Math.floor(centerX - width * 0.4), Math.floor(this.y + height * 0.3));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.4), Math.floor(this.y + height * 0.3));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(this.y + height * 0.7));
    ctx.closePath();
    ctx.stroke();
    
    // 机翼（对称复杂形状）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 5), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX - width * 0.6), Math.floor(centerY + 5));
    ctx.lineTo(Math.floor(centerX - width * 0.5), Math.floor(centerY - 3));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(centerY - 5));
    ctx.lineTo(Math.floor(centerX + 5), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX + width * 0.6), Math.floor(centerY + 5));
    ctx.lineTo(Math.floor(centerX + width * 0.5), Math.floor(centerY - 3));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(centerY - 5));
    ctx.closePath();
    ctx.stroke();
    
    // 尾翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 4), Math.floor(this.y + 3));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + 4), Math.floor(this.y + 3));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（中心圆形）- 像素化处理
    ctx.beginPath();
    ctx.arc(Math.floor(centerX), Math.floor(centerY + 1), 4, 0, Math.PI * 2);
    ctx.stroke();
    
    // 添加像素风格的装饰点 - 移到机翼边缘
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - width * 0.55), Math.floor(centerY - 3), 2, 2);
    ctx.fillRect(Math.floor(centerX + width * 0.53), Math.floor(centerY - 3), 2, 2);
  }

  // 渲染侦察机
  renderScout(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（细长三角形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.2), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
    
    // 小机翼（对称三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 1), Math.floor(centerY + 1));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.2), Math.floor(centerY - 3));
    ctx.lineTo(Math.floor(centerX + 1), Math.floor(centerY + 1));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.2), Math.floor(centerY - 3));
    ctx.closePath();
    ctx.stroke();
    
    // 尾翼（小三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 2), Math.floor(this.y + 1));
    ctx.lineTo(Math.floor(centerX - width * 0.15), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + 2), Math.floor(this.y + 1));
    ctx.lineTo(Math.floor(centerX + width * 0.15), Math.floor(this.y));
    ctx.closePath();
    ctx.stroke();
  }

  // 渲染拦截机
  renderInterceptor(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（流线型三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(this.y + height * 0.3));
    ctx.lineTo(Math.floor(centerX - width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.2), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(this.y + height * 0.3));
    ctx.closePath();
    ctx.stroke();
    
    // 后掠机翼（三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 2), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.35), Math.floor(centerY + 4));
    ctx.lineTo(Math.floor(centerX - width * 0.25), Math.floor(centerY - 4));
    ctx.lineTo(Math.floor(centerX + 2), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.35), Math.floor(centerY + 4));
    ctx.lineTo(Math.floor(centerX + width * 0.25), Math.floor(centerY - 4));
    ctx.closePath();
    ctx.stroke();
    
    // 垂直尾翼
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + 2));
    ctx.lineTo(Math.floor(centerX), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX - 3), Math.floor(this.y + 1));
    ctx.closePath();
    ctx.stroke();
  }

  // 渲染隐形战机
  renderStealth(ctx, centerX, centerY) {
    const width = this.width;
    const height = this.height;
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    ctx.strokeStyle = this.type.color[0];
    ctx.lineWidth = 2;
    
    // 机身（菱形，机头朝下）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y + height));
    ctx.lineTo(Math.floor(centerX - width * 0.3), Math.floor(centerY));
    ctx.lineTo(Math.floor(centerX), Math.floor(this.y));
    ctx.lineTo(Math.floor(centerX + width * 0.3), Math.floor(centerY));
    ctx.closePath();
    ctx.stroke();
    
    // 三角翼（大三角形）
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 3), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX - width * 0.45), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX - width * 0.35), Math.floor(centerY - 5));
    ctx.lineTo(Math.floor(centerX + 3), Math.floor(centerY + 2));
    ctx.lineTo(Math.floor(centerX + width * 0.45), Math.floor(centerY + 3));
    ctx.lineTo(Math.floor(centerX + width * 0.35), Math.floor(centerY - 5));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（细长矩形）
    ctx.beginPath();
    ctx.rect(Math.floor(centerX - 2), Math.floor(centerY - 1), 4, 2);
    ctx.stroke();
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
