const __ = {
  poolDic: Symbol('poolDic'),
};

/**
 * 优化的对象池实现
 * 用于对象的存贮和重复使用
 * 可以有效减少对象创建开销和避免频繁的垃圾回收
 * 提高游戏性能
 */
export default class Pool {
  constructor() {
    this[__.poolDic] = {};
    this.maxPoolSize = 30; // 减少每个池的最大大小
    this.cleanupCounter = 0; // 清理计数器
  }

  /**
   * 根据对象标识符
   * 获取对应的对象池
   */
  getPoolBySign(name) {
    return this[__.poolDic][name] || (this[__.poolDic][name] = []);
  }

  /**
   * 根据传入的对象标识符，查询对象池
   * 对象池为空创建新的类，否则从对象池中取
   */
  getItemByClass(name, className) {
    const pool = this.getPoolBySign(name);

    const result = pool.length ? pool.shift() : new className();

    return result;
  }

  /**
   * 将对象回收到对象池
   * 方便后续继续使用
   */
  recover(name, instance) {
    const pool = this.getPoolBySign(name);
    
    // 限制池的大小，避免内存泄漏
    if (pool.length < this.maxPoolSize) {
      // 重置对象状态
      if (instance.reset) {
        instance.reset();
      } else {
        // 通用重置
        instance.isActive = false;
        instance.visible = false;
        if (instance.trailParticles) {
          instance.trailParticles.length = 0;
        }
      }
      
      pool.push(instance);
    } else {
      // 如果池已满，直接丢弃对象
      console.log(`Pool ${name} is full, discarding object`);
    }
  }

  /**
   * 清理所有对象池
   */
  clear() {
    for (const key in this[__.poolDic]) {
      this[__.poolDic][key].length = 0;
    }
    this.cleanupCounter = 0;
  }

  /**
   * 强制清理对象池
   * 保留一半的对象，丢弃另一半
   */
  forceCleanup() {
    for (const key in this[__.poolDic]) {
      const pool = this[__.poolDic][key];
      if (pool.length > this.maxPoolSize / 2) {
        // 保留一半的对象
        pool.splice(0, Math.floor(pool.length / 2));
      }
    }
  }

  /**
   * 获取池的统计信息
   */
  getStats() {
    const stats = {};
    let totalObjects = 0;
    for (const key in this[__.poolDic]) {
      const count = this[__.poolDic][key].length;
      stats[key] = count;
      totalObjects += count;
    }
    stats.total = totalObjects;
    return stats;
  }
}
