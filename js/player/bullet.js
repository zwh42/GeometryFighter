import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BULLET_IMG_SRC = 'images/bullet.png';
const BULLET_WIDTH = 8;
const BULLET_HEIGHT = 15;

export default class Bullet extends Sprite {
  constructor() {
    super(BULLET_IMG_SRC, BULLET_WIDTH, BULLET_HEIGHT);
  }

  init(x, y, speed, angle = 0) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.angle = angle * Math.PI / 180; // 转换为弧度
    this.isActive = true;
    this.visible = true;
  }

  // 每一帧更新子弹位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }
  
    // 根据角度更新位置
    this.x += Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;

    // 超出屏幕外销毁
    if (this.y < -this.height || this.x < -this.width || this.x > SCREEN_WIDTH) {
      this.destroy();
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

    ctx.save();
    
    // 添加发光效果
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
    
    // 绘制子弹（菱形）
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height / 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.height);
    ctx.lineTo(this.x, this.y + this.height / 2);
    ctx.closePath();
    
    // 填充渐变
    const gradient = ctx.createLinearGradient(
      this.x, this.y,
      this.x + this.width, this.y + this.height
    );
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(1, '#ff66ff');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }
}
