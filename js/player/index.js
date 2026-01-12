import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import Bullet from './bullet';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的玩家战机尺寸
const playerSize = deviceAdapter.getPlayerSize();
const PLAYER_WIDTH = playerSize.width;
const PLAYER_HEIGHT = playerSize.height;
const PLAYER_SHOOT_INTERVAL = deviceAdapter.getShootInterval();

export default class Player extends Animation {
  constructor() {
    super('', PLAYER_WIDTH, PLAYER_HEIGHT);

    // 初始化坐标
    this.init();

    // 初始化事件监听
    this.initEvent();

    // 霰弹模式相关
    this.spreadMode = false;
    this.spreadModeTimer = null;

    // 超载状态相关
    this.overloadMode = false;
    this.overloadModeTimer = null;
    this.overloadStartTime = 0;

    // 尾焰粒子系统
    this.trailParticles = [];
    this.lastX = 0;
    this.lastY = 0;

    // 血条系统
    this.maxHealth = 100;
    this.health = 100;
  }

  init() {
    // 玩家默认处于屏幕底部居中位置
    this.x = SCREEN_WIDTH / 2 - this.width / 2;
    this.y = SCREEN_HEIGHT - this.height - 30;

    // 用于在手指移动的时候标识手指是否已经在飞机上了
    this.touched = false;

    this.isActive = true;
    this.visible = true;

    // 初始化爆炸动画（19帧几何粒子爆炸效果）
    this.count = 19;
    this.imgList = [];
    
    // 推入到全局动画池
    GameGlobal.databus.animations.push(this);

    // 重置血量
    this.health = this.maxHealth;
  }

  /**
   * 判断手指是否在飞机上
   * @param {Number} x: 手指的X轴坐标
   * @param {Number} y: 手指的Y轴坐标
   * @return {Boolean}: 用于标识手指是否在飞机上的布尔值
   */
  checkIsFingerOnAir(x, y) {
    const deviation = deviceAdapter.getTouchDeviation();
    return (
      x >= this.x - deviation &&
      y >= this.y - deviation &&
      x <= this.x + this.width + deviation &&
      y <= this.y + this.height + deviation
    );
  }

  /**
   * 根据手指的位置设置飞机的位置
   * 保证手指处于飞机中间
   * 同时限定飞机的活动范围限制在屏幕中
   */
  setAirPosAcrossFingerPosZ(x, y) {
    const disX = Math.max(
      0,
      Math.min(x - this.width / 2, SCREEN_WIDTH - this.width)
    );
    const disY = Math.max(
      0,
      Math.min(y - this.height / 2, SCREEN_HEIGHT - this.height)
    );

    this.x = disX;
    this.y = disY;
  }

  /**
   * 玩家响应手指的触摸事件
   * 改变战机的位置
   */
  initEvent() {
    wx.onTouchStart((e) => {
      const { clientX: x, clientY: y } = e.touches[0];

      if (GameGlobal.databus.isGameOver) {
        return;
      }
      if (this.checkIsFingerOnAir(x, y)) {
        this.touched = true;
        this.setAirPosAcrossFingerPosZ(x, y);
      }
    });

    wx.onTouchMove((e) => {
      const { clientX: x, clientY: y } = e.touches[0];

      if (GameGlobal.databus.isGameOver) {
        return;
      }
      if (this.touched) {
        this.setAirPosAcrossFingerPosZ(x, y);
      }
    });

    wx.onTouchEnd((e) => {
      this.touched = false;
    });

    wx.onTouchCancel((e) => {
      this.touched = false;
    });
  }

  // 开启霰弹模式
  enableSpreadMode() {
    this.spreadMode = true;
    
    // 清除之前的定时器
    if (this.spreadModeTimer) {
      clearTimeout(this.spreadModeTimer);
    }
    
    // 15秒后关闭霰弹模式
    this.spreadModeTimer = setTimeout(() => {
      this.spreadMode = false;
    }, 15000);
  }

  /**
   * 玩家射击操作
   * 射击时机由外部决定
   */
  shoot() {
    // 使用设备适配器获取适配后的子弹速度
    const bulletSpeed = GameGlobal.deviceAdapter.adaptSpeed(10);
    
    if (this.spreadMode) {
      // 霰弹模式：发射5发子弹，呈扇形分布
      const angles = [-30, -15, 0, 15, 30];
      angles.forEach(angle => {
        const bullet = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);
        bullet.init(
          this.x + this.width / 2 - bullet.width / 2,
          this.y - 10,
          bulletSpeed,
          angle
        );
        GameGlobal.databus.bullets.push(bullet);
      });
    } else {
      // 普通模式：发射单发子弹
      const bullet = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);
      bullet.init(
        this.x + this.width / 2 - bullet.width / 2,
        this.y - 10,
        bulletSpeed
      );
      GameGlobal.databus.bullets.push(bullet);
    }
    GameGlobal.musicManager.playShoot();
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
    const maxParticles = isMobile ? 0 : 8;
    
    // 限制粒子数量，避免性能问题
    if (this.trailParticles.length >= maxParticles) {
      return;
    }
    
    const particle = {
      x: this.x + this.width / 2,
      y: this.y + this.height, // 从战机尾部发射
      vx: (Math.random() - 0.5) * 0.5, // 减少水平扩散
      vy: Math.random() * 1.5 + 2, // 向下喷射，符合推进器原理
      life: 1.0,
      decay: 0.03, // 加快衰减速度
      size: Math.random() * 2 + 1 // 减小粒子大小
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

  // 渲染尾焰粒子 - 使用 WebGL 批处理
  renderTrailParticles(dummyCtx) {
    if (this.trailParticles.length === 0 || !GameGlobal.renderer) {
      return;
    }
    
    for (const particle of this.trailParticles) {
      const alpha = particle.life;
      const size = particle.size * particle.life;
      
      // 颜色：青色
      const r = 0.0, g = 1.0, b = 1.0;
      
      // 绘制一个小十字模拟像素
      GameGlobal.renderer.drawLine(
          particle.x - size / 2, particle.y, 
          particle.x + size / 2, particle.y, 
          r, g, b, alpha * 0.8
      );
      GameGlobal.renderer.drawLine(
          particle.x, particle.y - size / 2, 
          particle.x, particle.y + size / 2, 
          r, g, b, alpha * 0.8
      );
      
      // 白色高光
      if (size > 1.5) {
        GameGlobal.renderer.drawLine(
            particle.x - 0.5, particle.y, 
            particle.x + 0.5, particle.y, 
            1, 1, 1, alpha * 0.5
        );
      }
    }
  }

  // 受到伤害
  takeDamage(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.health = 0;
      this.destroy();
    }
  }

  // 回血
  heal(amount) {
    // 超载状态下回血速率提升1倍
    const healAmount = this.overloadMode ? amount * 2 : amount;
    this.health += healAmount;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }

  // 检查并激活超载状态
  checkOverloadMode() {
    const healthPercent = this.health / this.maxHealth;
    
    if (healthPercent <= 0.2 && !this.overloadMode) {
      // 激活超载状态
      this.overloadMode = true;
      this.overloadStartTime = Date.now();
      
      // 清除之前的定时器
      if (this.overloadModeTimer) {
        clearTimeout(this.overloadModeTimer);
      }
      
      // 5秒后关闭超载模式
      this.overloadModeTimer = setTimeout(() => {
        this.overloadMode = false;
      }, 5000);
    }
  }

  // 获取当前射击间隔
  getShootInterval() {
    if (this.overloadMode) {
      return PLAYER_SHOOT_INTERVAL / 2; // 超载状态下射击频率翻倍
    }
    return PLAYER_SHOOT_INTERVAL;
  }

  // 渲染血条 - 使用 WebGL 绘制
  renderHealthBar(dummyCtx) {
    if (!GameGlobal.renderer) return;

    const barWidth = 100;
    const barHeight = 12;
    const barX = 20;
    const barY = 20;
    
    const healthPercent = this.health / this.maxHealth;
    
    // 闪烁效果
    if (healthPercent <= 0.3) {
      if (Math.floor(Date.now() / 250) % 2 === 0) return;
    }
    
    // 绘制背景边框 (暗灰色)
    const rB = 0.2, gB = 0.2, bB = 0.2;
    GameGlobal.renderer.drawLine(barX, barY, barX + barWidth, barY, rB, gB, bB, 1.0);
    GameGlobal.renderer.drawLine(barX + barWidth, barY, barX + barWidth, barY + barHeight, rB, gB, bB, 1.0);
    GameGlobal.renderer.drawLine(barX + barWidth, barY + barHeight, barX, barY + barHeight, rB, gB, bB, 1.0);
    GameGlobal.renderer.drawLine(barX, barY + barHeight, barX, barY, rB, gB, bB, 1.0);

    // 绘制血条内部
    let r = 0, g = 1, b = 0;
    if (healthPercent < 0.3) { r = 1; g = 0; }
    else if (healthPercent < 0.6) { r = 1; g = 1; }

    const fillWidth = barWidth * healthPercent;
    if (fillWidth > 0) {
        // 使用多条线填充高度
        for (let i = 1; i < barHeight; i++) {
            GameGlobal.renderer.drawLine(barX, barY + i, barX + fillWidth, barY + i, r, g, b, 1.0);
        }
    }

    // 绘制百分比数字 (白色)
    GameGlobal.renderer.drawNumber(barX + barWidth + 5, barY + 2, Math.ceil(this.health), 1, 1, 1, 1, 0.8);
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 检查超载状态
    this.checkOverloadMode();

    // 检测移动并添加尾焰粒子
    if (this.x !== this.lastX || this.y !== this.lastY) {
      this.addTrailParticle();
      this.lastX = this.x;
      this.lastY = this.y;
    }

    // 更新尾焰粒子
    this.updateTrailParticles();

    // 根据当前射击间隔让玩家射击
    if (GameGlobal.databus.frame % this.getShootInterval() === 0) {
      this.shoot();
    }

    // 检测是否吃到宝物
    GameGlobal.databus.powerUps.forEach(powerUp => {
      if (this.isCollideWith(powerUp)) {
        this.enableSpreadMode();
        powerUp.destroy();
      }
    });
  }

  destroy() {
    this.isActive = false;
    this.playAnimation();
    GameGlobal.musicManager.playExplosion();
  }

  render(ctx) {
    if (!this.visible) return;

    // 先渲染尾焰粒子
    this.renderTrailParticles(ctx);

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const w = this.width;
    const h = this.height;

    // WebGL 渲染战机
    if (GameGlobal.renderer) {
      const r = this.overloadMode ? 1.0 : 0.0;
      const g = this.overloadMode ? 0.0 : 1.0;
      const b = this.overloadMode ? 0.0 : 1.0;
      
      // 头部到右翼
      GameGlobal.renderer.drawLine(centerX, centerY - h / 2, centerX + w / 2, centerY + h / 2, r, g, b, 1.0);
      // 右翼到右尾端
      GameGlobal.renderer.drawLine(centerX + w / 2, centerY + h / 2, centerX + w / 4, centerY + h / 4, r, g, b, 1.0);
      
      // 头部到左翼
      GameGlobal.renderer.drawLine(centerX, centerY - h / 2, centerX - w / 2, centerY + h / 2, r, g, b, 1.0);
      // 左翼到左尾端
      GameGlobal.renderer.drawLine(centerX - w / 2, centerY + h / 2, centerX - w / 4, centerY + h / 4, r, g, b, 1.0);

      // 中心核心点 (用四根极短的线模拟一个小点，或后续增加 drawPoint)
      const dotHalf = 1;
      GameGlobal.renderer.drawLine(centerX - dotHalf, centerY - 2, centerX + dotHalf, centerY - 2, 1, 1, 1, 1);
    }

    // UI 渲染 (由于 GameInfo 还在用 2D，此处也保留 2D 兼容层，直到全部切换)
    this.renderHealthBar(ctx);
  }
}
