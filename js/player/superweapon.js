import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的超级武器尺寸
const superWeaponSize = deviceAdapter.getSuperWeaponSize();
const SUPERWEAPON_WIDTH = superWeaponSize.width;
const SUPERWEAPON_HEIGHT = superWeaponSize.height;
const SUPERWEAPON_SPEED = deviceAdapter.adaptSpeed(1);

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
    // 消灭所有敌机并创建爆炸效果
    GameGlobal.databus.enemys.forEach(enemy => {
      if (enemy && enemy.isActive) {
        // 创建敌机爆炸效果
        GameGlobal.explosionEffects.createExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          '#ff6600',
          50 // 较大的爆炸效果
        );
        enemy.destroy();
      }
    });
    // 增加大量积分
    GameGlobal.databus.score += 100;
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
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 20 * blinkIntensity;
    
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    const radius = Math.floor(Math.min(this.width, this.height) / 2);
    
    // 绘制像素风格正六边形
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
      const x = Math.floor(centerX + radius * Math.cos(angle));
      const y = Math.floor(centerY + radius * Math.sin(angle));
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
    
    // 添加像素风格边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 添加像素风格内部高光
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * blinkIntensity})`;
    ctx.fill();
    
    // 添加像素风格的装饰点
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
    
    // 添加像素风格的角装饰
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(centerX - radius + 2, centerY - 1, 2, 2);
    ctx.fillRect(centerX + radius - 4, centerY - 1, 2, 2);
    ctx.fillRect(centerX - 1, centerY - radius + 2, 2, 2);
    ctx.fillRect(centerX - 1, centerY + radius - 4, 2, 2);
    
    ctx.restore();
  }
} 