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
   * 初始化网格点及其邻居关系
   */
  initGrid() {
    this.points = [];
    this.cols = Math.ceil(SCREEN_WIDTH / GRID_SIZE) + 2;
    this.rows = Math.ceil(SCREEN_HEIGHT / GRID_SIZE) + 2;

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const x = j * GRID_SIZE;
        const y = i * GRID_SIZE;
        this.points.push({
          baseX: x,
          baseY: y,
          x: x,
          y: y,
          oldX: x, // 用于 Verlet 积分
          oldY: y,
          vx: 0,
          vy: 0,
          row: i,
          col: j
        });
      }
    }
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    this.top += BACKGROUND_SPEED;
    if (this.top >= GRID_SIZE) this.top = 0;

    const stiffness = 0.08; // 弹性系数
    const damping = 0.92;   // 阻尼

    // 1. Verlet 积分与回归力
    this.points.forEach(p => {
      // 速度 = 当前 - 上一次
      const vx = (p.x - p.oldX) * damping;
      const vy = (p.y - p.oldY) * damping;
      
      p.oldX = p.x;
      p.oldY = p.y;
      
      p.x += vx;
      p.y += vy;
      
      // 回归到初始位置的弹力
      p.x += (p.baseX - p.x) * (stiffness * 0.5);
      p.y += (p.baseY - p.y) * (stiffness * 0.5);
    });

    // 2. 网格点间的约束 (实现液体感)
    // 简化处理：每个点向右和向下尝试平衡
    for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
            const p = this.points[i * this.cols + j];
            
            // 向右拉
            if (j < this.cols - 1) {
                this.solveInConstraint(p, this.points[i * this.cols + j + 1], GRID_SIZE);
            }
            // 向下拉
            if (i < this.rows - 1) {
                this.solveInConstraint(p, this.points[(i + 1) * this.cols + j], GRID_SIZE);
            }
        }
    }
  }

  solveInConstraint(p1, p2, targetDist) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;
      
      const diff = (targetDist - dist) / dist * 0.15; // 约束强度
      const offsetX = dx * diff;
      const offsetY = dy * diff;
      
      p1.x -= offsetX;
      p1.y -= offsetY;
      p2.x += offsetX;
      p2.y += offsetY;
  }

  /**
   * 在指定位置产生网格变形 (增强版)
   */
  ripple(centerX, centerY, strength = 40, radius = 150) {
    const radiusSq = radius * radius;
    this.points.forEach(p => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const distSq = dx * dx + dy * dy;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / radius) * strength;
        const angle = Math.atan2(dy, dx);
        
        // 修改 oldX/oldY 来通过 Verlet 积分产生爆发初速度
        p.x += Math.cos(angle) * force;
        p.y += Math.sin(angle) * force;
      }
    });
  }

  /**
   * 背景渲染函数 - 使用 WebGL 批处理
   */
  render(dummyCtx) {
    if (!GameGlobal.renderer) return;

    const rows = Math.ceil(SCREEN_HEIGHT / GRID_SIZE) + 2;
    const cols = Math.ceil(SCREEN_WIDTH / GRID_SIZE) + 2;
    const yOffset = this.top - GRID_SIZE;

    // 网格颜色：深蓝色 #112244 -> (0.07, 0.13, 0.27)
    const r = 0.07, g = 0.13, b = 0.27;

    // 批量添加横线
    for (let i = 0; i < rows; i++) {
      const rowOffset = i * cols;
      for (let j = 0; j < cols - 1; j++) {
        const p1 = this.points[rowOffset + j];
        const p2 = this.points[rowOffset + j + 1];
        GameGlobal.renderer.drawLine(
            p1.x, p1.y + yOffset, 
            p2.x, p2.y + yOffset, 
            r, g, b, 1.0
        );
      }
    }

    // 批量添加竖线
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < rows - 1; i++) {
        const p1 = this.points[i * cols + j];
        const p2 = this.points[(i + 1) * cols + j];
        GameGlobal.renderer.drawLine(
            p1.x, p1.y + yOffset, 
            p2.x, p2.y + yOffset, 
            r, g, b, 1.0
        );
      }
    }
  }
}
