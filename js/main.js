import './render'; // 初始化Canvas
import Player from './player/index'; // 导入玩家类
import Enemy from './npc/enemy'; // 导入敌机类
import BackGround from './runtime/background'; // 导入背景类
import GameInfo from './runtime/gameinfo'; // 导入游戏UI类
import Music from './runtime/music'; // 导入音乐类
import DataBus from './databus'; // 导入数据类，用于管理游戏状态和数据

const ENEMY_GENERATE_INTERVAL = 30;
const ctx = canvas.getContext('2d'); // 获取canvas的2D绘图上下文;

GameGlobal.databus = new DataBus(); // 全局数据管理，用于管理游戏状态和数据
GameGlobal.musicManager = new Music(); // 全局音乐管理实例

/**
 * 游戏主函数
 */
export default class Main {
  aniId = 0; // 用于存储动画帧的ID
  bg = new BackGround(); // 创建背景
  player = new Player(); // 创建玩家
  gameInfo = new GameInfo(); // 创建游戏UI显示

  constructor() {
    // 当开始游戏被点击时，重新开始游戏
    this.gameInfo.on('restart', this.start.bind(this));

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
   * 全局碰撞检测
   */
  collisionDetection() {
    // 检测子弹与敌机的碰撞
    GameGlobal.databus.bullets.forEach((bullet) => {
      for (let i = 0, il = GameGlobal.databus.enemys.length; i < il; i++) {
        const enemy = GameGlobal.databus.enemys[i];

        // 如果敌机存活并且发生了发生碰撞
        if (enemy.isCollideWith(bullet)) {
          enemy.takeDamage(); // 使用新的伤害系统
          bullet.destroy(); // 销毁子弹
          // 如果敌机被击毁，增加积分和回血
          if (!enemy.isActive) {
            GameGlobal.databus.score += 10; // 每击落一架敌机+10分
            this.player.heal(1); // 击落敌机回血1%
          }
          break; // 退出循环
        }
      }
    });

    // 检测敌机子弹与玩家的碰撞
    GameGlobal.databus.enemyBullets.forEach((enemyBullet) => {
      if (this.player.isCollideWith(enemyBullet)) {
        this.player.takeDamage(20); // 被敌机子弹击中掉血20%
        enemyBullet.destroy(); // 销毁敌机子弹
        // 只有在血量为0时才游戏结束
        if (this.player.health <= 0) {
          GameGlobal.databus.gameOver(); // 游戏结束
        }
      }
    });

    // 检测玩家与敌机的碰撞
    for (let i = 0, il = GameGlobal.databus.enemys.length; i < il; i++) {
      const enemy = GameGlobal.databus.enemys[i];

      // 如果玩家与敌机发生碰撞
      if (this.player.isCollideWith(enemy)) {
        this.player.takeDamage(60); // 被敌机撞击掉血60%
        enemy.destroy(); // 销毁敌机
        // 只有在血量为0时才游戏结束
        if (this.player.health <= 0) {
          GameGlobal.databus.gameOver(); // 游戏结束
        }
        break; // 退出循环
      }
    }

    // 检测玩家与宝物的碰撞
    GameGlobal.databus.powerUps.forEach(powerUp => {
      if (this.player.isCollideWith(powerUp)) {
        this.player.enableSpreadMode();
        powerUp.destroy();
      }
    });

    // 检测玩家与超级武器的碰撞
    GameGlobal.databus.superWeapons.forEach(superWeapon => {
      if (this.player.isCollideWith(superWeapon)) {
        superWeapon.activate(); // 激活超级武器效果
        superWeapon.destroy();
      }
    });
  }

  /**
   * canvas重绘函数
   * 每一帧重新绘制所有的需要展示的元素
   */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清空画布

    this.bg.render(ctx); // 绘制背景
    this.player.render(ctx); // 绘制玩家飞机
    GameGlobal.databus.bullets.forEach((item) => item.render(ctx)); // 绘制所有子弹
    GameGlobal.databus.enemyBullets.forEach((item) => item.render(ctx)); // 绘制所有敌机子弹
    GameGlobal.databus.enemys.forEach((item) => item.render(ctx)); // 绘制所有敌机
    GameGlobal.databus.powerUps.forEach((item) => item.render(ctx)); // 绘制所有宝物
    GameGlobal.databus.superWeapons.forEach((item) => item.render(ctx)); // 绘制所有超级武器
    this.gameInfo.render(ctx); // 绘制游戏UI
    GameGlobal.databus.animations.forEach((ani) => {
      if (ani.isPlaying) {
        ani.aniRender(ctx); // 渲染动画
      }
    }); // 绘制所有动画
  }

  // 游戏逻辑更新主函数
  update() {
    GameGlobal.databus.frame++; // 增加帧数

    if (GameGlobal.databus.isGameOver) {
      return;
    }

    this.bg.update(); // 更新背景
    this.player.update(); // 更新玩家
    // 更新所有子弹
    GameGlobal.databus.bullets.forEach((item) => item.update());
    // 更新所有敌机子弹
    GameGlobal.databus.enemyBullets.forEach((item) => item.update());
    // 更新所有敌机
    GameGlobal.databus.enemys.forEach((item) => item.update());
    // 更新所有宝物
    GameGlobal.databus.powerUps.forEach((item) => item.update());
    // 更新所有超级武器
    GameGlobal.databus.superWeapons.forEach((item) => item.update());

    this.enemyGenerate(); // 生成敌机
    this.collisionDetection(); // 检测碰撞
    
    // 检查超级武器生成
    GameGlobal.databus.checkSuperWeaponSpawn();
  }

  // 实现游戏帧循环
  loop() {
    this.update(); // 更新游戏逻辑
    this.render(); // 渲染游戏画面

    // 请求下一帧动画
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
