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

  render(dummyCtx) {
    if (!this.visible || !GameGlobal.renderer) return;

    // 闪烁光晕效果
    const currentTime = Date.now();
    const blinkInterval = 300;
    const blinkIntensity = 0.5 + 0.5 * Math.sin(currentTime / blinkInterval * Math.PI);
    
    // 颜色：绿色
    const r = 0.0, g = 1.0, b = 0.0;
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const radius = Math.min(this.width, this.height) / 2;
    
    // 绘制正十二边形
    for (let i = 0; i < 12; i++) {
      const a1 = (i * 2 * Math.PI) / 12 - Math.PI / 2;
      const a2 = ((i+1) * 2 * Math.PI) / 12 - Math.PI / 2;
      
      const x1 = centerX + radius * Math.cos(a1);
      const y1 = centerY + radius * Math.sin(a1);
      const x2 = centerX + radius * Math.cos(a2);
      const y2 = centerY + radius * Math.sin(a2);
      
      GameGlobal.renderer.drawLine(x1, y1, x2, y2, r, g, b, 1.0);
      
      // 高光内部线条
      GameGlobal.renderer.drawLine(centerX, centerY, x1, y1, r, g, b, 0.2 * blinkIntensity);
    }
    
    // 中心高光点
    GameGlobal.renderer.drawLine(centerX - 1, centerY, centerX + 1, centerY, 1, 1, 1, blinkIntensity);
  }

  // 新增：道具生效方法
  applyEffect(player) {
    if (!this.isActive) return;
    // 默认效果：玩家回血20%，加分50
    if (player && typeof player.heal === 'function') {
      player.heal(20);
    }
    if (GameGlobal && GameGlobal.databus) {
      GameGlobal.databus.score += 50;
    }
    this.destroy();
  }
} 