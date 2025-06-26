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

const ENEMY_GENERATE_INTERVAL = 30;
const performanceConfig = getPerformanceConfig();
const TARGET_FPS = performanceConfig.TARGET_FPS;
const FRAME_TIME = 1000 / TARGET_FPS; // 每帧时间间隔
const ctx = canvas.getContext('2d'); // 获取canvas的2D绘图上下文;

GameGlobal.databus = new DataBus(); // 全局数据管理，用于管理游戏状态和数据
GameGlobal.musicManager = new Music(); // 全局音乐管理实例
GameGlobal.deviceAdapter = deviceAdapter; // 全局设备适配器实例
GameGlobal.explosionEffects = explosionEffects; // 全局爆炸效果实例

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

  constructor() {
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
   * 碰撞检测
   */
  collisionDetection() {
    const bullets = GameGlobal.databus.bullets;
    const enemyBullets = GameGlobal.databus.enemyBullets;
    const enemys = GameGlobal.databus.enemys;
    const powerUps = GameGlobal.databus.powerUps;
    const superWeapons = GameGlobal.databus.superWeapons;

    // 检测子弹与敌机的碰撞 - 优化版本
    if (bullets.length > 0 && enemys.length > 0) {
      // 使用更高效的碰撞检测
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet || !bullet.isActive) continue;
        
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        
        // 快速边界检查
        let hitEnemy = null;
        for (let j = enemys.length - 1; j >= 0; j--) {
          const enemy = enemys[j];
          if (!enemy || !enemy.isActive) continue;
          
          // 快速距离检查
          const enemyCenterX = enemy.x + enemy.width / 2;
          const enemyCenterY = enemy.y + enemy.height / 2;
          const distance = Math.sqrt(
            Math.pow(bulletCenterX - enemyCenterX, 2) + 
            Math.pow(bulletCenterY - enemyCenterY, 2)
          );
          
          // 如果距离太远，跳过详细碰撞检测
          if (distance > 50) continue;
          
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
          
          this.player.takeDamage(60); // 被敌机撞击掉血60%
          enemy.destroy(); // 销毁敌机
          // 只有在血量为0时才游戏结束
          if (this.player.health <= 0) {
            GameGlobal.databus.gameOver(); // 游戏结束
          }
          break; // 退出循环
        }
      }
    }

    // 检测玩家与宝物的碰撞
    if (powerUps.length > 0) {
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (!powerUp || !powerUp.isActive) continue;
        
        if (this.player.isCollideWith(powerUp)) {
          this.player.enableSpreadMode();
          powerUp.destroy();
        }
      }
    }

    // 检测玩家与超级武器的碰撞
    if (superWeapons.length > 0) {
      for (let i = superWeapons.length - 1; i >= 0; i--) {
        const superWeapon = superWeapons[i];
        if (!superWeapon || !superWeapon.isActive) continue;
        
        if (this.player.isCollideWith(superWeapon)) {
          superWeapon.activate(); // 激活超级武器效果
          superWeapon.destroy();
        }
      }
    }
  }

  /**
   * 批量更新所有游戏对象
   */
  batchUpdate() {
    // 批量更新子弹
    for (let i = GameGlobal.databus.bullets.length - 1; i >= 0; i--) {
      const bullet = GameGlobal.databus.bullets[i];
      if (bullet && bullet.isActive) {
        bullet.update();
      }
    }
    
    // 批量更新敌机子弹
    for (let i = GameGlobal.databus.enemyBullets.length - 1; i >= 0; i--) {
      const enemyBullet = GameGlobal.databus.enemyBullets[i];
      if (enemyBullet && enemyBullet.isActive) {
        enemyBullet.update();
      }
    }
    
    // 批量更新敌机
    for (let i = GameGlobal.databus.enemys.length - 1; i >= 0; i--) {
      const enemy = GameGlobal.databus.enemys[i];
      if (enemy && enemy.isActive) {
        enemy.update();
      }
    }
    
    // 批量更新宝物
    for (let i = GameGlobal.databus.powerUps.length - 1; i >= 0; i--) {
      const powerUp = GameGlobal.databus.powerUps[i];
      if (powerUp && powerUp.isActive) {
        powerUp.update();
      }
    }
    
    // 批量更新超级武器
    for (let i = GameGlobal.databus.superWeapons.length - 1; i >= 0; i--) {
      const superWeapon = GameGlobal.databus.superWeapons[i];
      if (superWeapon && superWeapon.isActive) {
        superWeapon.update();
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
      
      // 输出内存使用情况
      const stats = GameGlobal.databus.getPerformanceStats();
      console.log('Memory cleanup - Objects:', {
        bullets: stats.bullets,
        enemyBullets: stats.enemyBullets,
        enemys: stats.enemys,
        powerUps: stats.powerUps,
        superWeapons: stats.superWeapons,
        animations: stats.animations,
        poolTotal: stats.poolStats.total
      });
    } catch (error) {
      this.performanceMonitor.logError(error, 'forceCleanup');
    }
  }

  /**
   * 优化渲染性能
   */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空画布

    this.bg.render(ctx); // 绘制背景
    this.player.render(ctx); // 绘制玩家飞机
    
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
          item.render(ctx);
        }
      }
    }
    
    // 批量渲染敌机子弹
    if (enemyBullets.length > 0) {
      for (let i = 0; i < enemyBullets.length; i++) {
        const item = enemyBullets[i];
        if (item && item.isActive && item.visible) {
          item.render(ctx);
        }
      }
    }
    
    // 批量渲染敌机
    if (enemys.length > 0) {
      for (let i = 0; i < enemys.length; i++) {
        const item = enemys[i];
        if (item && item.isActive && item.visible) {
          item.render(ctx);
        }
      }
    }
    
    // 批量渲染宝物
    if (powerUps.length > 0) {
      for (let i = 0; i < powerUps.length; i++) {
        const item = powerUps[i];
        if (item && item.isActive && item.visible) {
          item.render(ctx);
        }
      }
    }
    
    // 批量渲染超级武器
    if (superWeapons.length > 0) {
      for (let i = 0; i < superWeapons.length; i++) {
        const item = superWeapons[i];
        if (item && item.isActive && item.visible) {
          item.render(ctx);
        }
      }
    }
    
    this.gameInfo.render(ctx); // 绘制游戏UI
    
    // 只渲染正在播放的动画
    const animations = GameGlobal.databus.animations;
    if (animations.length > 0) {
      for (let i = 0; i < animations.length; i++) {
        const ani = animations[i];
        if (ani && ani.isPlaying && ani.visible) {
          ani.aniRender(ctx);
        }
      }
    }
    
    // 渲染爆炸效果
    GameGlobal.explosionEffects.render(ctx);
    
    // 渲染性能信息（调试用，可以注释掉）
    if (GameGlobal.databus.frame % 60 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(`FPS: ${this.fps}`, 10, 20);
      ctx.fillText(`Objects: ${bullets.length + enemyBullets.length + enemys.length + powerUps.length + superWeapons.length}`, 10, 35);
      
      // 显示性能状态
      if (this.fps < 50) {
        ctx.fillStyle = '#ff0000';
        ctx.fillText('LOW FPS', 10, 50);
      } else if (this.fps < 55) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('MED FPS', 10, 50);
      } else {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('GOOD FPS', 10, 50);
      }
    }
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
    // 帧率控制
    if (currentTime - this.lastFrameTime < FRAME_TIME) {
      this.aniId = requestAnimationFrame(this.loop.bind(this));
      return;
    }
    
    // 更新FPS计算
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
      
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
    
    // 使用配置的阈值
    if (this.fps < performanceConfig.LOW_FPS_THRESHOLD || 
        totalObjects > performanceConfig.MAX_OBJECTS_THRESHOLD) {
      // 减少粒子效果
      this.reduceParticleEffects();
      
      // 清理更多无效对象
      this.cleanupObjects();
      
      // 如果FPS仍然很低，进一步优化
      if (this.fps < performanceConfig.CRITICAL_FPS_THRESHOLD) {
        this.aggressiveOptimization();
      }
    }
    
    // 检查内存使用情况
    if (totalObjects > 100 || stats.poolStats.total > 200) {
      console.warn('High memory usage detected, performing aggressive cleanup');
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
