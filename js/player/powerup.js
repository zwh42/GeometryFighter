import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的道具尺寸
const powerUpSize = deviceAdapter.getPowerUpSize();
const POWERUP_WIDTH = powerUpSize.width;
const POWERUP_HEIGHT = powerUpSize.height;
const POWERUP_SPEED = deviceAdapter.adaptSpeed(2);

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
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 闪烁光晕效果
    const currentTime = Date.now();
    const blinkInterval = 300; // 300ms闪烁间隔
    const blinkIntensity = 0.5 + 0.5 * Math.sin(currentTime / blinkInterval * Math.PI);
    
    // 动态发光效果
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15 * blinkIntensity;
    
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    const radius = Math.floor(Math.min(this.width, this.height) / 2);
    
    // 绘制像素风格正十二边形宝物
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i * 2 * Math.PI) / 12 - Math.PI / 2;
      const x = Math.floor(centerX + radius * Math.cos(angle));
      const y = Math.floor(centerY + radius * Math.sin(angle));
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    
    // 使用鲜艳的像素风格颜色
    ctx.fillStyle = '#00ff00';
    ctx.fill();
    
    // 添加像素风格边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 添加像素风格内部高光
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * blinkIntensity})`;
    ctx.fill();
    
    ctx.restore();
  }
} 