import './render'; // 初始化Canvas
import Player from './player/index'; // 导入玩家类
import Enemy from './npc/enemy'; // 导入敌机类
import BackGround from './runtime/background'; // 导入背景类
import GameInfo from './runtime/gameinfo'; // 导入游戏UI类
import Music from './runtime/music'; // 导入音乐类
import DataBus from './databus'; // 导入数据类，用于管理游戏状态和数据
import { getPerformanceConfig } from './config/performance'; // 导入性能配置
import { validateGameObject, cleanArray, PerformanceMonitor } from './utils/errorHandler'; // 导入错误处理工具
import deviceAdapter from './utils/deviceAdapter'; // 导入设备适配器
import explosionEffects from './utils/explosionEffects'; // 导入爆炸效果系统
import WebGLRenderer from './utils/webglRenderer'; // 导入 WebGL 渲染器

const ENEMY_GENERATE_INTERVAL = 30;
const performanceConfig = getPerformanceConfig();
const TARGET_FPS = performanceConfig.TARGET_FPS;
const FRAME_TIME = 1000 / TARGET_FPS; // 每帧时间间隔

// 初始化 WebGL 渲染器代替 2D ctx
GameGlobal.renderer = new WebGLRenderer(canvas);
const ctx = canvas.getContext('2d'); // 保留 2D ctx 用于 UI 渲染 (或者后续全部切 WebGL)

GameGlobal.databus = new DataBus(); // 全局数据管理，用于管理游戏状态和数据
GameGlobal.musicManager = new Music(); // 全局音乐管理实例
GameGlobal.deviceAdapter = deviceAdapter; // 全局设备适配器实例
GameGlobal.explosionEffects = explosionEffects; // 全局爆炸效果实例

/**
 * 空间分区系统 - 用于优化碰撞检测
 */
class SpatialPartition {
  constructor(gridSize = 100) {
    this.gridSize = gridSize;
    this.grid = new Map();
  }
  
  /**
   * 获取对象所在的网格坐标
   */
  getGridKey(x, y) {
    const gridX = Math.floor(x / this.gridSize);
    const gridY = Math.floor(y / this.gridSize);
    return `${gridX},${gridY}`;
  }
  
  /**
   * 添加对象到空间分区
   */
  addObject(obj, x, y) {
    const key = this.getGridKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(obj);
  }
  
  /**
   * 获取指定位置周围的对象
   */
  getNearbyObjects(x, y, radius = 50) {
    const nearby = [];
    const centerKey = this.getGridKey(x, y);
    const [centerX, centerY] = centerKey.split(',').map(Number);
    
    // 检查周围9个网格
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${centerX + dx},${centerY + dy}`;
        if (this.grid.has(key)) {
          nearby.push(...this.grid.get(key));
        }
      }
    }
    
    return nearby;
  }
  
  /**
   * 清空分区
   */
  clear() {
    this.grid.clear();
  }
}

/**
 * 游戏主函数
 */
export default class Main {
  aniId = 0; // 用于存储动画帧的ID
  bg = new BackGround(); // 创建背景
  player = new Player(); // 创建玩家
  gameInfo = new GameInfo(); // 创建游戏UI显示
  
  // 性能优化相关
  lastFrameTime = 0; // 上一帧时间
  frameCount = 0; // 帧数计数
  fps = 0; // 当前FPS
  lastFpsUpdate = 0; // 上次FPS更新时间
  performanceMonitor = new PerformanceMonitor(); // 性能监控器
  
  // 空间分区系统
  spatialPartition = new SpatialPartition();
  
  // 智能渲染频率控制
  renderFrameCount = 0;
  currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.NORMAL;
  
  // 帧率平滑
  fpsHistory = [];
  smoothedFps = 0;

  constructor() {
    GameGlobal.main = this; // 暴露全局引用以便视觉特效系统访问背景
    // 当开始游戏被点击时，重新开始游戏
    this.gameInfo.on('restart', this.start.bind(this));

    // 测试设备适配系统
    GameGlobal.deviceAdapter.testAdaptation();
    
    // 测试爆炸效果系统
    GameGlobal.explosionEffects.test();

    // 开始游戏
    this.start();
  }

  /**
   * 开始或重启游戏
   */
  start() {
    GameGlobal.databus.reset(); // 重置数据
    GameGlobal.databus.player = this.player; // 保存玩家引用
    this.player.init(); // 重置玩家状态
    cancelAnimationFrame(this.aniId); // 清除上一局的动画
    
    // 清理爆炸效果
    GameGlobal.explosionEffects.clear();
    
    // 重置性能监控
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = 0;
    this.renderFrameCount = 0;
    this.fpsHistory = [];
    this.smoothedFps = 0;
    
    // 清空空间分区
    this.spatialPartition.clear();
    
    this.aniId = requestAnimationFrame(this.loop.bind(this)); // 开始新的动画循环
  }

  /**
   * 随着帧数变化的敌机生成逻辑
   * 帧数取模定义成生成的频率
   */
  enemyGenerate() {
    // 根据屏幕上的敌机数量动态调整生成频率
    const enemyCount = GameGlobal.databus.enemys.length;
    let generateInterval = ENEMY_GENERATE_INTERVAL;
    
    // 当敌机数量较多时，减缓生成频率
    if (enemyCount >= 8) {
      generateInterval = ENEMY_GENERATE_INTERVAL * 2; // 双倍间隔
    } else if (enemyCount >= 5) {
      generateInterval = ENEMY_GENERATE_INTERVAL * 1.5; // 1.5倍间隔
    }
    
    // 每30帧生成一个敌机（或根据敌机数量调整）
    if (GameGlobal.databus.frame % Math.floor(generateInterval) === 0) {
      const enemy = GameGlobal.databus.pool.getItemByClass('enemy', Enemy); // 从对象池获取敌机实例
      enemy.init(); // 初始化敌机
      GameGlobal.databus.enemys.push(enemy); // 将敌机添加到敌机数组中
    }
  }

  /**
   * 碰撞检测 - 使用空间分区优化
   */
  collisionDetection() {
    const bullets = GameGlobal.databus.bullets;
    const enemyBullets = GameGlobal.databus.enemyBullets;
    const enemys = GameGlobal.databus.enemys;
    const powerUps = GameGlobal.databus.powerUps;
    const superWeapons = GameGlobal.databus.superWeapons;

    // 更新空间分区
    this.spatialPartition.clear();
    
    // 将敌机添加到空间分区
    enemys.forEach(enemy => {
      if (enemy && enemy.isActive) {
        this.spatialPartition.addObject(enemy, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
      }
    });

    // 检测子弹与敌机的碰撞 - 优化版本
    if (bullets.length > 0 && enemys.length > 0) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet || !bullet.isActive) continue;
        
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        
        // 使用空间分区获取附近的敌机
        const nearbyEnemies = this.spatialPartition.getNearbyObjects(bulletCenterX, bulletCenterY, 50);
        
        // 快速边界检查
        let hitEnemy = null;
        for (let j = nearbyEnemies.length - 1; j >= 0; j--) {
          const enemy = nearbyEnemies[j];
          if (!enemy || !enemy.isActive) continue;
          
          // 快速距离平方检查 (避免 Math.sqrt)
          const enemyCenterX = enemy.x + enemy.width / 2;
          const enemyCenterY = enemy.y + enemy.height / 2;
          const dx = bulletCenterX - enemyCenterX;
          const dy = bulletCenterY - enemyCenterY;
          const distSq = dx * dx + dy * dy;
          
          // 如果距离平方大于阈值平方 (50^2 = 2500)，跳过详细碰撞检测
          if (distSq > 2500) continue;
          
          if (enemy.isCollideWith(bullet)) {
            hitEnemy = enemy;
            break;
          }
        }
        
        if (hitEnemy) {
          hitEnemy.takeDamage(); // 使用新的伤害系统
          bullet.destroy(); // 销毁子弹
          // 如果敌机被击毁，增加积分和回血
          if (!hitEnemy.isActive) {
            // 创建敌机爆炸效果 - 使用敌机本身的颜色
            GameGlobal.explosionEffects.createExplosion(
              hitEnemy.x + hitEnemy.width / 2,
              hitEnemy.y + hitEnemy.height / 2,
              hitEnemy.type.color[0], // 使用敌机本身的颜色
              40
            );
            GameGlobal.databus.score += 10; // 每击落一架敌机+10分
            this.player.heal(1); // 击落敌机回血1%
          }
        }
      }
    }

    // 检测敌机子弹与玩家的碰撞
    if (enemyBullets.length > 0) {
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const enemyBullet = enemyBullets[i];
        if (!enemyBullet || !enemyBullet.isActive) continue;
        
        if (this.player.isCollideWith(enemyBullet)) {
          // 创建命中效果
          GameGlobal.explosionEffects.createHitEffect(
            enemyBullet.x + enemyBullet.width / 2,
            enemyBullet.y + enemyBullet.height / 2,
            '#ff0000'
          );
          
          this.player.takeDamage(20); // 被敌机子弹击中掉血20%
          enemyBullet.destroy(); // 销毁敌机子弹
          // 只有在血量为0时才游戏结束
          if (this.player.health <= 0) {
            GameGlobal.databus.gameOver(); // 游戏结束
          }
        }
      }
    }

    // 检测玩家与敌机的碰撞
    if (enemys.length > 0) {
      for (let i = enemys.length - 1; i >= 0; i--) {
        const enemy = enemys[i];
        if (!enemy || !enemy.isActive) continue;

        // 如果玩家与敌机发生碰撞
        if (this.player.isCollideWith(enemy)) {
          // 创建碰撞爆炸效果 - 使用敌机本身的颜色
          GameGlobal.explosionEffects.createExplosion(
            enemy.x + enemy.width / 2,
            enemy.y + enemy.height / 2,
            enemy.type.color[0], // 使用敌机本身的颜色
            50
          );
          
          enemy.takeDamage(); // 敌机受到伤害
          this.player.takeDamage(50); // 玩家受到50%伤害
          
          // 只有在血量为0时才游戏结束
          if (this.player.health <= 0) {
            GameGlobal.databus.gameOver(); // 游戏结束
          }
        }
      }
    }

    // 检测玩家与道具的碰撞
    if (powerUps.length > 0) {
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (!powerUp || !powerUp.isActive) continue;

        if (this.player.isCollideWith(powerUp)) {
          powerUp.applyEffect(this.player); // 应用道具效果
          powerUp.destroy(); // 销毁道具
        }
      }
    }

    // 检测玩家与超级武器的碰撞
    if (superWeapons.length > 0) {
      for (let i = superWeapons.length - 1; i >= 0; i--) {
        const superWeapon = superWeapons[i];
        if (!superWeapon || !superWeapon.isActive) continue;

        if (this.player.isCollideWith(superWeapon)) {
          superWeapon.activate(this.player); // 激活超级武器
          superWeapon.destroy(); // 销毁超级武器
        }
      }
    }
  }

  /**
   * 批量更新所有游戏对象
   */
  batchUpdate() {
    // 批量更新子弹
    const bullets = GameGlobal.databus.bullets;
    if (bullets.length > 0) {
      for (let i = 0; i < bullets.length; i++) {
        const item = bullets[i];
        if (item && item.isActive) {
          item.update();
        }
      }
    }
    
    // 批量更新敌机子弹
    const enemyBullets = GameGlobal.databus.enemyBullets;
    if (enemyBullets.length > 0) {
      for (let i = 0; i < enemyBullets.length; i++) {
        const item = enemyBullets[i];
        if (item && item.isActive) {
          item.update();
        }
      }
    }
    
    // 批量更新敌机
    const enemys = GameGlobal.databus.enemys;
    if (enemys.length > 0) {
      for (let i = 0; i < enemys.length; i++) {
        const item = enemys[i];
        if (item && item.isActive) {
          item.update();
        }
      }
    }
    
    // 批量更新道具
    const powerUps = GameGlobal.databus.powerUps;
    if (powerUps.length > 0) {
      for (let i = 0; i < powerUps.length; i++) {
        const item = powerUps[i];
        if (item && item.isActive) {
          item.update();
        }
      }
    }
    
    // 批量更新超级武器
    const superWeapons = GameGlobal.databus.superWeapons;
    if (superWeapons.length > 0) {
      for (let i = 0; i < superWeapons.length; i++) {
        const item = superWeapons[i];
        if (item && item.isActive) {
          item.update();
        }
      }
    }
  }

  /**
   * 清理无效对象
   */
  cleanupObjects() {
    try {
      // 使用错误处理工具清理数组
      GameGlobal.databus.bullets = cleanArray(GameGlobal.databus.bullets, 'bullets');
      GameGlobal.databus.enemyBullets = cleanArray(GameGlobal.databus.enemyBullets, 'enemyBullets');
      GameGlobal.databus.enemys = cleanArray(GameGlobal.databus.enemys, 'enemys');
      GameGlobal.databus.powerUps = cleanArray(GameGlobal.databus.powerUps, 'powerUps');
      GameGlobal.databus.superWeapons = cleanArray(GameGlobal.databus.superWeapons, 'superWeapons');
      
      // 清理无效的动画
      GameGlobal.databus.animations = GameGlobal.databus.animations.filter(ani => {
        return validateGameObject(ani, 'animation') && ani.isPlaying;
      });
      
      // 每60帧进行一次强制清理
      if (GameGlobal.databus.frame % 60 === 0) {
        this.forceCleanup();
      }
    } catch (error) {
      this.performanceMonitor.logError(error, 'cleanupObjects');
    }
  }

  /**
   * 强制清理所有对象
   */
  forceCleanup() {
    try {
      // 强制清理对象池
      GameGlobal.databus.pool.forceCleanup();
      
      // 强制清理爆炸效果
      GameGlobal.explosionEffects.forceCleanup();
      
      // 清理过多的动画
      if (GameGlobal.databus.animations.length > 20) {
        GameGlobal.databus.animations = GameGlobal.databus.animations.slice(-10);
      }
      
      // 清理过多的粒子
      if (this.player.trailParticles.length > 5) {
        this.player.trailParticles.length = 5;
      }
      
      // 清理敌机粒子
      GameGlobal.databus.enemys.forEach(enemy => {
        if (enemy && enemy.trailParticles && enemy.trailParticles.length > 3) {
          enemy.trailParticles.length = 3;
        }
      });
      
      // 清理子弹粒子
      GameGlobal.databus.bullets.forEach(bullet => {
        if (bullet && bullet.trailParticles && bullet.trailParticles.length > 2) {
          bullet.trailParticles.length = 2;
        }
      });
      
      // 清理敌机子弹粒子
      GameGlobal.databus.enemyBullets.forEach(bullet => {
        if (bullet && bullet.trailParticles && bullet.trailParticles.length > 2) {
          bullet.trailParticles.length = 2;
        }
      });
    } catch (error) {
      this.performanceMonitor.logError(error, 'forceCleanup');
    }
  }

  /**
   * 优化渲染性能 - 添加智能渲染频率控制
   */
  render() {
    // WebGL 渲染起始
    GameGlobal.renderer.clear();

    this.bg.render(null); // 绘制背景
    this.player.render(null); // 绘制玩家飞机
    
    // 批量渲染所有游戏对象 - 只渲染可见和活跃的对象
    const bullets = GameGlobal.databus.bullets;
    const enemyBullets = GameGlobal.databus.enemyBullets;
    const enemys = GameGlobal.databus.enemys;
    const powerUps = GameGlobal.databus.powerUps;
    const superWeapons = GameGlobal.databus.superWeapons;
    
    // 批量渲染子弹 - 减少状态切换
    if (bullets.length > 0) {
      for (let i = 0; i < bullets.length; i++) {
        const item = bullets[i];
        if (item && item.isActive && item.visible) {
          item.render(null);
        }
      }
    }
    
    // 批量渲染敌机子弹
    if (enemyBullets.length > 0) {
      for (let i = 0; i < enemyBullets.length; i++) {
        const item = enemyBullets[i];
        if (item && item.isActive && item.visible) {
          item.render(null);
        }
      }
    }
    
    // 批量渲染敌机
    if (enemys.length > 0) {
      for (let i = 0; i < enemys.length; i++) {
        const item = enemys[i];
        if (item && item.isActive && item.visible) {
          item.render(null);
        }
      }
    }
    
    // 批量渲染宝物
    if (powerUps.length > 0) {
      for (let i = 0; i < powerUps.length; i++) {
        const item = powerUps[i];
        if (item && item.isActive && item.visible) {
          item.render(null);
        }
      }
    }
    
    // 批量渲染超级武器
    if (superWeapons.length > 0) {
      for (let i = 0; i < superWeapons.length; i++) {
        const item = superWeapons[i];
        if (item && item.isActive && item.visible) {
          item.render(null);
        }
      }
    }
    
    this.gameInfo.render(null); // 绘制游戏UI
    
    // 只渲染正在播放的动画
    const animations = GameGlobal.databus.animations;
    if (animations.length > 0) {
      for (let i = 0; i < animations.length; i++) {
        const ani = animations[i];
        if (ani && ani.isPlaying && ani.visible) {
          ani.aniRender(null);
        }
      }
    }
    
    // 渲染爆炸效果
    GameGlobal.explosionEffects.render(null);

    // WebGL 渲染提交
    GameGlobal.renderer.flush();

    // UI 渲染 (GameInfo 等可能仍需 2D 绘制在顶层，或者后续全切)
  }

  // 游戏逻辑更新主函数
  update() {
    GameGlobal.databus.frame++; // 增加帧数

    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.bg.update(); // 更新背景
    this.player.update(); // 更新玩家
    
    // 批量更新所有游戏对象
    this.batchUpdate();

    this.enemyGenerate(); // 生成敌机
    this.collisionDetection(); // 检测碰撞
    
    // 检查超级武器生成
    GameGlobal.databus.checkSuperWeaponSpawn();
    
    // 更新爆炸效果
    GameGlobal.explosionEffects.update();
    
    // 清理无效对象
    this.cleanupObjects();
  }

  // 实现游戏帧循环
  loop(currentTime) {
    // 检测是否为移动设备
    let isMobile = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
      } catch (e) {
        isMobile = true;
      }
    } else if (typeof navigator !== 'undefined') {
      isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } else {
      isMobile = true;
    }
    
    // 移动设备上更宽松的帧率控制
    const frameTime = isMobile ? FRAME_TIME * 0.8 : FRAME_TIME;
    
    // 帧率控制
    if (currentTime - this.lastFrameTime < frameTime) {
      this.aniId = requestAnimationFrame(this.loop.bind(this));
      return;
    }
    
    // 更新FPS计算
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      
      // 帧率平滑
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 5) {
        this.fpsHistory.shift();
      }
      this.smoothedFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      
      // 计算全局发光等级 (0-1)
      if (this.smoothedFps >= 55) this.glowLevel = 1.0;
      else if (this.smoothedFps >= 45) this.glowLevel = 0.6;
      else if (this.smoothedFps >= 30) this.glowLevel = 0.3;
      else this.glowLevel = 0;

      // 自适应性能优化
      this.adaptiveOptimization();
    }
    
    this.lastFrameTime = currentTime;
    
    this.update(); // 更新游戏逻辑
    this.render(); // 渲染游戏画面

    // 请求下一帧动画
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * 自适应性能优化
   */
  adaptiveOptimization() {
    const stats = GameGlobal.databus.getPerformanceStats();
    const totalObjects = stats.bullets + stats.enemyBullets + stats.enemys + 
                        stats.powerUps + stats.superWeapons;
    
    // 检测是否为移动设备
    let isMobile = false;
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
      } catch (e) {
        isMobile = true;
      }
    } else if (typeof navigator !== 'undefined') {
      isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    } else {
      isMobile = true;
    }
    
    // 使用配置的阈值
    if (this.smoothedFps < performanceConfig.LOW_FPS_THRESHOLD || 
        totalObjects > performanceConfig.MAX_OBJECTS_THRESHOLD) {
      // 减少粒子效果
      this.reduceParticleEffects();
      
      // 清理更多无效对象
      this.cleanupObjects();
      
      // 移动设备上更保守的渲染频率调整
      if (isMobile) {
        // 移动设备只在FPS极低时才降低渲染频率
        if (this.smoothedFps < performanceConfig.CRITICAL_FPS_THRESHOLD) {
          this.currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.REDUCED;
        } else {
          this.currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.NORMAL;
        }
      } else {
        // 桌面设备使用原有的调整逻辑
        if (this.smoothedFps < performanceConfig.CRITICAL_FPS_THRESHOLD) {
          this.currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.MINIMAL;
        } else if (this.smoothedFps < performanceConfig.LOW_FPS_THRESHOLD) {
          this.currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.REDUCED;
        }
      }
      
      // 如果FPS仍然很低，进一步优化
      if (this.smoothedFps < performanceConfig.CRITICAL_FPS_THRESHOLD) {
        this.aggressiveOptimization();
      }
    } else {
      // FPS正常，恢复渲染频率
      this.currentRenderFrequency = performanceConfig.RENDER_FREQUENCY.NORMAL;
    }
    
    // 检查内存使用情况
    if (totalObjects > 100 || stats.poolStats.total > 200) {
      this.forceCleanup();
    }
  }

  /**
   * 减少粒子效果
   */
  reduceParticleEffects() {
    // 减少玩家粒子
    if (this.player.trailParticles.length > performanceConfig.MAX_PLAYER_PARTICLES / 2) {
      this.player.trailParticles.length = Math.floor(performanceConfig.MAX_PLAYER_PARTICLES / 2);
    }
    
    // 减少敌机粒子
    GameGlobal.databus.enemys.forEach(enemy => {
      if (enemy && enemy.trailParticles && enemy.trailParticles.length > performanceConfig.MAX_ENEMY_PARTICLES / 2) {
        enemy.trailParticles.length = Math.floor(performanceConfig.MAX_ENEMY_PARTICLES / 2);
      }
    });
    
    // 减少子弹粒子
    GameGlobal.databus.bullets.forEach(bullet => {
      if (bullet && bullet.trailParticles && bullet.trailParticles.length > performanceConfig.MAX_BULLET_PARTICLES / 2) {
        bullet.trailParticles.length = Math.floor(performanceConfig.MAX_BULLET_PARTICLES / 2);
      }
    });
    
    // 减少敌机子弹粒子
    GameGlobal.databus.enemyBullets.forEach(bullet => {
      if (bullet && bullet.trailParticles && bullet.trailParticles.length > performanceConfig.MAX_ENEMY_BULLET_PARTICLES / 2) {
        bullet.trailParticles.length = Math.floor(performanceConfig.MAX_ENEMY_BULLET_PARTICLES / 2);
      }
    });
  }

  /**
   * 激进优化
   */
  aggressiveOptimization() {
    // 禁用所有粒子效果
    this.player.trailParticles.length = 0;
    
    GameGlobal.databus.enemys.forEach(enemy => {
      if (enemy && enemy.trailParticles) {
        enemy.trailParticles.length = 0;
      }
    });
    
    GameGlobal.databus.bullets.forEach(bullet => {
      if (bullet && bullet.trailParticles) {
        bullet.trailParticles.length = 0;
      }
    });
    
    GameGlobal.databus.enemyBullets.forEach(bullet => {
      if (bullet && bullet.trailParticles) {
        bullet.trailParticles.length = 0;
      }
    });
    
    // 减少敌机生成频率
    if (GameGlobal.databus.enemys.length > 5) {
      // 移除一些敌机
      const removeCount = Math.floor(GameGlobal.databus.enemys.length * 0.3);
      for (let i = 0; i < removeCount; i++) {
        if (GameGlobal.databus.enemys.length > 0) {
          const enemy = GameGlobal.databus.enemys.pop();
          if (enemy) {
            enemy.destroy();
          }
        }
      }
    }
  }
}
