import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import deviceAdapter from '../utils/deviceAdapter';

// 获取适配后的子弹尺寸
const bulletSize = deviceAdapter.getBulletSize();
const BULLET_WIDTH = bulletSize.width;
const BULLET_HEIGHT = bulletSize.height;

export default class Bullet extends Sprite {
  constructor() {
    super('', BULLET_WIDTH, BULLET_HEIGHT);
  }

  init(x, y, speed, angle = 0) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.angle = angle * Math.PI / 180; // 转换为弧度
    this.isActive = true;
    this.visible = true;
  }

  // 每一帧更新子弹位置
  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    // 检查是否需要追踪敌机
    this.checkAndUpdateTracking();
  
    // 根据角度更新位置
    this.x += Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;

    // 超出屏幕外销毁
    if (this.y < -this.height || this.x < -this.width || this.x > SCREEN_WIDTH) {
      this.destroy();
    }
  }

  // 检查并更新追踪目标
  checkAndUpdateTracking() {
    const bulletCenterX = this.x + this.width / 2;
    const bulletCenterY = this.y + this.height / 2;
    
    // 寻找最近的敌机
    let nearestEnemy = null;
    let nearestDistance = Infinity;
    
    GameGlobal.databus.enemys.forEach(enemy => {
      if (!enemy.isActive) return;
      
      // 检查子弹是否在敌机的边界框内
      const enemyLeft = enemy.x;
      const enemyRight = enemy.x + enemy.width;
      const enemyTop = enemy.y;
      const enemyBottom = enemy.y + enemy.height;
      
      if (bulletCenterX >= enemyLeft && bulletCenterX <= enemyRight &&
          bulletCenterY >= enemyTop && bulletCenterY <= enemyBottom) {
        
        // 计算到敌机中心的距离
        const enemyCenterX = enemy.x + enemy.width / 2;
        const enemyCenterY = enemy.y + enemy.height / 2;
        const distance = Math.sqrt(
          Math.pow(bulletCenterX - enemyCenterX, 2) + 
          Math.pow(bulletCenterY - enemyCenterY, 2)
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = enemy;
        }
      }
    });
    
    // 如果找到目标敌机，更新子弹角度
    if (nearestEnemy) {
      const enemyCenterX = nearestEnemy.x + nearestEnemy.width / 2;
      const enemyCenterY = nearestEnemy.y + nearestEnemy.height / 2;
      
      // 计算到敌机中心的方向
      const dx = enemyCenterX - bulletCenterX;
      const dy = enemyCenterY - bulletCenterY;
      
      // 更新子弹角度，使其朝向敌机中心
      this.angle = Math.atan2(dx, -dy);
    }
  }

  destroy() {
    this.isActive = false;
    // 子弹没有销毁动画，直接移除
    this.remove();
  }

  remove() {
    this.isActive = false;
    this.visible = false;
    // 回收子弹对象
    GameGlobal.databus.removeBullets(this);
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 添加Geometry Wars风格的发光效果
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    
    const centerX = Math.floor(this.x + this.width / 2);
    const centerY = Math.floor(this.y + this.height / 2);
    
    // 绘制锐角形状的子弹 - Geometry Wars风格
    ctx.beginPath();
    
    // 计算锐角的两条边
    const angle = this.angle;
    const length = this.height;
    const width = this.width;
    
    // 锐角的顶点（指向目标）
    const tipX = Math.floor(centerX + Math.sin(angle) * length / 2);
    const tipY = Math.floor(centerY - Math.cos(angle) * length / 2);
    
    // 锐角的两条边
    const leftAngle = angle + Math.PI / 6; // 30度角
    const rightAngle = angle - Math.PI / 6; // -30度角
    
    const leftX = Math.floor(centerX + Math.sin(leftAngle) * width / 2);
    const leftY = Math.floor(centerY - Math.cos(leftAngle) * width / 2);
    
    const rightX = Math.floor(centerX + Math.sin(rightAngle) * width / 2);
    const rightY = Math.floor(centerY - Math.cos(rightAngle) * width / 2);
    
    // 绘制锐角形状
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    
    // 使用Geometry Wars风格的青色
    ctx.fillStyle = '#00ffff';
    ctx.fill();
    
    // 添加内部高光
    ctx.fillStyle = '#ffffff';
    const highlightX = Math.floor(tipX - Math.sin(angle) * 2);
    const highlightY = Math.floor(tipY + Math.cos(angle) * 2);
    ctx.fillRect(highlightX - 1, highlightY - 1, 2, 2);
    
    // 添加边框
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
}
