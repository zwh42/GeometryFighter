import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import PowerUp from '../player/powerup';

const ENEMY_IMG_SRC = 'images/enemy.png';
const EXPLO_IMG_PREFIX = 'images/explosion';

// 敌机类型配置
const ENEMY_TYPES = [
  {
    size: 20,  // 小型敌机
    health: 1,
    speed: 4,
    color: ['#ff0000', '#990000'],
    shape: 'circle',
    score: 1
  },
  {
    size: 30,  // 中型敌机
    health: 2,
    speed: 3,
    color: ['#ff6600', '#cc3300'],
    shape: 'hexagon',
    score: 2
  },
  {
    size: 40,  // 大型敌机
    health: 3,
    speed: 2,
    color: ['#ff9900', '#cc6600'],
    shape: 'square',
    score: 3,
    dropRate: 0.3  // 30%概率掉落宝物
  }
];

export default class Enemy extends Animation {
  constructor() {
    super(ENEMY_IMG_SRC, 60, 60);
    this.type = null;
  }

  init() {
    // 随机选择敌机类型
    this.type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    this.width = this.type.size;
    this.height = this.type.size;
    this.health = this.type.health;
    this.speed = this.type.speed;
    
    this.x = this.getRandomX();
    this.y = -this.height;

    this.isActive = true;
    this.visible = true;
    this.initExplosionAnimation();
  }

  // 生成随机 X 坐标
  getRandomX() {
    return Math.floor(Math.random() * (SCREEN_WIDTH - this.width));
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

  // 每一帧更新敌人位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.y += this.speed;

    // 对象回收
    if (this.y > SCREEN_HEIGHT + this.height) {
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

    ctx.save();
    
    // 添加发光效果
    ctx.shadowColor = this.type.color[0];
    ctx.shadowBlur = 15;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    ctx.beginPath();
    
    // 根据类型绘制不同形状
    switch (this.type.shape) {
      case 'circle':
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        break;
      case 'hexagon':
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        break;
      case 'square':
        ctx.rect(this.x, this.y, this.width, this.height);
        break;
    }
    
    ctx.closePath();
    
    // 填充渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, this.type.color[0]);
    gradient.addColorStop(1, this.type.color[1]);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }
}
