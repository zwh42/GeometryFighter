import Pool from './base/pool';
import SuperWeapon from './player/superweapon';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';

let instance;

const __ = {
  poolDic: Symbol('poolDic'),
};

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

  /**
   * 重置游戏数据
   */
  reset() {
    this.frame = 0;
    this.score = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemys = [];
    this.animations = [];
    this.powerUps = [];
    this.superWeapons = [];
    this.isGameOver = false;
    this.player = null;
    
    // 重置对象池
    this.pool.clear();
  }

  // 游戏结束
  gameOver() {
    this.isGameOver = true;
    // 更新最高分
    if (this.score > this.highestScore) {
      this.highestScore = this.score;
    }
    
    // 清理所有对象
    this.cleanupAllObjects();
  }

  /**
   * 清理所有游戏对象
   */
  cleanupAllObjects() {
    // 清理所有数组
    this.bullets.length = 0;
    this.enemyBullets.length = 0;
    this.enemys.length = 0;
    this.animations.length = 0;
    this.powerUps.length = 0;
    this.superWeapons.length = 0;
    
    // 清理对象池
    this.pool.clear();
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    return {
      frame: this.frame,
      score: this.score,
      bullets: this.bullets.length,
      enemyBullets: this.enemyBullets.length,
      enemys: this.enemys.length,
      animations: this.animations.length,
      powerUps: this.powerUps.length,
      superWeapons: this.superWeapons.length,
      poolStats: this.pool.getStats()
    };
  }

  /**
   * 回收敌人，进入对象池
   * 此后不进入帧循环
   * @param {Object} enemy - 要回收的敌人对象
   */
  removeEnemy(enemy) {
    if (!enemy) return;
    
    const index = this.enemys.indexOf(enemy);
    if (index !== -1) {
      this.enemys.splice(index, 1);
      this.pool.recover('enemy', enemy); // 回收敌人到对象池
    }
  }

  /**
   * 回收子弹，进入对象池
   * 此后不进入帧循环
   * @param {Object} bullet - 要回收的子弹对象
   */
  removeBullets(bullet) {
    if (!bullet) return;
    
    const index = this.bullets.indexOf(bullet);
    if (index !== -1) {
      this.bullets.splice(index, 1);
      this.pool.recover('bullet', bullet); // 回收子弹到对象池
    }
  }

  /**
   * 回收宝物，进入对象池
   * 此后不进入帧循环
   * @param {Object} powerUp - 要回收的宝物对象
   */
  removePowerUp(powerUp) {
    if (!powerUp) return;
    
    const index = this.powerUps.indexOf(powerUp);
    if (index !== -1) {
      this.powerUps.splice(index, 1);
      this.pool.recover('powerup', powerUp); // 回收宝物到对象池
    }
  }

  /**
   * 回收超级武器，进入对象池
   * 此后不进入帧循环
   * @param {Object} superWeapon - 要回收的超级武器对象
   */
  removeSuperWeapon(superWeapon) {
    if (!superWeapon) return;
    
    const index = this.superWeapons.indexOf(superWeapon);
    if (index !== -1) {
      this.superWeapons.splice(index, 1);
      this.pool.recover('superweapon', superWeapon); // 回收超级武器到对象池
    }
  }

  /**
   * 回收敌机子弹，进入对象池
   * 此后不进入帧循环
   * @param {Object} enemyBullet - 要回收的敌机子弹对象
   */
  removeEnemyBullet(enemyBullet) {
    if (!enemyBullet) return;
    
    const index = this.enemyBullets.indexOf(enemyBullet);
    if (index !== -1) {
      this.enemyBullets.splice(index, 1);
      this.pool.recover('enemybullet', enemyBullet); // 回收敌机子弹到对象池
    }
  }

  /**
   * 检查超级武器生成
   */
  checkSuperWeaponSpawn() {
    const currentTime = Date.now();
    const spawnInterval = 15000; // 15秒生成一个超级武器
    
    if (currentTime - this.lastSuperWeaponTime > spawnInterval) {
      this.lastSuperWeaponTime = currentTime;
      
      // 随机生成超级武器
      const superWeapon = this.pool.getItemByClass('superWeapon', SuperWeapon);
      superWeapon.init();
      this.superWeapons.push(superWeapon);
    }
  }
}
