import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的敌机子弹尺寸
const enemyBulletSize = deviceAdapter.getEnemyBulletSize();
const ENEMY_BULLET_WIDTH = enemyBulletSize.width;
const ENEMY_BULLET_HEIGHT = enemyBulletSize.height;
const ENEMY_BULLET_SPEED = deviceAdapter.adaptSpeed(3);

export default class EnemyBullet extends Sprite {
  constructor() {
    super('', ENEMY_BULLET_WIDTH, ENEMY_BULLET_HEIGHT);
  }

  init(x, y, enemyColor = '#ffffff') {
    this.x = x - this.width / 2;
    this.y = y;
    this.speed = ENEMY_BULLET_SPEED;
    this.enemyColor = enemyColor; // 保存敌机颜色
    this.isActive = true;
    this.visible = true;
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 直线下落
    this.y += this.speed;

    // 超出屏幕外销毁
    if (this.y > SCREEN_HEIGHT || 
        this.x < -this.width || 
        this.x > SCREEN_WIDTH) {
      this.destroy();
    }
  }

  destroy() {
    this.isActive = false;
    this.visible = false;
    GameGlobal.databus.removeEnemyBullet(this);
  }

  render(dummyCtx) {
    if (!this.visible || !GameGlobal.renderer) return;

    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    
    // 颜色转换
    const colorHex = this.enemyColor;
    const r = parseInt(colorHex.slice(1, 3), 16) / 255;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255;

    const h2 = this.height / 2;
    
    // 渲染外层线条
    GameGlobal.renderer.drawLine(centerX, centerY - h2, centerX, centerY + h2, r, g, b, 1);
    // 渲染白色核心
    GameGlobal.renderer.drawLine(centerX, centerY - h2 * 0.5, centerX, centerY + h2 * 0.5, 1, 1, 1, 1);
  }
}