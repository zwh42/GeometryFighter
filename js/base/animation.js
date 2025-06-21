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
  aniRender(ctx) {
    if (this.index >= 0 && this.index < this.count) {
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      const radius = Math.min(this.width, this.height) * (this.index / this.count);
      const progress = this.index / this.count;
      
      // 绘制精细的爆炸效果
      ctx.save();
      
      // 添加更强的发光效果
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 50;
      
      // 绘制多层爆炸粒子
      const particleLayers = [
        { count: 24, radius: radius * 0.8, color: ['#ffff00', '#ffdd00', '#ffaa00'] },
        { count: 18, radius: radius * 1.2, color: ['#ff8800', '#ff6600', '#ff4400'] },
        { count: 12, radius: radius * 1.6, color: ['#ff2200', '#ff0000', '#cc0000'] }
      ];
      
      particleLayers.forEach((layer, layerIndex) => {
        for (let i = 0; i < layer.count; i++) {
          const angle = (i * Math.PI * 2) / layer.count;
          const x = centerX + layer.radius * Math.cos(angle);
          const y = centerY + layer.radius * Math.sin(angle);
          
          // 粒子大小随进度变化
          const particleSize = radius * 0.08 * (1 - progress * 0.5);
          
          // 绘制粒子
          ctx.beginPath();
          ctx.arc(x, y, particleSize, 0, Math.PI * 2);
          
          // 填充渐变
          const gradient = ctx.createRadialGradient(
            x, y, 0,
            x, y, particleSize
          );
          gradient.addColorStop(0, layer.color[0]);
          gradient.addColorStop(0.4, layer.color[1]);
          gradient.addColorStop(0.8, layer.color[2]);
          gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });
      
      // 绘制中心爆炸核心
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
      const centerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius * 0.6
      );
      centerGradient.addColorStop(0, '#ffffff');
      centerGradient.addColorStop(0.1, '#ffff00');
      centerGradient.addColorStop(0.3, '#ffdd00');
      centerGradient.addColorStop(0.6, '#ff8800');
      centerGradient.addColorStop(0.9, '#ff4400');
      centerGradient.addColorStop(1, '#ff0000');
      ctx.fillStyle = centerGradient;
      ctx.fill();
      
      // 绘制多层爆炸冲击波
      const shockwaveCount = 3;
      for (let i = 0; i < shockwaveCount; i++) {
        const waveRadius = radius * (1.2 + i * 0.3);
        const waveAlpha = 0.4 * (1 - progress) * (1 - i * 0.2);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // 绘制火花效果
      for (let i = 0; i < 8; i++) {
        const sparkAngle = (i * Math.PI) / 4 + progress * Math.PI;
        const sparkLength = radius * 0.3;
        const sparkX1 = centerX + Math.cos(sparkAngle) * radius * 0.8;
        const sparkY1 = centerY + Math.sin(sparkAngle) * radius * 0.8;
        const sparkX2 = centerX + Math.cos(sparkAngle) * (radius * 0.8 + sparkLength);
        const sparkY2 = centerY + Math.sin(sparkAngle) * (radius * 0.8 + sparkLength);
        
        ctx.beginPath();
        ctx.moveTo(sparkX1, sparkY1);
        ctx.lineTo(sparkX2, sparkY2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      ctx.restore();
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
