import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const SUPERWEAPON_WIDTH = 30;
const SUPERWEAPON_HEIGHT = 30;
const SUPERWEAPON_SPEED = 1;

export default class SuperWeapon extends Sprite {
  constructor() {
    super('', SUPERWEAPON_WIDTH, SUPERWEAPON_HEIGHT);
  }

  init(x, y) {
    this.x = x - this.width / 2;
    this.y = y - this.height / 2;
    this.speed = SUPERWEAPON_SPEED;
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
    GameGlobal.databus.removeSuperWeapon(this);
  }

  // 激活超级武器效果
  activate() {
    // 消灭所有敌机
    GameGlobal.databus.enemys.forEach(enemy => {
      enemy.destroy();
    });
    // 增加大量积分
    GameGlobal.databus.score += 100;
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    
    // 闪烁光晕效果
    const currentTime = Date.now();
    const blinkInterval = 300; // 300ms闪烁间隔
    const blinkIntensity = 0.5 + 0.5 * Math.sin(currentTime / blinkInterval * Math.PI);
    
    // 动态发光效果
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 40 * blinkIntensity;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    // 绘制正六边形
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    
    // 纯色填充（无渐变）
    ctx.fillStyle = '#ffff00';
    ctx.fill();
    
    // 添加边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 添加内部高光
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * blinkIntensity})`;
    ctx.fill();
    
    ctx.restore();
  }
} 