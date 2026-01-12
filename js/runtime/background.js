import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const GRID_SIZE = 40;
const BACKGROUND_SPEED = 1;

/**
 * 游戏背景类 - Geometry Wars风格动态网格
 */
export default class BackGround extends Sprite {
  constructor() {
    super('', SCREEN_WIDTH, SCREEN_HEIGHT);
    this.top = 0;
    this.points = [];
    this.initGrid();
  }

  /**
   * 初始化网格点
   */
  initGrid() {
    this.points = [];
    const rows = Math.ceil(SCREEN_HEIGHT / GRID_SIZE) + 2;
    const cols = Math.ceil(SCREEN_WIDTH / GRID_SIZE) + 2;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        this.points.push({
          baseX: j * GRID_SIZE,
          baseY: i * GRID_SIZE,
          x: j * GRID_SIZE,
          y: i * GRID_SIZE,
          vx: 0,
          vy: 0
        });
      }
    }
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.top += BACKGROUND_SPEED;
    if (this.top >= GRID_SIZE) {
      this.top = 0;
    }

    // 更新网格点位置，使其产生弹性回归效果
    this.points.forEach(p => {
      // 弹性回归力
      const dx = p.baseX - p.x;
      const dy = p.baseY - p.y;
      
      p.vx += dx * 0.05;
      p.vy += dy * 0.05;
      
      // 阻尼
      p.vx *= 0.9;
      p.vy *= 0.9;
      
      p.x += p.vx;
      p.y += p.vy;
    });
  }

  /**
   * 在指定位置产生网格变形（冲击波效果）
   */
  ripple(centerX, centerY, strength = 20, radius = 100) {
    this.points.forEach(p => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const distSq = dx * dx + dy * dy;
      const radiusSq = radius * radius;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / radius) * strength;
        const angle = Math.atan2(dy, dx);
        
        p.vx += Math.cos(angle) * force;
        p.vy += Math.sin(angle) * force;
      }
    });
  }

  /**
   * 背景渲染函数 - 绘制霓虹风格网格
   */
  render(ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.save();
    ctx.strokeStyle = '#112244'; // 深蓝色网格线
    ctx.lineWidth = 1;
    ctx.beginPath();

    const rows = Math.ceil(SCREEN_HEIGHT / GRID_SIZE) + 2;
    const cols = Math.ceil(SCREEN_WIDTH / GRID_SIZE) + 2;
    const yOffset = this.top - GRID_SIZE;

    // 批量绘制网格线以减少 stroke() 次数
    ctx.beginPath();

    // 绘制横线
    for (let i = 0; i < rows; i++) {
      const rowOffset = i * cols;
      for (let j = 0; j < cols - 1; j++) {
        const p1 = this.points[rowOffset + j];
        const p2 = this.points[rowOffset + j + 1];
        ctx.moveTo(p1.x, p1.y + yOffset);
        ctx.lineTo(p2.x, p2.y + yOffset);
      }
    }

    // 绘制竖线
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < rows - 1; i++) {
        const p1 = this.points[i * cols + j];
        const p2 = this.points[(i + 1) * cols + j];
        ctx.moveTo(p1.x, p1.y + yOffset);
        ctx.lineTo(p2.x, p2.y + yOffset);
      }
    }

    ctx.stroke();
    ctx.restore();
  }
}
