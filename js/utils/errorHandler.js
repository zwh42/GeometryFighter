/**
 * 错误处理工具
 * 用于调试和修复游戏中的错误
 */

/**
 * 安全的数组操作
 * @param {Array} array - 要操作的数组
 * @param {Function} callback - 回调函数
 * @param {string} operationName - 操作名称（用于调试）
 */
export function safeArrayOperation(array, callback, operationName = 'unknown') {
  if (!Array.isArray(array)) {
    console.warn(`[${operationName}] Array is not valid:`, array);
    return;
  }
  
  try {
    callback(array);
  } catch (error) {
    console.error(`[${operationName}] Error during array operation:`, error);
    console.error('Array:', array);
  }
}

/**
 * 安全的对象属性访问
 * @param {Object} obj - 要访问的对象
 * @param {string} property - 属性名
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值或默认值
 */
export function safeGet(obj, property, defaultValue = null) {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  try {
    return obj[property] !== undefined ? obj[property] : defaultValue;
  } catch (error) {
    console.error(`Error accessing property '${property}' on object:`, error);
    return defaultValue;
  }
}

/**
 * 安全的函数调用
 * @param {Function} func - 要调用的函数
 * @param {Array} args - 参数数组
 * @param {*} defaultValue - 默认返回值
 * @returns {*} 函数返回值或默认值
 */
export function safeCall(func, args = [], defaultValue = null) {
  if (typeof func !== 'function') {
    return defaultValue;
  }
  
  try {
    return func.apply(null, args);
  } catch (error) {
    console.error('Error calling function:', error);
    return defaultValue;
  }
}

/**
 * 验证游戏对象是否有效
 */
export function validateGameObject(obj, type = 'object') {
  if (!obj) return false;
  if (typeof obj !== 'object') return false;
  if (!obj.hasOwnProperty('isActive')) return false;
  return true;
}

/**
 * 清理数组中的无效对象
 */
export function cleanArray(arr, type = 'array') {
  if (!Array.isArray(arr)) return arr;
  
  const originalLength = arr.length;
  const cleaned = arr.filter(item => validateGameObject(item, type));
  
  if (cleaned.length !== originalLength) {
    // 静默清理，不输出日志
  }
  
  return cleaned;
}

/**
 * 性能监控
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      frameCount: 0,
      lastFpsUpdate: 0,
      fps: 0,
      errors: 0,
      warnings: 0
    };
  }
  
  update(currentTime) {
    this.metrics.frameCount++;
    
    if (currentTime - this.metrics.lastFpsUpdate >= 1000) {
      this.metrics.fps = this.metrics.frameCount;
      this.metrics.frameCount = 0;
      this.metrics.lastFpsUpdate = currentTime;
    }
  }
  
  logError(error, context = '') {
    this.metrics.errors++;
    // 静默记录错误，不输出到控制台
  }
  
  logWarning(warning, context = '') {
    this.metrics.warnings++;
    // 静默记录警告，不输出到控制台
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
} 