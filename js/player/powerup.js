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
    
    // 添加发光效果
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    // 绘制星形宝物
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      const innerAngle = angle + Math.PI / 5;
      const innerX = centerX + radius * 0.4 * Math.cos(innerAngle);
      const innerY = centerY + radius * 0.4 * Math.sin(innerAngle);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    
    // 填充渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(1, '#006600');
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }
} 