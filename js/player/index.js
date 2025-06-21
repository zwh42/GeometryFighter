import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import Bullet from './bullet';

// 玩家相关常量设置
const PLAYER_WIDTH = 44;
const PLAYER_HEIGHT = 40;
const PLAYER_SHOOT_INTERVAL = 20;

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
    const deviation = 30;
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
    if (this.spreadMode) {
      // 霰弹模式：发射5发子弹，呈扇形分布
      const angles = [-30, -15, 0, 15, 30];
      angles.forEach(angle => {
        const bullet = GameGlobal.databus.pool.getItemByClass('bullet', Bullet);
        bullet.init(
          this.x + this.width / 2 - bullet.width / 2,
          this.y - 10,
          10,
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
        10
      );
      GameGlobal.databus.bullets.push(bullet);
    }
    GameGlobal.musicManager.playShoot();
  }

  // 添加尾焰粒子
  addTrailParticle() {
    const particle = {
      x: this.x + this.width / 2,
      y: this.y + this.height, // 从战机尾部发射
      vx: (Math.random() - 0.5) * 1, // 减少水平扩散
      vy: Math.random() * 2 + 3, // 向下喷射，符合推进器原理
      life: 1.0,
      decay: 0.02,
      size: Math.random() * 3 + 2
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
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size
      );
      gradient.addColorStop(0, '#00ffff');
      gradient.addColorStop(0.5, '#0088ff');
      gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
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
    const barHeight = 8;
    const barX = SCREEN_WIDTH - barWidth - 20;
    const barY = SCREEN_HEIGHT - 40;
    
    // 计算血量百分比
    const healthPercent = this.health / this.maxHealth;
    
    // 血量低于30%时的闪烁效果
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
    
    // 绘制血条背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 绘制血条边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    const fillWidth = barWidth * healthPercent;
    
    // 根据血量选择颜色
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = '#00ff00';
    } else if (healthPercent > 0.3) {
      healthColor = '#ffff00';
    } else {
      healthColor = '#ff0000';
    }
    
    // 绘制血量
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX + 1, barY + 1, fillWidth - 2, barHeight - 2);
    
    // 绘制血量文字
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.health)}%`, barX + barWidth / 2, barY + 6);
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
    wx.vibrateShort({
      type: 'medium'
    });
  }

  render(ctx) {
    if (!this.visible) return;

    // 先渲染尾焰粒子
    this.renderTrailParticles(ctx);

    ctx.save();
    
    // 超载模式下的红色闪烁效果
    if (this.overloadMode) {
      const currentTime = Date.now();
      const blinkInterval = 200; // 200ms闪烁间隔
      const shouldBlink = Math.floor(currentTime / blinkInterval) % 2 === 0;
      
      if (shouldBlink) {
        // 添加红色发光效果
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 30;
      }
    } else {
      // 正常发光效果
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 25;
    }
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // 绘制科幻前掠翼战机
    ctx.strokeStyle = this.overloadMode ? '#ff0000' : '#00ffff';
    ctx.lineWidth = 2;
    
    // 机身（对称三角形）
    ctx.beginPath();
    ctx.moveTo(centerX, this.y); // 机头
    ctx.lineTo(centerX - 10, this.y + this.height); // 左后角（加宽）
    ctx.lineTo(centerX + 10, this.y + this.height); // 右后角（加宽）
    ctx.closePath();
    ctx.stroke();
    
    // 后掠翼（常规战斗机比例，大幅加宽机翼）
    // 左后掠翼
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY - 6); // 左翼根起始点（与机身宽度匹配）
    ctx.lineTo(centerX - 4, centerY - 9); // 与机身连接线段（增大2倍）
    ctx.lineTo(centerX - 28, centerY + 24); // 左翼尖（增大后掠翼）
    ctx.lineTo(centerX - 22, centerY + 12); // 翼根后缘
    ctx.lineTo(centerX - 12, centerY + 6); // 与机身过渡
    ctx.lineTo(centerX - 10, centerY + 6); // 左翼根结束点
    ctx.lineTo(centerX - 10, centerY - 6); // 回到起始点，形成封闭路径
    ctx.closePath();
    ctx.stroke();
    
    // 左机翼尾端连接线
    ctx.beginPath();
    ctx.moveTo(centerX - 22, centerY + 12); // 从翼根后缘开始
    ctx.lineTo(centerX - 8, centerY + 8); // 连接到机身
    ctx.stroke();
    
    // 右后掠翼
    ctx.beginPath();
    ctx.moveTo(centerX + 10, centerY - 6); // 右翼根起始点（与机身宽度匹配）
    ctx.lineTo(centerX + 4, centerY - 9); // 与机身连接线段（增大2倍）
    ctx.lineTo(centerX + 28, centerY + 24); // 右翼尖（增大后掠翼）
    ctx.lineTo(centerX + 22, centerY + 12); // 翼根后缘
    ctx.lineTo(centerX + 12, centerY + 6); // 与机身过渡
    ctx.lineTo(centerX + 10, centerY + 6); // 右翼根结束点
    ctx.lineTo(centerX + 10, centerY - 6); // 回到起始点，形成封闭路径
    ctx.closePath();
    ctx.stroke();
    
    // 右机翼尾端连接线
    ctx.beginPath();
    ctx.moveTo(centerX + 22, centerY + 12); // 从翼根后缘开始
    ctx.lineTo(centerX + 8, centerY + 8); // 连接到机身
    ctx.stroke();
    
    // 尾翼（对称菱形，加宽）
    // 左尾翼
    ctx.beginPath();
    ctx.moveTo(centerX - 3, this.y + this.height - 4);
    ctx.lineTo(centerX - 8, this.y + this.height); // 加宽
    ctx.lineTo(centerX - 3, this.y + this.height + 4);
    ctx.lineTo(centerX + 3, this.y + this.height);
    ctx.closePath();
    ctx.stroke();
    
    // 右尾翼
    ctx.beginPath();
    ctx.moveTo(centerX + 3, this.y + this.height - 4);
    ctx.lineTo(centerX + 8, this.y + this.height); // 加宽
    ctx.lineTo(centerX + 3, this.y + this.height + 4);
    ctx.lineTo(centerX - 3, this.y + this.height);
    ctx.closePath();
    ctx.stroke();
    
    // 驾驶舱（中心圆形）
    ctx.beginPath();
    ctx.arc(centerX, centerY - 1, 3, 0, Math.PI * 2);
    ctx.stroke();
    
    // 推进器喷嘴（对称，加宽间距）
    ctx.beginPath();
    ctx.arc(centerX - 4, this.y + this.height, 2, 0, Math.PI * 2);
    ctx.arc(centerX + 4, this.y + this.height, 2, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();

    // 渲染血条
    this.renderHealthBar(ctx);
  }
}
