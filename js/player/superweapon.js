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
        // 创建敌机爆炸效果 - 使用全屏爆炸模式，范围增大100%
        GameGlobal.explosionEffects.createExplosion(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          '#ff6600',
          50, // 较大的爆炸效果
          true // 全屏爆炸模式
        );
        enemy.destroy();
      }
    });
    // 增加大量积分
    GameGlobal.databus.score += 100;
  }

  render(dummyCtx) {
    if (!this.visible || !GameGlobal.renderer) return;

    // 闪烁光晕效果
    const currentTime = Date.now();
    const blinkInterval = 300;
    const blinkIntensity = 0.5 + 0.5 * Math.sin(currentTime / blinkInterval * Math.PI);
    
    // 颜色：黄色
    const r = 1.0, g = 1.0, b = 0.0;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    // 绘制正六边形
    for (let i = 0; i < 6; i++) {
      const a1 = (i * 2 * Math.PI) / 6 - Math.PI / 2;
      const a2 = ((i+1) * 2 * Math.PI) / 6 - Math.PI / 2;
      
      const x1 = centerX + radius * Math.cos(a1);
      const y1 = centerY + radius * Math.sin(a1);
      const x2 = centerX + radius * Math.cos(a2);
      const y2 = centerY + radius * Math.sin(a2);
      
      GameGlobal.renderer.drawLine(x1, y1, x2, y2, r, g, b, 1.0);
      // 加粗感：多画一条内部细线
      GameGlobal.renderer.drawLine(x1*0.9 + centerX*0.1, y1*0.9 + centerY*0.1, x2*0.9 + centerX*0.1, y2*0.9 + centerY*0.1, 1, 1, 1, 0.5 * blinkIntensity);
    }
    
    // 绘制核心十字
    const s = radius * 0.4;
    GameGlobal.renderer.drawLine(centerX - s, centerY, centerX + s, centerY, 1, 1, 1, 1);
    GameGlobal.renderer.drawLine(centerX, centerY - s, centerX, centerY + s, 1, 1, 1, 1);
  }
} 