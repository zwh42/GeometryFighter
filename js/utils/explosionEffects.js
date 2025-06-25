/**
 * Geometry Wars风格的爆炸效果系统 - 战机线段断开飞散版本
 */
class ExplosionEffects {
  constructor() {
    this.explosions = [];
  }

  /**
   * 创建爆炸效果
   * @param {number} x - 爆炸中心X坐标
   * @param {number} y - 爆炸中心Y坐标
   * @param {string} color - 爆炸颜色
   * @param {number} size - 爆炸大小
   */
  createExplosion(x, y, color = '#ff6600', size = 30) {
    const explosion = {
      x: Math.floor(x),
      y: Math.floor(y),
      color: color,
      size: size,
      life: 1.0,
      decay: 0.03, // 稍微减慢衰减速度
      lineSegments: this.createLineSegments(x, y, color, size),
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
    const segmentCount = Math.floor(size / 2); // 增加线段数量
    
    for (let i = 0; i < segmentCount; i++) {
      // 随机角度和距离
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * size * 0.8 + size * 0.4; // 增加飞散距离
      
      // 线段长度随机（增加长度）
      const segmentLength = Math.random() * 12 + 6;
      
      // 线段角度随机
      const segmentAngle = Math.random() * Math.PI * 2;
      
      // 飞散速度（增加速度）
      const speed = Math.random() * 6 + 3;
      
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
        thickness: Math.random() * 3 + 2 // 增加线段粗细
      });
    }
    
    return segments;
  }

  /**
   * 更新所有爆炸效果
   */
  update() {
    try {
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
    console.log('=== 爆炸效果系统测试 ===');
    console.log('当前爆炸效果数量:', this.explosions.length);
    
    // 测试创建爆炸效果
    this.createExplosion(100, 100, '#ff6600', 30);
    console.log('创建爆炸效果后数量:', this.explosions.length);
    
    // 测试创建命中效果
    this.createHitEffect(200, 200, '#ffff00');
    console.log('创建命中效果后数量:', this.explosions.length);
    
    // 测试更新
    this.update();
    console.log('更新后数量:', this.explosions.length);
    
    // 清理
    this.clear();
    console.log('清理后数量:', this.explosions.length);
    console.log('=== 测试完成 ===');
  }
}

// 创建全局爆炸效果实例
const explosionEffects = new ExplosionEffects();

export default explosionEffects; 