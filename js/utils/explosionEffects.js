/**
 * Geometry Wars风格的爆炸效果系统 - 战机线段断开飞散版本
 */
class ExplosionEffects {
  constructor() {
    this.explosions = [];
    this.maxExplosions = 10; // 限制最大爆炸效果数量
    this.cleanupCounter = 0; // 清理计数器
  }

  /**
   * 创建爆炸效果
   * @param {number} x - 爆炸中心X坐标
   * @param {number} y - 爆炸中心Y坐标
   * @param {string} color - 爆炸颜色
   * @param {number} size - 爆炸大小
   * @param {boolean} isFullScreen - 是否为全屏爆炸模式
   */
  createExplosion(x, y, color = '#ff6600', size = 30, isFullScreen = false) {
    // 检测是否为移动设备
    let isMobile = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
      } catch (e) {
        isMobile = true;
      }
    }
    
    // 移动设备减少最大爆炸数量
    const maxExplosions = isMobile ? 5 : this.maxExplosions;
    
    // 如果爆炸效果太多，移除最旧的
    if (this.explosions.length >= maxExplosions) {
      this.explosions.shift(); // 移除最旧的爆炸效果
    }
    
    // 如果是全屏爆炸模式，爆炸范围增大100%
    const explosionSize = isFullScreen ? size * 2 : size;
    
    const explosion = {
      x: Math.floor(x),
      y: Math.floor(y),
      color: color,
      size: explosionSize,
      life: 1.0,
      decay: 0.03, // 稍微减慢衰减速度
      lineSegments: this.createLineSegments(x, y, color, explosionSize),
      isActive: true
    };
    
    this.explosions.push(explosion);
  }

  /**
   * 创建战机线段碎片
   * 模拟战机被击毁时线段断开并向四周飞散的效果
   */
  createLineSegments(x, y, color, size) {
    const segments = [];
    
    // 检测是否为移动设备
    let isMobile = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
      } catch (e) {
        isMobile = true;
      }
    }
    
    // 移动设备减少线段数量
    const segmentCount = isMobile ? Math.floor(size / 4) : Math.floor(size / 2);
    
    for (let i = 0; i < segmentCount; i++) {
      // 随机角度和距离
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * size * 0.8 + size * 0.4; // 增加飞散距离
      
      // 线段长度随机（移动设备减少长度）
      const segmentLength = isMobile ? (Math.random() * 8 + 4) : (Math.random() * 12 + 6);
      
      // 线段角度随机
      const segmentAngle = Math.random() * Math.PI * 2;
      
      // 飞散速度（移动设备减少速度）
      const speed = isMobile ? (Math.random() * 4 + 2) : (Math.random() * 6 + 3);
      
      segments.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: segmentLength,
        angle: segmentAngle,
        life: 1.0,
        decay: Math.random() * 0.015 + 0.008, // 减慢衰减速度
        color: color,
        thickness: isMobile ? (Math.random() * 2 + 1) : (Math.random() * 3 + 2) // 移动设备减少线段粗细
      });
    }
    
    return segments;
  }

  /**
   * 更新所有爆炸效果
   */
  update() {
    try {
      this.cleanupCounter++;
      
      // 每10帧进行一次强制清理
      if (this.cleanupCounter >= 10) {
        this.forceCleanup();
        this.cleanupCounter = 0;
      }
      
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const explosion = this.explosions[i];
        
        // 检查爆炸对象是否有效
        if (!explosion || !explosion.isActive) {
          this.explosions.splice(i, 1);
          continue;
        }
        
        // 更新爆炸生命周期
        explosion.life -= explosion.decay;
        
        // 更新线段碎片（如果存在）
        if (explosion.lineSegments && Array.isArray(explosion.lineSegments)) {
          for (let j = explosion.lineSegments.length - 1; j >= 0; j--) {
            const segment = explosion.lineSegments[j];
            
            if (segment) {
              // 更新位置
              segment.x += segment.vx;
              segment.y += segment.vy;
              
              // 添加重力效果
              segment.vy += 0.1;
              
              // 更新生命周期
              segment.life -= segment.decay;
              
              // 移除死亡的线段
              if (segment.life <= 0) {
                explosion.lineSegments.splice(j, 1);
              }
            }
          }
        }
        
        // 移除死亡的爆炸
        if (explosion.life <= 0 || 
            (explosion.lineSegments && explosion.lineSegments.length === 0)) {
          explosion.isActive = false;
          this.explosions.splice(i, 1);
        }
      }
    } catch (error) {
      console.error('ExplosionEffects update error:', error);
      // 清理所有爆炸效果以防止进一步错误
      this.explosions = [];
    }
  }

  /**
   * 强制清理所有爆炸效果
   */
  forceCleanup() {
    // 移除所有生命周期小于0.1的爆炸效果
    this.explosions = this.explosions.filter(explosion => {
      if (!explosion || !explosion.isActive || explosion.life < 0.1) {
        return false;
      }
      
      // 清理线段碎片
      if (explosion.lineSegments && Array.isArray(explosion.lineSegments)) {
        explosion.lineSegments = explosion.lineSegments.filter(segment => {
          return segment && segment.life > 0;
        });
      }
      
      return true;
    });
  }

  /**
   * 渲染所有爆炸效果
   */
  render(ctx) {
    try {
      ctx.save();
      
      // 像素化效果
      ctx.imageSmoothingEnabled = false;
      
      for (const explosion of this.explosions) {
        this.renderExplosion(ctx, explosion);
      }
      
      ctx.restore();
    } catch (error) {
      console.error('ExplosionEffects render error:', error);
      ctx.restore(); // 确保恢复上下文状态
    }
  }

  /**
   * 渲染单个爆炸效果
   */
  renderExplosion(ctx, explosion) {
    if (!explosion || !explosion.isActive) {
      return;
    }
    
    const alpha = explosion.life;
    
    // 渲染线段碎片（如果存在）
    if (explosion.lineSegments && Array.isArray(explosion.lineSegments)) {
      for (const segment of explosion.lineSegments) {
        if (segment) {
          ctx.save();
          ctx.globalAlpha = segment.life * alpha;
          
          // 线段发光效果
          ctx.shadowColor = segment.color;
          ctx.shadowBlur = 5;
          
          // 绘制线段
          ctx.strokeStyle = segment.color;
          ctx.lineWidth = segment.thickness;
          ctx.lineCap = 'round';
          
          const startX = Math.floor(segment.x - Math.cos(segment.angle) * segment.length / 2);
          const startY = Math.floor(segment.y - Math.sin(segment.angle) * segment.length / 2);
          const endX = Math.floor(segment.x + Math.cos(segment.angle) * segment.length / 2);
          const endY = Math.floor(segment.y + Math.sin(segment.angle) * segment.length / 2);
          
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // 添加线段端点高光
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(startX - 1, startY - 1, 2, 2);
          ctx.fillRect(endX - 1, endY - 1, 2, 2);
          
          ctx.restore();
        }
      }
    }
  }

  /**
   * 创建命中效果
   * @param {number} x - 命中位置X坐标
   * @param {number} y - 命中位置Y坐标
   * @param {string} color - 命中效果颜色
   */
  createHitEffect(x, y, color = '#ffff00') {
    const hit = {
      x: Math.floor(x),
      y: Math.floor(y),
      color: color,
      life: 1.0,
      decay: 0.1,
      size: 8,
      lineSegments: [], // 使用线段数组保持数据结构一致性
      isActive: true
    };
    
    this.explosions.push(hit);
  }

  /**
   * 清理所有爆炸效果
   */
  clear() {
    this.explosions = [];
  }

  /**
   * 测试爆炸效果系统
   */
  test() {
    // 测试完成，无需输出日志
  }
}

// 创建全局爆炸效果实例
const explosionEffects = new ExplosionEffects();

export default explosionEffects; 