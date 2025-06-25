import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BACKGROUND_WIDTH = 512;
const BACKGROUND_HEIGHT = 512;
const BACKGROUND_SPEED = 2;

/**
 * 游戏背景类
 * 提供 update 和 render 函数实现无限滚动的背景功能
 */
export default class BackGround extends Sprite {
  constructor() {
    super('', BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
    this.top = 0;
  }

  update() {
    if (GameGlobal.databus.isGameOver) {
      return;
    }
  
    this.top += BACKGROUND_SPEED;

    // 如果背景滚动超过屏幕高度，则重置
    if (this.top >= SCREEN_HEIGHT) {
      this.top = 0;
    }
  }

  /**
   * 背景图重绘函数
   * 绘制两张图片，两张图片大小和屏幕一致
   * 第一张漏出高度为 top 部分，其余的隐藏在屏幕上面
   * 第二张补全除了 top 高度之外的部分，其余的隐藏在屏幕下面
   */
  render(ctx) {
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 绘制深色渐变背景 - 使用更鲜艳的颜色
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, '#000022');
    gradient.addColorStop(0.3, '#000044');
    gradient.addColorStop(0.7, '#000066');
    gradient.addColorStop(1, '#000088');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 绘制像素风格的网格线
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    
    // 绘制水平网格线 - 像素化处理
    for (let y = 0; y < SCREEN_HEIGHT; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(y));
      ctx.lineTo(SCREEN_WIDTH, Math.floor(y));
      ctx.stroke();
    }
    
    // 绘制垂直网格线 - 像素化处理
    for (let x = 0; x < SCREEN_WIDTH; x += 32) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(x), 0);
      ctx.lineTo(Math.floor(x), SCREEN_HEIGHT);
      ctx.stroke();
    }

    // 添加像素风格的中心十字线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.floor(SCREEN_WIDTH / 2), 0);
    ctx.lineTo(Math.floor(SCREEN_WIDTH / 2), SCREEN_HEIGHT);
    ctx.moveTo(0, Math.floor(SCREEN_HEIGHT / 2));
    ctx.lineTo(SCREEN_WIDTH, Math.floor(SCREEN_HEIGHT / 2));
    ctx.stroke();
    
    // 添加像素风格的装饰点
    ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
    for (let x = 64; x < SCREEN_WIDTH; x += 128) {
      for (let y = 64; y < SCREEN_HEIGHT; y += 128) {
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      }
    }
  }
}
