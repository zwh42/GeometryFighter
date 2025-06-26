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
   * 绘制纯黑色背景
   */
  render(ctx) {
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 绘制纯黑色背景
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}
