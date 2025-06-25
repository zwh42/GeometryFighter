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

  init(x, y) {
    this.x = x - this.width / 2;
    this.y = y;
    this.speed = ENEMY_BULLET_SPEED;
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
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    
    // 绘制锐角形状的敌机子弹 - Geometry Wars风格
    ctx.beginPath();
    
    // 计算锐角的两条边（指向下方）
    const angle = Math.PI / 2; // 向下
    const length = this.height;
    const width = this.width;
    
    // 锐角的顶点（指向下方）
    const tipX = centerX;
    const tipY = Math.floor(this.y + this.height);
    
    // 锐角的两条边
    const leftAngle = angle + Math.PI / 6; // 30度角
    const rightAngle = angle - Math.PI / 6; // -30度角
    
    const leftX = Math.floor(centerX + Math.sin(leftAngle) * width / 2);
    const leftY = Math.floor(centerY + Math.cos(leftAngle) * width / 2);
    
    const rightX = Math.floor(centerX + Math.sin(rightAngle) * width / 2);
    const rightY = Math.floor(centerY + Math.cos(rightAngle) * width / 2);
    
    // 绘制锐角形状
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    
    // 使用Geometry Wars风格的红色
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    
    // 添加内部高光
    ctx.fillStyle = '#ffffff';
    const highlightX = centerX;
    const highlightY = Math.floor(tipY - 2);
    ctx.fillRect(highlightX - 1, highlightY - 1, 2, 2);
    
    // 添加边框
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
} 