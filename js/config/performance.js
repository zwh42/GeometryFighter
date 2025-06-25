/**
 * 性能配置文件
 * 可以根据设备性能调整这些参数
 */

export const PERFORMANCE_CONFIG = {
  // 帧率设置
  TARGET_FPS: 60,
  MIN_FPS: 30,
  
  // 粒子系统设置
  MAX_PLAYER_PARTICLES: 8,
  MAX_ENEMY_PARTICLES: 5,
  MAX_BULLET_PARTICLES: 6,
  MAX_ENEMY_BULLET_PARTICLES: 4,
  
  // 对象池设置
  MAX_POOL_SIZE: 50,
  
  // 游戏对象限制
  MAX_ENEMIES: 15,
  MAX_BULLETS: 30,
  MAX_ENEMY_BULLETS: 20,
  
  // 自适应优化阈值
  LOW_FPS_THRESHOLD: 50,
  CRITICAL_FPS_THRESHOLD: 30,
  MAX_OBJECTS_THRESHOLD: 100,
  
  // 渲染优化
  ENABLE_PARTICLES: true,
  ENABLE_SHADOWS: true,
  ENABLE_GRADIENTS: true,
  
  // 移动设备优化
  MOBILE_OPTIMIZATION: {
    REDUCE_PARTICLES: true,
    DISABLE_SHADOWS: true,
    SIMPLIFY_GRADIENTS: true,
    LOWER_MAX_OBJECTS: true
  }
};

/**
 * 检测设备性能并调整配置
 */
export function detectDevicePerformance() {
  const config = { ...PERFORMANCE_CONFIG };
  
  // 检测是否为移动设备 - 适配微信小程序环境
  let isMobile = false;
  
  // 微信小程序环境检测
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
    try {
      const systemInfo = wx.getSystemInfoSync();
      isMobile = systemInfo.platform === 'ios' || systemInfo.platform === 'android';
    } catch (e) {
      // 如果获取系统信息失败，默认按移动设备处理
      isMobile = true;
    }
  } else if (typeof navigator !== 'undefined') {
    // 浏览器环境检测
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  } else {
    // 默认按移动设备处理
    isMobile = true;
  }
  
  if (isMobile) {
    // 移动设备优化
    config.MAX_PLAYER_PARTICLES = 4;
    config.MAX_ENEMY_PARTICLES = 3;
    config.MAX_BULLET_PARTICLES = 3;
    config.MAX_ENEMY_BULLET_PARTICLES = 2;
    config.MAX_ENEMIES = 10;
    config.MAX_BULLETS = 20;
    config.MAX_ENEMY_BULLETS = 15;
    config.ENABLE_SHADOWS = false;
    config.ENABLE_GRADIENTS = false;
  }
  
  // 检测内存限制 - 微信小程序环境可能没有deviceMemory
  if (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) {
    // 低内存设备优化
    config.MAX_POOL_SIZE = 30;
    config.MAX_OBJECTS_THRESHOLD = 60;
  }
  
  return config;
}

/**
 * 获取当前性能配置
 */
export function getPerformanceConfig() {
  return detectDevicePerformance();
} 