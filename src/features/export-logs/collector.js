/**
 * LogCollector — 纯状态模块
 * 在内存中维护当前会话的有序日志条目列表。
 * 不依赖 DOM（init() 方法除外，用于挂载全局监听）。
 */

import { maskCredentials } from './exporter.js';

/** 日志级别约束 */
const VALID_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

/**
 * 工厂函数：创建一个独立的日志收集器实例。
 *
 * @param {object} [options]
 * @param {number} [options.maxEntries=1000] - 内存列表最大条目数，超出时 FIFO 丢弃最旧条目
 * @returns {{ init(): void, log(level: string, module: string, message: string): void, getEntries(): object[], clear(): void }}
 */
export function createLogCollector(options = {}) {
  const maxEntries = (options && typeof options.maxEntries === 'number')
    ? options.maxEntries
    : 1000;

  /** @type {Array<{timestamp:string, level:string, module:string, message:string}>} */
  const entries = [];

  /** init() 幂等标志 */
  let initialized = false;

  /**
   * 追加一条日志条目。
   * 写入前对 message 执行凭据遮盖，截断 module（≤64 字）和 message（≤2048 字）。
   *
   * @param {string} level   - 'debug' | 'info' | 'warn' | 'error'
   * @param {string} module  - 来源模块标识
   * @param {string} message - 日志正文
   */
  function log(level, module, message) {
    const safeLevel   = VALID_LEVELS.has(level) ? level : 'info';
    const safeModule  = String(module  ?? '').slice(0, 64);
    const safeMessage = maskCredentials(String(message ?? '')).slice(0, 2048);

    const entry = {
      timestamp: new Date().toISOString(),
      level:     safeLevel,
      module:    safeModule,
      message:   safeMessage,
    };

    entries.push(entry);

    // FIFO：超出上限时移除最旧一条
    if (entries.length > maxEntries) {
      entries.shift();
    }
  }

  /**
   * 挂载全局错误监听（幂等，重复调用不重复注册）。
   * - window.onerror       → log('error', 'window', …)
   * - unhandledrejection   → log('error', 'promise', …)
   */
  function init() {
    if (initialized) return;
    initialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const msg = `${event.message ?? 'unknown error'} (${event.filename ?? ''}:${event.lineno ?? 0})`;
        log('error', 'window', msg);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason != null
          ? String(event.reason)
          : 'unhandled promise rejection';
        log('error', 'promise', reason);
      });
    }
  }

  /**
   * 返回当前条目列表的浅拷贝快照。
   *
   * @returns {Array<{timestamp:string, level:string, module:string, message:string}>}
   */
  function getEntries() {
    return entries.slice();
  }

  /**
   * 清空条目列表（主要用于单元测试重置状态）。
   */
  function clear() {
    entries.length = 0;
  }

  return { init, log, getEntries, clear };
}

/**
 * 全局单例。由 app.js 在初始化阶段调用 logCollector.init() 完成挂载。
 */
export const logCollector = createLogCollector();
