/**
 * 设备适配工具类
 * 用于处理不同手机型号的屏幕适配问题
 */
class DeviceAdapter {
  constructor() {
    this.init();
  }

  init() {
    // 获取设备信息
    const systemInfo = wx.getSystemInfoSync();
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : systemInfo;
    
    // 基础屏幕信息
    this.screenWidth = windowInfo.screenWidth;
    this.screenHeight = windowInfo.screenHeight;
    this.windowWidth = windowInfo.windowWidth;
    this.windowHeight = windowInfo.windowHeight;
    
    // 设备像素比
    this.pixelRatio = systemInfo.pixelRatio || 1;
    
    // 计算适配比例
    this.calculateScaleRatio();
    
    // 计算基准尺寸
    this.calculateBaseSizes();
  }

  /**
   * 计算适配比例
   * 基于屏幕宽度进行适配，确保在不同设备上有一致的视觉比例
   */
  calculateScaleRatio() {
    // 基准屏幕宽度（以iPhone 6/7/8为基准）
    const BASE_SCREEN_WIDTH = 375;
    
    // 计算缩放比例
    this.scaleRatio = this.screenWidth / BASE_SCREEN_WIDTH;
    
    // 限制缩放范围，避免在极端设备上过大或过小
    this.scaleRatio = Math.max(0.8, Math.min(1.5, this.scaleRatio));
  }

  /**
   * 计算基准尺寸
   * 基于适配比例计算各种游戏对象的基准尺寸
   */
  calculateBaseSizes() {
    // 尺寸增大20%的系数
    const SIZE_MULTIPLIER = 1.2;
    // 子弹额外增大30%的系数
    const BULLET_SIZE_MULTIPLIER = 1.3;
    
    // 玩家战机基准尺寸
    this.basePlayerWidth = Math.round(44 * this.scaleRatio * SIZE_MULTIPLIER);
    this.basePlayerHeight = Math.round(40 * this.scaleRatio * SIZE_MULTIPLIER);
    
    // 子弹基准尺寸（增大30%）
    this.baseBulletWidth = Math.round(8 * this.scaleRatio * SIZE_MULTIPLIER * BULLET_SIZE_MULTIPLIER);
    this.baseBulletHeight = Math.round(15 * this.scaleRatio * SIZE_MULTIPLIER * BULLET_SIZE_MULTIPLIER);
    
    // 敌机基准尺寸
    this.baseEnemyWidth = Math.round(60 * this.scaleRatio * SIZE_MULTIPLIER);
    this.baseEnemyHeight = Math.round(50 * this.scaleRatio * SIZE_MULTIPLIER);
    
    // 敌机子弹基准尺寸（比玩家子弹小25%）
    this.baseEnemyBulletWidth = Math.round(8 * this.scaleRatio * SIZE_MULTIPLIER * BULLET_SIZE_MULTIPLIER * 0.75);
    this.baseEnemyBulletHeight = Math.round(15 * this.scaleRatio * SIZE_MULTIPLIER * BULLET_SIZE_MULTIPLIER * 0.75);
    
    // 道具基准尺寸
    this.basePowerUpWidth = Math.round(20 * this.scaleRatio * SIZE_MULTIPLIER);
    this.basePowerUpHeight = Math.round(20 * this.scaleRatio * SIZE_MULTIPLIER);
    
    // 超级武器基准尺寸
    this.baseSuperWeaponWidth = Math.round(30 * this.scaleRatio * SIZE_MULTIPLIER);
    this.baseSuperWeaponHeight = Math.round(30 * this.scaleRatio * SIZE_MULTIPLIER);
  }

  /**
   * 获取适配后的玩家战机尺寸
   */
  getPlayerSize() {
    return {
      width: this.basePlayerWidth,
      height: this.basePlayerHeight
    };
  }

  /**
   * 获取适配后的子弹尺寸
   */
  getBulletSize() {
    return {
      width: this.baseBulletWidth,
      height: this.baseBulletHeight
    };
  }

  /**
   * 获取适配后的敌机尺寸
   */
  getEnemySize() {
    return {
      width: this.baseEnemyWidth,
      height: this.baseEnemyHeight
    };
  }

  /**
   * 获取适配后的敌机子弹尺寸
   */
  getEnemyBulletSize() {
    return {
      width: this.baseEnemyBulletWidth,
      height: this.baseEnemyBulletHeight
    };
  }

  /**
   * 获取适配后的道具尺寸
   */
  getPowerUpSize() {
    return {
      width: this.basePowerUpWidth,
      height: this.basePowerUpHeight
    };
  }

  /**
   * 获取适配后的超级武器尺寸
   */
  getSuperWeaponSize() {
    return {
      width: this.baseSuperWeaponWidth,
      height: this.baseSuperWeaponHeight
    };
  }

  /**
   * 适配坐标
   * 将逻辑坐标转换为适配后的坐标
   */
  adaptCoordinate(x, y) {
    return {
      x: Math.round(x * this.scaleRatio),
      y: Math.round(y * this.scaleRatio)
    };
  }

  /**
   * 适配尺寸
   * 将逻辑尺寸转换为适配后的尺寸
   */
  adaptSize(width, height) {
    return {
      width: Math.round(width * this.scaleRatio),
      height: Math.round(height * this.scaleRatio)
    };
  }

  /**
   * 适配速度
   * 将逻辑速度转换为适配后的速度
   */
  adaptSpeed(speed) {
    // 增加10%的速度
    const SPEED_MULTIPLIER = 1.1;
    return speed * this.scaleRatio * SPEED_MULTIPLIER;
  }

  /**
   * 获取触摸偏差值
   * 根据屏幕尺寸调整触摸检测的偏差值
   */
  getTouchDeviation() {
    return Math.round(30 * this.scaleRatio);
  }

  /**
   * 获取射击间隔适配值
   * 根据设备性能调整射击间隔
   */
  getShootInterval() {
    // 基础射击间隔
    const baseInterval = 20;
    
    // 根据屏幕尺寸调整射击间隔
    if (this.screenWidth >= 414) {
      // 大屏设备，稍微加快射击速度
      return Math.round(baseInterval * 0.9);
    } else if (this.screenWidth <= 320) {
      // 小屏设备，稍微减慢射击速度
      return Math.round(baseInterval * 1.1);
    }
    
    return baseInterval;
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo() {
    return {
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      pixelRatio: this.pixelRatio,
      scaleRatio: this.scaleRatio,
      isHighDPI: this.pixelRatio > 2,
      isLargeScreen: this.screenWidth > 400,
      isSmallScreen: this.screenWidth < 350
    };
  }

  /**
   * 测试设备适配系统
   */
  testAdaptation() {
    // 测试完成，无需输出日志
  }
}

// 创建全局设备适配器实例
const deviceAdapter = new DeviceAdapter();

export default deviceAdapter; 