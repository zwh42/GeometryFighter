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
 * 验证游戏对象
 * @param {Object} obj - 要验证的对象
 * @param {string} type - 对象类型
 * @returns {boolean} 是否有效
 */
export function validateGameObject(obj, type = 'unknown') {
  if (!obj) {
    console.warn(`[${type}] Object is null or undefined`);
    return false;
  }
  
  if (typeof obj !== 'object') {
    console.warn(`[${type}] Object is not an object:`, typeof obj);
    return false;
  }
  
  if (obj.isActive === undefined) {
    console.warn(`[${type}] Object missing isActive property:`, obj);
    return false;
  }
  
  return true;
}

/**
 * 清理数组中的无效对象
 * @param {Array} array - 要清理的数组
 * @param {string} type - 数组类型（用于调试）
 * @returns {Array} 清理后的数组
 */
export function cleanArray(array, type = 'unknown') {
  if (!Array.isArray(array)) {
    console.warn(`[${type}] Not an array:`, array);
    return [];
  }
  
  const cleaned = array.filter(item => {
    if (!validateGameObject(item, type)) {
      return false;
    }
    return item.isActive;
  });
  
  if (cleaned.length !== array.length) {
    console.log(`[${type}] Cleaned array: ${array.length} -> ${cleaned.length} items`);
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
      
      // 输出性能信息
      if (this.metrics.errors > 0 || this.metrics.warnings > 0) {
        console.log(`Performance: FPS=${this.metrics.fps}, Errors=${this.metrics.errors}, Warnings=${this.metrics.warnings}`);
      }
    }
  }
  
  logError(error, context = '') {
    this.metrics.errors++;
    console.error(`[${context}] Error:`, error);
  }
  
  logWarning(warning, context = '') {
    this.metrics.warnings++;
    console.warn(`[${context}] Warning:`, warning);
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
} 