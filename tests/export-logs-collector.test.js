// @vitest-environment jsdom
/**
 * 单元测试：LogCollector（src/features/export-logs/collector.js）
 * 覆盖需求 1.1–1.6
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createLogCollector } from '../src/features/export-logs/collector.js';

// ─── 辅助 ───────────────────────────────────────────────────────────────────

function makeCollector(opts) {
  return createLogCollector(opts);
}

// ─── 需求 1.1：初始列表为空 ──────────────────────────────────────────────────

describe('需求 1.1：初始化与空列表', () => {
  it('新建收集器 getEntries() 返回空数组', () => {
    const c = makeCollector();
    expect(c.getEntries()).toEqual([]);
  });

  it('init() 调用前后 getEntries() 均返回空数组（无副作用）', () => {
    const c = makeCollector();
    c.init();
    expect(c.getEntries()).toEqual([]);
  });
});

// ─── 需求 1.2：追加条目结构 ──────────────────────────────────────────────────

describe('需求 1.2：追加条目结构', () => {
  it('追加后 getEntries() 包含一条对应条目', () => {
    const c = makeCollector();
    c.log('info', 'app', 'hello');
    const entries = c.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].module).toBe('app');
    expect(entries[0].message).toBe('hello');
  });

  it('timestamp 是合法的 ISO 8601 字符串', () => {
    const c = makeCollector();
    c.log('debug', 'mod', 'msg');
    const ts = c.getEntries()[0].timestamp;
    expect(Number.isNaN(Date.parse(ts))).toBe(false);
    // ISO 格式含 T 和 Z
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('module 超过 64 字符时截断', () => {
    const c = makeCollector();
    const longModule = 'a'.repeat(100);
    c.log('warn', longModule, 'msg');
    expect(c.getEntries()[0].module).toHaveLength(64);
  });

  it('message 超过 2048 字符时截断', () => {
    const c = makeCollector();
    const longMsg = 'x'.repeat(3000);
    c.log('error', 'mod', longMsg);
    expect(c.getEntries()[0].message).toHaveLength(2048);
  });

  it('支持全部四种合法级别', () => {
    const c = makeCollector();
    for (const level of ['debug', 'info', 'warn', 'error']) {
      c.log(level, 'mod', 'msg');
    }
    const levels = c.getEntries().map(e => e.level);
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('未知 level 回退为 info', () => {
    const c = makeCollector();
    c.log('trace', 'mod', 'msg');
    expect(c.getEntries()[0].level).toBe('info');
  });

  it('getEntries() 返回浅拷贝，外部修改不影响内部', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'msg');
    const snapshot = c.getEntries();
    snapshot.pop();
    expect(c.getEntries()).toHaveLength(1);
  });
});

// ─── 需求 1.3：window.onerror 全局监听 ──────────────────────────────────────

describe('需求 1.3：window.onerror 全局监听', () => {
  let c;
  beforeEach(() => {
    c = makeCollector();
    c.init();
  });

  it('window error 事件追加 error 级别条目，包含消息、文件名和行号', () => {
    const event = new ErrorEvent('error', {
      message: 'ReferenceError: x is not defined',
      filename: 'app.js',
      lineno: 42,
    });
    window.dispatchEvent(event);

    const entries = c.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const last = entries[entries.length - 1];
    expect(last.level).toBe('error');
    expect(last.module).toBe('window');
    expect(last.message).toContain('ReferenceError');
    expect(last.message).toContain('app.js');
    expect(last.message).toContain('42');
  });
});

// ─── 需求 1.4：unhandledrejection 全局监听 ───────────────────────────────────

describe('需求 1.4：unhandledrejection 全局监听', () => {
  let c;
  beforeEach(() => {
    c = makeCollector();
    c.init();
  });

  it('unhandledrejection 事件追加 error 级别条目，包含拒绝原因', () => {
    // jsdom 不提供 PromiseRejectionEvent，用 CustomEvent 模拟
    const event = new CustomEvent('unhandledrejection');
    Object.defineProperty(event, 'reason', { value: 'Network timeout' });
    window.dispatchEvent(event);

    const entries = c.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const last = entries[entries.length - 1];
    expect(last.level).toBe('error');
    expect(last.module).toBe('promise');
    expect(last.message).toContain('Network timeout');
  });
});

// ─── 需求 1.4 + 1.3：init() 幂等性 ─────────────────────────────────────────

describe('init() 幂等性', () => {
  it('重复调用 init() 不重复注册监听，错误事件只追加一条', () => {
    const c = makeCollector();
    c.init();
    c.init(); // 第二次调用不应重复注册

    const event = new ErrorEvent('error', {
      message: 'test error',
      filename: 'x.js',
      lineno: 1,
    });
    window.dispatchEvent(event);

    // 仅应有 1 条错误条目
    expect(c.getEntries().filter(e => e.module === 'window')).toHaveLength(1);
  });
});

// ─── 需求 1.5：FIFO 上限 ─────────────────────────────────────────────────────

describe('需求 1.5：FIFO 上限', () => {
  it('默认上限 1000，超出时移除最旧条目', () => {
    const c = makeCollector();
    for (let i = 0; i < 1001; i++) {
      c.log('info', 'mod', `msg-${i}`);
    }
    const entries = c.getEntries();
    expect(entries).toHaveLength(1000);
    // 最旧的 msg-0 应已被移除
    expect(entries[0].message).toBe('msg-1');
    // 最新的 msg-1000 仍在列表末尾
    expect(entries[999].message).toBe('msg-1000');
  });

  it('自定义 maxEntries=5 生效', () => {
    const c = makeCollector({ maxEntries: 5 });
    for (let i = 0; i < 7; i++) {
      c.log('info', 'mod', `m${i}`);
    }
    expect(c.getEntries()).toHaveLength(5);
    expect(c.getEntries()[0].message).toBe('m2');
  });
});

// ─── 需求 1.6：凭据遮盖 ──────────────────────────────────────────────────────

describe('需求 1.6：凭据遮盖', () => {
  it('含 sk- 凭据的 message 被遮盖', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'token is sk-abc123XYZ');
    expect(c.getEntries()[0].message).not.toContain('sk-abc123XYZ');
    expect(c.getEntries()[0].message).toContain('[REDACTED]');
  });

  it('含 Bearer 凭据的 message 被遮盖', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig');
    expect(c.getEntries()[0].message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(c.getEntries()[0].message).toContain('[REDACTED]');
  });

  it('不含凭据的 message 保持原样', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'just a normal log message');
    expect(c.getEntries()[0].message).toBe('just a normal log message');
  });

  it('凭据遮盖在截断之后应用（截断至 2048 再遮盖）', () => {
    const c = makeCollector();
    // 凭据出现在 2048 字符范围内
    const msg = 'prefix sk-SECRET1234 suffix';
    c.log('info', 'mod', msg);
    expect(c.getEntries()[0].message).toContain('[REDACTED]');
    expect(c.getEntries()[0].message).not.toContain('sk-SECRET1234');
  });
});

// ─── clear() ─────────────────────────────────────────────────────────────────

describe('clear()', () => {
  it('清空后 getEntries() 返回空数组', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'a');
    c.log('warn', 'mod', 'b');
    c.clear();
    expect(c.getEntries()).toEqual([]);
  });

  it('清空后可继续追加新条目', () => {
    const c = makeCollector();
    c.log('info', 'mod', 'old');
    c.clear();
    c.log('debug', 'mod', 'new');
    expect(c.getEntries()).toHaveLength(1);
    expect(c.getEntries()[0].message).toBe('new');
  });
});

// ─── 全局单例导入测试 ─────────────────────────────────────────────────────────

describe('全局单例 logCollector', () => {
  it('可以导入 logCollector 并调用其方法', async () => {
    const { logCollector } = await import('../src/features/export-logs/collector.js');
    expect(typeof logCollector.log).toBe('function');
    expect(typeof logCollector.init).toBe('function');
    expect(typeof logCollector.getEntries).toBe('function');
    expect(typeof logCollector.clear).toBe('function');
  });
});
import fc from 'fast-check';
// Feature: export-logs, Property 1: append preserves structure invariants
it('属性 1：追加顺序和结构约束',()=>fc.assert(fc.property(fc.constantFrom('debug','info','warn','error'),fc.string({maxLength:100}),fc.string({maxLength:3000}),(level,module,message)=>{
 const c=createLogCollector(); c.log(level,module,message); const row=c.getEntries()[0];
 expect(row.level).toBe(level); expect(row.module).toBe(module.slice(0,64)); expect(row.message.length).toBeLessThanOrEqual(2048); expect(new Date(row.timestamp).toISOString()).toBe(row.timestamp);
}),{numRuns:100}));
// Feature: export-logs, Property 2: list length cap invariant
it('属性 2：FIFO 容量与顺序',()=>fc.assert(fc.property(fc.integer({min:1,max:2000}),n=>{
 const c=createLogCollector(); for(let i=0;i<n;i++) c.log('info','app',String(i));
 expect(c.getEntries().map(e=>e.message)).toEqual(Array.from({length:Math.min(n,1000)},(_,i)=>String(Math.max(0,n-1000)+i)));
}),{numRuns:100}));
