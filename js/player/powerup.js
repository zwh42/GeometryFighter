import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const POWERUP_WIDTH = 20;
const POWERUP_HEIGHT = 20;
const POWERUP_SPEED = 2;

export default class PowerUp extends Sprite {
  constructor() {
    super('', POWERUP_WIDTH, POWERUP_HEIGHT);
  }

  init(x, y) {
    this.x = x - this.width / 2;
    this.y = y - this.height / 2;
    this.speed = POWERUP_SPEED;
    this.isActive = true;
    this.visible = true;
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.y += this.speed;

    // 超出屏幕外销毁
    if (this.y > SCREEN_HEIGHT) {
      this.destroy();
    }
  }

  destroy() {
    this.isActive = false;
    this.visible = false;
    GameGlobal.databus.removePowerUp(this);
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    
    // 添加更强的发光效果
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 30;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    // 绘制正十二边形宝物
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i * 2 * Math.PI) / 12 - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    
    // 填充更鲜艳的渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.5, '#00cc00');
    gradient.addColorStop(1, '#008800');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // 添加内部高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    ctx.restore();
  }
} 