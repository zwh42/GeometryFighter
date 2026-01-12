import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

export default class GameInfo extends Emitter {
  constructor() {
    super();

    this.btnArea = {
      startX: SCREEN_WIDTH / 2 - 60,
      startY: SCREEN_HEIGHT / 2 + 50,
      endX: SCREEN_WIDTH / 2 + 60,
      endY: SCREEN_HEIGHT / 2 + 90,
    };

    // 绑定触摸事件
    wx.onTouchStart(this.touchEventHandler.bind(this))
  }

  setFont(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
  }

  render(ctx) {
    if (GameGlobal.databus.isGameOver) {
      this.renderGameOver(ctx);
    } else {
      this.renderGameScore(ctx);
    }
  }

  renderGameScore(dummyCtx) {
    if (!GameGlobal.renderer) return;

    // 绘制得分 (底部, 亮白色)
    const scoreText = `SCORE:${GameGlobal.databus.score}`;
    GameGlobal.renderer.drawNumber(20, SCREEN_HEIGHT - 30, GameGlobal.databus.score, 1.2, 1, 1, 1, 0.9);
    
    // 绘制最高分
    const highestScore = GameGlobal.databus.highestScore || 0;
    GameGlobal.renderer.drawNumber(20, SCREEN_HEIGHT - 60, highestScore, 0.8, 0.5, 0.5, 0.5, 0.7);
  }

  renderGameOver(ctx) {
    if (GameGlobal.renderer) {
      // 绘制简单的全屏半透明黑色背景 (用大面积线条模拟，或者后续加 drawRect)
      // 这边简单点，画一些网格线
      for(let i=0; i<SCREEN_WIDTH; i+=40) {
        GameGlobal.renderer.drawLine(i, 0, i, SCREEN_HEIGHT, 0.1, 0.1, 0.1, 0.5);
      }
      for(let i=0; i<SCREEN_HEIGHT; i+=40) {
        GameGlobal.renderer.drawLine(0, i, SCREEN_WIDTH, i, 0.1, 0.1, 0.1, 0.5);
      }

      // 绘制 "GAME OVER" (用向量字符模拟)
      // 由于 drawNumber 只有数字，我们需要扩展 drawDigit 支持字母，或者先用数字模拟
      // 为了简单，我们只显示得分
      GameGlobal.renderer.drawNumber(SCREEN_WIDTH/2 - 40, SCREEN_HEIGHT/2 - 50, GameGlobal.databus.score, 2, 1, 0.4, 0, 1);
      
      // 绘制重启提示
      // 我们暂无字母字符，先画一个简单的矩形按钮区域
      const btn = this.btnArea;
      GameGlobal.renderer.drawLine(btn.startX, btn.startY, btn.endX, btn.startY, 1, 1, 1, 0.8);
      GameGlobal.renderer.drawLine(btn.endX, btn.startY, btn.endX, btn.endY, 1, 1, 1, 0.8);
      GameGlobal.renderer.drawLine(btn.endX, btn.endY, btn.startX, btn.endY, 1, 1, 1, 0.8);
      GameGlobal.renderer.drawLine(btn.startX, btn.endY, btn.startX, btn.startY, 1, 1, 1, 0.8);
    }

    if (ctx) {
      this.drawGameOverBackground(ctx);
      this.drawGameOverText(ctx);
      this.drawRestartButton(ctx);
    }
  }

  drawGameOverBackground(ctx) {
    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 绘制半透明黑色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // 绘制像素风格的背景网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // 垂直网格线 - 像素化处理
    for (let x = 0; x < SCREEN_WIDTH; x += 32) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(x), 0);
      ctx.lineTo(Math.floor(x), SCREEN_HEIGHT);
      ctx.stroke();
    }
    
    // 水平网格线 - 像素化处理
    for (let y = 0; y < SCREEN_HEIGHT; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(y));
      ctx.lineTo(SCREEN_WIDTH, Math.floor(y));
      ctx.stroke();
    }
    
    // 绘制像素风格的中心十字
    const centerX = Math.floor(SCREEN_WIDTH / 2);
    const centerY = Math.floor(SCREEN_HEIGHT / 2);
    const crossSize = 100;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();
    
    ctx.restore();
  }

  drawGameOverText(ctx) {
    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    // 绘制"游戏结束"标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 10;
    
    ctx.fillText(
      '游戏结束',
      Math.floor(SCREEN_WIDTH / 2),
      Math.floor(SCREEN_HEIGHT / 2 - 80)
    );
    
    // 绘制得分
    ctx.font = '18px monospace';
    ctx.shadowBlur = 5;
    ctx.fillText(
      `得分: ${GameGlobal.databus.score}`,
      Math.floor(SCREEN_WIDTH / 2),
      Math.floor(SCREEN_HEIGHT / 2 - 30)
    );
    
    // 绘制像素风格装饰元素
    this.drawPixelDecorations(ctx);
    
    ctx.restore();
  }

  drawPixelDecorations(ctx) {
    const centerX = Math.floor(SCREEN_WIDTH / 2);
    const centerY = Math.floor(SCREEN_HEIGHT / 2);
    
    // 绘制像素风格装饰
    ctx.save();
    
    // 外圈像素方块
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(centerX - 60, centerY - 60, 4, 4);
    ctx.fillRect(centerX + 56, centerY - 60, 4, 4);
    ctx.fillRect(centerX - 60, centerY + 56, 4, 4);
    ctx.fillRect(centerX + 56, centerY + 56, 4, 4);
    
    // 内圈像素点
    ctx.fillStyle = 'rgba(255, 102, 0, 0.5)';
    ctx.fillRect(centerX - 20, centerY - 20, 2, 2);
    ctx.fillRect(centerX + 18, centerY - 20, 2, 2);
    ctx.fillRect(centerX - 20, centerY + 18, 2, 2);
    ctx.fillRect(centerX + 18, centerY + 18, 2, 2);
    
    // 中心像素点
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
    
    ctx.restore();
  }

  drawRestartButton(ctx) {
    ctx.save();
    
    // 像素化效果
    ctx.imageSmoothingEnabled = false;
    
    const btnX = Math.floor(SCREEN_WIDTH / 2 - 60);
    const btnY = Math.floor(SCREEN_HEIGHT / 2 + 50);
    const btnWidth = 120;
    const btnHeight = 40;
    
    // 绘制按钮背景
    ctx.fillStyle = 'rgba(255, 102, 0, 0.8)';
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    
    // 绘制按钮边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    
    // 绘制像素风格内部装饰
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    
    // 绘制内部像素点
    const btnCenterX = Math.floor(btnX + btnWidth / 2);
    const btnCenterY = Math.floor(btnY + btnHeight / 2);
    
    ctx.fillRect(btnCenterX - 8, btnCenterY - 1, 2, 2);
    ctx.fillRect(btnCenterX + 6, btnCenterY - 1, 2, 2);
    ctx.fillRect(btnCenterX - 1, btnCenterY - 8, 2, 2);
    ctx.fillRect(btnCenterX - 1, btnCenterY + 6, 2, 2);
    
    // 绘制按钮文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 2;
    
    ctx.fillText(
      '重新开始',
      btnCenterX,
      btnCenterY + 5
    );
    
    ctx.restore();
  }

  touchEventHandler(event) {
    const { clientX, clientY } = event.touches[0]; // 获取触摸点的坐标

    // 当前只有游戏结束时展示了UI，所以只处理游戏结束时的状态
    if (GameGlobal.databus.isGameOver) {
      // 检查触摸是否在按钮区域内
      if (
        clientX >= this.btnArea.startX &&
        clientX <= this.btnArea.endX &&
        clientY >= this.btnArea.startY &&
        clientY <= this.btnArea.endY
      ) {
        // 调用重启游戏的回调函数
        this.emit('restart');
      }
    }
  }
}
