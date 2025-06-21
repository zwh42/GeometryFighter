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

  renderGameScore(ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${GameGlobal.databus.score}`, 20, SCREEN_HEIGHT - 20);
    
    // 显示最高分
    ctx.font = '16px Arial';
    ctx.fillText(`Highest: ${GameGlobal.databus.highestScore || 0}`, 20, SCREEN_HEIGHT - 40);
  }

  renderGameOver(ctx) {
    this.drawGameOverBackground(ctx);
    this.drawGameOverText(ctx);
    this.drawRestartButton(ctx);
  }

  drawGameOverBackground(ctx) {
    ctx.save();
    
    // 绘制半透明黑色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // 绘制几何战争风格的背景网格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let x = 0; x < SCREEN_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SCREEN_HEIGHT);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let y = 0; y < SCREEN_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SCREEN_WIDTH, y);
      ctx.stroke();
    }
    
    // 绘制中心十字
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
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
    
    // 绘制"游戏结束"标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 20;
    
    ctx.fillText(
      '游戏结束',
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT / 2 - 80
    );
    
    // 绘制得分
    ctx.font = '24px Arial';
    ctx.shadowBlur = 10;
    ctx.fillText(
      `得分: ${GameGlobal.databus.score}`,
      SCREEN_WIDTH / 2,
      SCREEN_HEIGHT / 2 - 30
    );
    
    // 绘制几何装饰元素
    this.drawGeometricDecorations(ctx);
    
    ctx.restore();
  }

  drawGeometricDecorations(ctx) {
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    
    // 绘制装饰性几何图形
    ctx.save();
    
    // 外圈菱形
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 120);
    ctx.lineTo(centerX + 80, centerY - 40);
    ctx.lineTo(centerX, centerY + 40);
    ctx.lineTo(centerX - 80, centerY - 40);
    ctx.closePath();
    ctx.stroke();
    
    // 内圈三角形
    ctx.strokeStyle = 'rgba(255, 102, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 60);
    ctx.lineTo(centerX + 40, centerY + 20);
    ctx.lineTo(centerX - 40, centerY + 20);
    ctx.closePath();
    ctx.stroke();
    
    // 中心点
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  drawRestartButton(ctx) {
    ctx.save();
    
    const btnX = SCREEN_WIDTH / 2 - 60;
    const btnY = SCREEN_HEIGHT / 2 + 50;
    const btnWidth = 120;
    const btnHeight = 40;
    
    // 绘制按钮背景
    ctx.fillStyle = 'rgba(255, 102, 0, 0.8)';
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    
    // 绘制按钮边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    
    // 绘制按钮内部几何装饰
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    
    // 绘制内部十字
    const btnCenterX = btnX + btnWidth / 2;
    const btnCenterY = btnY + btnHeight / 2;
    
    ctx.beginPath();
    ctx.moveTo(btnCenterX - 15, btnCenterY);
    ctx.lineTo(btnCenterX + 15, btnCenterY);
    ctx.moveTo(btnCenterX, btnCenterY - 10);
    ctx.lineTo(btnCenterX, btnCenterY + 10);
    ctx.stroke();
    
    // 绘制按钮文字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;
    
    ctx.fillText(
      '重新开始',
      btnCenterX,
      btnCenterY + 6
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
