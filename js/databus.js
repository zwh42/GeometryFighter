import Pool from './base/pool';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';

let instance;

/**
 * 全局状态管理器
 * 负责管理游戏的状态，包括帧数、分数、子弹、敌人和动画等
 */
export default class DataBus {
  // 直接在类中定义实例属性
  enemys = []; // 存储敌人
  bullets = []; // 存储子弹
  enemyBullets = []; // 存储敌机子弹
  animations = []; // 存储动画
  powerUps = []; // 存储宝物
  superWeapons = []; // 存储超级武器
  frame = 0; // 当前帧数
  score = 0; // 当前分数
  highestScore = 0; // 最高分数
  isGameOver = false; // 游戏是否结束
  pool = new Pool(); // 初始化对象池
  player = null; // 玩家引用
  lastSuperWeaponTime = 0; // 上次生成超级武器的时间

  constructor() {
    // 确保单例模式
    if (instance) return instance;

    instance = this;
  }

  // 重置游戏状态
  reset() {
    this.frame = 0; // 当前帧数
    this.score = 0; // 当前分数
    this.bullets = []; // 存储子弹
    this.enemyBullets = []; // 存储敌机子弹
    this.enemys = []; // 存储敌人
    this.animations = []; // 存储动画
    this.powerUps = []; // 存储宝物
    this.superWeapons = []; // 存储超级武器
    this.isGameOver = false; // 游戏是否结束
    this.lastSuperWeaponTime = 0; // 重置超级武器时间
  }

  // 游戏结束
  gameOver() {
    this.isGameOver = true;
    // 更新最高分
    if (this.score > this.highestScore) {
      this.highestScore = this.score;
    }
  }

  /**
   * 回收敌人，进入对象池
   * 此后不进入帧循环
   * @param {Object} enemy - 要回收的敌人对象
   */
  removeEnemy(enemy) {
    const temp = this.enemys.splice(this.enemys.indexOf(enemy), 1);
    if (temp) {
      this.pool.recover('enemy', enemy); // 回收敌人到对象池
    }
  }

  /**
   * 回收子弹，进入对象池
   * 此后不进入帧循环
   * @param {Object} bullet - 要回收的子弹对象
   */
  removeBullets(bullet) {
    const temp = this.bullets.splice(this.bullets.indexOf(bullet), 1);
    if (temp) {
      this.pool.recover('bullet', bullet); // 回收子弹到对象池
    }
  }

  /**
   * 回收宝物，进入对象池
   * 此后不进入帧循环
   * @param {Object} powerUp - 要回收的宝物对象
   */
  removePowerUp(powerUp) {
    const temp = this.powerUps.splice(this.powerUps.indexOf(powerUp), 1);
    if (temp) {
      this.pool.recover('powerup', powerUp); // 回收宝物到对象池
    }
  }

  /**
   * 回收超级武器，进入对象池
   * 此后不进入帧循环
   * @param {Object} superWeapon - 要回收的超级武器对象
   */
  removeSuperWeapon(superWeapon) {
    const temp = this.superWeapons.splice(this.superWeapons.indexOf(superWeapon), 1);
    if (temp) {
      this.pool.recover('superweapon', superWeapon); // 回收超级武器到对象池
    }
  }

  /**
   * 回收敌机子弹，进入对象池
   * 此后不进入帧循环
   * @param {Object} enemyBullet - 要回收的敌机子弹对象
   */
  removeEnemyBullet(enemyBullet) {
    const temp = this.enemyBullets.splice(this.enemyBullets.indexOf(enemyBullet), 1);
    if (temp) {
      this.pool.recover('enemybullet', enemyBullet); // 回收敌机子弹到对象池
    }
  }

  // 检查是否应该生成超级武器
  checkSuperWeaponSpawn() {
    const currentTime = Date.now();
    const timeSinceLastSpawn = currentTime - this.lastSuperWeaponTime;
    const minTime = 40000; // 40秒
    const maxTime = 90000; // 90秒
    
    if (timeSinceLastSpawn >= minTime && 
        (timeSinceLastSpawn >= maxTime || Math.random() < 0.02)) { // 2%概率生成
      this.spawnSuperWeapon();
      this.lastSuperWeaponTime = currentTime;
    }
  }

  // 生成超级武器
  spawnSuperWeapon() {
    const SuperWeapon = require('./player/superweapon').default;
    const superWeapon = this.pool.getItemByClass('superweapon', SuperWeapon);
    const x = Math.random() * (SCREEN_WIDTH - 30);
    const y = -30;
    superWeapon.init(x, y);
    this.superWeapons.push(superWeapon);
  }
}
