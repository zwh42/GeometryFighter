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

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 添加Geometry Wars风格的发光效果
    ctx.shadowColor = this.enemyColor;
    ctx.shadowBlur = 15;
    
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    
    // 绘制 Geometry Wars 经典粒子子弹 (短线/点)
    ctx.strokeStyle = this.enemyColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - this.height / 2);
    ctx.lineTo(centerX, centerY + this.height / 2);
    ctx.stroke();
    
    // 核心高光
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
} 