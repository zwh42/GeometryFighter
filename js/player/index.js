import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import Bullet from './bullet';

// 玩家相关常量设置
const PLAYER_IMG_SRC = 'images/hero.png';
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const EXPLO_IMG_PREFIX = 'images/explosion';
const PLAYER_SHOOT_INTERVAL = 20;

export default class Player extends Animation {
  constructor() {
    super(PLAYER_IMG_SRC, PLAYER_WIDTH, PLAYER_HEIGHT);

    // 初始化坐标
    this.init();

    // 初始化事件监听
    this.initEvent();

    // 霰弹模式相关
    this.spreadMode = false;
    this.spreadModeTimer = null;
  }

  init() {
    // 玩家默认处于屏幕底部居中位置
    this.x = SCREEN_WIDTH / 2 - this.width / 2;
    this.y = SCREEN_HEIGHT - this.height - 30;

    // 用于在手指移动的时候标识手指是否已经在飞机上了
    this.touched = false;

    this.isActive = true;
    this.visible = true;

    // 设置爆炸动画
    this.initExplosionAnimation();
  }

  // 预定义爆炸的帧动画
  initExplosionAnimation() {
    const EXPLO_FRAME_COUNT = 19;
    const frames = Array.from(
      { length: EXPLO_FRAME_COUNT },
      (_, i) => `${EXPLO_IMG_PREFIX}${i + 1}.png`
    );
    this.initFrames(frames);
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

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 每20帧让玩家射击一次
    if (GameGlobal.databus.frame % PLAYER_SHOOT_INTERVAL === 0) {
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
    GameGlobal.musicManager.playExplosion(); // 播放爆炸音效
    wx.vibrateShort({
      type: 'medium'
    }); // 震动
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    
    // 添加发光效果
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    
    // 绘制主体三角形
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
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(1, '#0066ff');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }
}
