import Sprite from './sprite';

const __ = {
  timer: Symbol('timer'),
};

/**
 * 简易的帧动画类实现
 */
export default class Animation extends Sprite {
  constructor(imgSrc, width, height) {
    super(imgSrc, width, height);

    this.isPlaying = false; // 当前动画是否播放中
    this.loop = false; // 动画是否需要循环播放
    this.interval = 1000 / 60; // 每一帧的时间间隔
    this[__.timer] = null; // 帧定时器
    this.index = -1; // 当前播放的帧
    this.count = 0; // 总帧数
    this.imgList = []; // 帧图片集合
  }

  /**
   * 初始化帧动画的所有帧
   * @param {Array} imgList - 帧图片的路径数组
   */
  initFrames(imgList) {
    this.imgList = imgList.map((src) => {
      const img = wx.createImage();
      img.src = src;
      return img;
    });

    this.count = imgList.length;

    // 推入到全局动画池，便于全局绘图的时候遍历和绘制当前动画帧
    GameGlobal.databus.animations.push(this);
  }

  // 将播放中的帧绘制到canvas上
  aniRender(dummyCtx) {
    if (this.index >= 0 && this.index < this.count && GameGlobal.renderer) {
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      const radius = Math.min(this.width, this.height) * (this.index / this.count);
      const progress = this.index / this.count;
      const alpha = 1 - progress;
      
      // 颜色：橘橙色系
      const r = 1.0, g = 0.5, b = 0.0;
      
      // 绘制几圈射线模拟爆炸
      const rayCount = 12;
      for (let i = 0; i < rayCount; i++) {
          const angle = (i * Math.PI * 2) / rayCount;
          const x1 = centerX + radius * 0.5 * Math.cos(angle);
          const y1 = centerY + radius * 0.5 * Math.sin(angle);
          const x2 = centerX + radius * 1.5 * Math.cos(angle);
          const y2 = centerY + radius * 1.5 * Math.sin(angle);
          
          GameGlobal.renderer.drawLine(x1, y1, x2, y2, r, g, b, alpha);
          // 内部白色
          GameGlobal.renderer.drawLine(centerX, centerY, x1, y1, 1, 1, 1, alpha * 0.5);
      }
    }
  }

  // 播放预定的帧动画
  playAnimation(index = 0, loop = false) {
    this.visible = false; // 动画播放时隐藏精灵图
    this.isPlaying = true;
    this.loop = loop;
    this.index = index;

    if (this.interval > 0 && this.count) {
      this[__.timer] = setInterval(this.frameLoop.bind(this), this.interval);
    }
  }

  // 停止帧动画播放
  stopAnimation() {
    this.isPlaying = false;
    this.index = -1;
    if (this[__.timer]) {
      clearInterval(this[__.timer]);
      this[__.timer] = null; // 清空定时器引用
      this.emit('stopAnimation');
    }
  }

  // 帧遍历
  frameLoop() {
    this.index++;

    if (this.index >= this.count) {
      if (this.loop) {
        this.index = 0; // 循环播放
      } else {
        this.index = this.count - 1; // 保持在最后一帧
        this.stopAnimation(); // 停止播放
      }
    }
  }
}
