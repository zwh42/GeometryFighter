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
    // 限制粒子数量，避免性能问题
    if (this.trailParticles.length >= 8) {
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
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#00ffff';
      
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

  // 渲染血条
  renderHealthBar(ctx) {
    const barWidth = 100;
    const barHeight = 12;
    const barX = 20;
    const barY = 20;
    
    const healthPercent = this.health / this.maxHealth;
    
    // 闪烁效果
    let shouldBlink = false;
    if (healthPercent <= 0.3) {
      const blinkInterval = 3000;
      const currentTime = Date.now();
      shouldBlink = Math.floor(currentTime / (blinkInterval / 2)) % 2 === 0;
    }
    
    // 如果正在闪烁且当前是隐藏状态，则不绘制
    if (shouldBlink) {
      return;
    }
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 绘制血条背景 - 像素化处理
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(Math.floor(barX), Math.floor(barY), Math.floor(barWidth), Math.floor(barHeight));
    
    // 绘制血条边框 - 像素化处理
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.floor(barX), Math.floor(barY), Math.floor(barWidth), Math.floor(barHeight));
    
    const fillWidth = Math.floor(barWidth * healthPercent);
    
    // 根据血量选择颜色 - 使用更鲜艳的像素风格颜色
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = '#00ff00';
    } else if (healthPercent > 0.3) {
      healthColor = '#ffff00';
    } else {
      healthColor = '#ff0000';
    }
    
    // 绘制血量 - 像素化处理
    ctx.fillStyle = healthColor;
    ctx.fillRect(Math.floor(barX + 1), Math.floor(barY + 1), fillWidth - 2, Math.floor(barHeight - 2));
    
    // 添加像素风格的装饰
    if (fillWidth > 4) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.floor(barX + 2), Math.floor(barY + 2), 1, Math.floor(barHeight - 4));
    }
    
    // 绘制血量文字 - 像素化处理
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.health)}%`, Math.floor(barX + barWidth / 2), Math.floor(barY + 9));
    ctx.textAlign = 'left';
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

    ctx.save();
    
    // 像素化效果 - 设置图像平滑为false以获得像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 超载模式下的红色闪烁效果
    if (this.overloadMode) {
      const currentTime = Date.now();
      const blinkInterval = 200; // 200ms闪烁间隔
      const shouldBlink = Math.floor(currentTime / blinkInterval) % 2 === 0;
      
      if (shouldBlink) {
        // 添加红色发光效果
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
      }
    } else {
      // 正常发光效果 - 使用更鲜艳的青色
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
    }
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // 绘制像素风格战机 - 使用更鲜艳的颜色和像素化线条
    ctx.strokeStyle = this.overloadMode ? '#ff0000' : '#00ffff';
    ctx.lineWidth = 2;
    
    // 机身（对称三角形）- 像素化处理
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX), Math.floor(this.y)); // 机头
    ctx.lineTo(Math.floor(centerX - 10), Math.floor(this.y + this.height)); // 左后角
    ctx.lineTo(Math.floor(centerX + 10), Math.floor(this.y + this.height)); // 右后角
    ctx.closePath();
    ctx.stroke();
    
    // 后掠翼 - 像素化处理
    // 左后掠翼
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 10), Math.floor(centerY - 6));
    ctx.lineTo(Math.floor(centerX - 4), Math.floor(centerY - 9));
    ctx.lineTo(Math.floor(centerX - 28), Math.floor(centerY + 24));
    ctx.lineTo(Math.floor(centerX - 22), Math.floor(centerY + 12));
    ctx.lineTo(Math.floor(centerX - 12), Math.floor(centerY + 6));
    ctx.lineTo(Math.floor(centerX - 10), Math.floor(centerY + 6));
    ctx.lineTo(Math.floor(centerX - 10), Math.floor(centerY - 6));
    ctx.closePath();
    ctx.stroke();
    
    // 左机翼尾端连接线
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 22), Math.floor(centerY + 12));
    ctx.lineTo(Math.floor(centerX - 8), Math.floor(centerY + 8));
    ctx.stroke();
    
    // 右后掠翼
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX + 10), Math.floor(centerY - 6));
    ctx.lineTo(Math.floor(centerX + 4), Math.floor(centerY - 9));
    ctx.lineTo(Math.floor(centerX + 28), Math.floor(centerY + 24));
    ctx.lineTo(Math.floor(centerX + 22), Math.floor(centerY + 12));
    ctx.lineTo(Math.floor(centerX + 12), Math.floor(centerY + 6));
    ctx.lineTo(Math.floor(centerX + 10), Math.floor(centerY + 6));
    ctx.lineTo(Math.floor(centerX + 10), Math.floor(centerY - 6));
    ctx.closePath();
    ctx.stroke();
    
    // 右机翼尾端连接线
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX + 22), Math.floor(centerY + 12));
    ctx.lineTo(Math.floor(centerX + 8), Math.floor(centerY + 8));
    ctx.stroke();
    
    // 尾翼（对称菱形）
    // 左尾翼
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 3), Math.floor(this.y + this.height - 4));
    ctx.lineTo(Math.floor(centerX - 8), Math.floor(this.y + this.height));
    ctx.lineTo(Math.floor(centerX - 3), Math.floor(this.y + this.height + 4));
    ctx.lineTo(Math.floor(centerX + 3), Math.floor(this.y + this.height));
    ctx.closePath();
    ctx.stroke();
    
    // 右尾翼
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX + 3), Math.floor(this.y + this.height - 4));
    ctx.lineTo(Math.floor(centerX + 8), Math.floor(this.y + this.height));
    ctx.lineTo(Math.floor(centerX + 3), Math.floor(this.y + this.height + 4));
    ctx.lineTo(Math.floor(centerX - 3), Math.floor(this.y + this.height));
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（中心圆形）- 像素化处理
    ctx.beginPath();
    ctx.arc(Math.floor(centerX), Math.floor(centerY - 1), 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // 推进器喷嘴（对称）
    ctx.beginPath();
    ctx.arc(Math.floor(centerX - 4), Math.floor(this.y + this.height), 2, 0, Math.PI * 2);
    ctx.arc(Math.floor(centerX + 4), Math.floor(this.y + this.height), 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // 添加像素风格的装饰细节
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    
    // 机身上的像素装饰线
    ctx.beginPath();
    ctx.moveTo(Math.floor(centerX - 2), Math.floor(centerY - 3));
    ctx.lineTo(Math.floor(centerX + 2), Math.floor(centerY - 3));
    ctx.stroke();
    
    // 机翼上的像素装饰点
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(centerX - 24), Math.floor(centerY + 8), 2, 2);
    ctx.fillRect(Math.floor(centerX + 22), Math.floor(centerY + 8), 2, 2);
    
    ctx.restore();

    // 渲染血条
    this.renderHealthBar(ctx);
  }
}
