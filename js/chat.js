// ===== AI Chat Assistant =====
// 镜像 search.js 的模式：initChat()/refreshChat()。
// 三模式：
//  - ?mock：无 Key 纯 UI 调试（http://localhost:5120/?mock）
//  - 本地 (localhost/127.0.0.1) + 已配置 Key：BYOK 直连所选服务商（前端工具循环 + SSE 流式）
//  - 其他（Netlify 生产）：POST /.netlify/functions/chat（服务器 Key，固定 DeepSeek）
import { t } from './i18n.js';
import { isLocal, loadConfig, getProvider, hasUsableConfig, renderSettings } from './chat-settings.js?v=10';
import { initChatTools, runTool, TOOL_SCHEMAS, buildSystemPrompt } from './chat-tools.js?v=10';

const ENDPOINT = window.__CHAT_ENDPOINT || '/.netlify/functions/chat';
const MOCK = new URLSearchParams(location.search).has('mock');
const MAX_TOOL_ROUNDS = 3;

let els = {};
let history = [];   // [{role:'user'|'assistant', content}]
let busy = false;
let controller = null;
let greeted = false;
let toolsReady = false;

// 全局调试钩子：把未捕获错误打到控制台，方便用户 F12 反馈
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => console.error('[chat] unhandled error', e && e.error));
  window.addEventListener('unhandledrejection', (e) => console.error('[chat] unhandled rejection', e && e.reason));
}

export async function initChat() {
  els.fab = document.getElementById('chatFab');
  els.toggle = document.getElementById('chatToggle');
  els.panel = document.getElementById('chatPanel');
  els.close = document.getElementById('chatClose');
  els.settingsBtn = document.getElementById('chatSettingsBtn');
  els.title = document.getElementById('chatTitle');
  els.subtitle = document.getElementById('chatSubtitle');
  els.messages = document.getElementById('chatMessages');
  els.chips = document.getElementById('chatChips');
  els.form = document.getElementById('chatForm');
  els.input = document.getElementById('chatInput');
  els.send = document.getElementById('chatSend');
  els.clear = document.getElementById('chatClear');
  els.settings = document.getElementById('chatSettings');
  if (!els.panel || !els.messages || !els.input || !els.form) return;

  // 预加载前端工具数据（BYOK 直连模式需要）
  toolsReady = await initChatTools();

  bindEvents();
  refreshChat();
  ensureGreeting();
}

// 语言切换时刷新静态文案；不清空对话历史
export function refreshChat() {
  if (!els.panel) return;
  if (els.title) els.title.textContent = t('chat.title');
  if (els.subtitle) els.subtitle.textContent = t('chat.subtitle');
  if (els.input) els.input.placeholder = t('chat.placeholder');
  if (els.send) els.send.setAttribute('aria-label', t('chat.send'));
  if (els.close) els.close.setAttribute('aria-label', t('chat.close'));
  if (els.toggle) { els.toggle.setAttribute('aria-label', t('chat.open')); els.toggle.title = t('chat.open'); }
  if (els.fab) { els.fab.setAttribute('aria-label', t('chat.open')); els.fab.title = t('chat.open'); }
  if (els.clear) els.clear.textContent = t('chat.clear');
  if (els.settingsBtn) { els.settingsBtn.setAttribute('aria-label', t('chat.settingsTitle')); els.settingsBtn.title = t('chat.settingsTitle'); els.settingsBtn.style.display = isLocal() ? '' : 'none'; }
  renderChips();
  if (greeted && els.messages) {
    const g = els.messages.querySelector('.chat-greeting');
    if (g) g.textContent = t('chat.greeting');
  }
}

// ---------- 界面 ----------
function ensureGreeting() {
  if (greeted) return;
  greeted = true;
  const el = document.createElement('div');
  el.className = 'chat-bubble ai chat-greeting';
  el.textContent = t('chat.greeting');
  els.messages.appendChild(el);
}

function appendBubble(role, text) {
  const wrap = document.createElement('div');
  wrap.className = `chat-bubble ${role === 'user' ? 'user' : 'ai'}`;
  const inner = document.createElement('div');
  inner.className = 'chat-bubble-inner';
  inner.innerHTML = role === 'user' ? escapeHTML(text).replace(/\n/g, '<br>') : renderMd(text);
  wrap.appendChild(inner);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
  return { wrap, inner };
}

function showThinking(aiEl) {
  const s = document.createElement('span');
  s.className = 'chat-thinking';
  const label = document.createElement('span');
  label.className = 'chat-thinking-label';
  label.textContent = t('chat.thinking');
  const dots = document.createElement('span');
  dots.className = 'chat-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = '<i></i><i></i><i></i>';
  s.appendChild(label);
  s.appendChild(dots);
  aiEl.wrap.appendChild(s);
  return s;
}

function removeThinking(aiEl) {
  const s = aiEl.wrap.querySelector('.chat-thinking');
  if (s) s.remove();
}

function renderChips() {
  if (!els.chips) return;
  const labels = [t('chat.suggest1'), t('chat.suggest2'), t('chat.suggest3'), t('chat.suggest4')];
  els.chips.innerHTML = labels.map((l) => `<button type="button" class="chat-chip" data-q="${escapeAttr(l)}">${escapeHTML(l)}</button>`).join('');
}

function openPanel() {
  els.panel.classList.add('open');
  els.panel.setAttribute('aria-hidden', 'false');
  const isMobile = window.matchMedia('(max-width: 860px)').matches;
  if (!isMobile && els.input) els.input.focus();
}
function closePanel(reason = 'manual') {
  els.panel.classList.remove('open');
  els.panel.setAttribute('aria-hidden', 'true');
  if (settingsOpen()) closeSettings();
  if (controller) { controller.abort(); controller = null; busy = false; setSendState(); }
}

function toggleChat() {
  if (els.panel.classList.contains('open')) closePanel('toggle');
  else openPanel();
}

function setSendState() {
  if (els.send) {
    els.send.disabled = busy;
    els.send.textContent = busy ? t('chat.stop') : t('chat.send');
  }
}

// ---------- 设置面板 ----------
function openSettings() {
  if (els.settings) {
    els.settings.innerHTML = '';
    els.settings.hidden = false;
    els.messages.hidden = true;
    els.chips.hidden = true;
    els.form.hidden = true;
    renderSettings(els.settings, { onChange: () => { renderModeBanner(); }, onBack: closeSettings });
    renderModeBanner();
  }
}
function closeSettings() {
  if (els.settings) {
    els.settings.hidden = true;
    els.settings.innerHTML = '';
    els.messages.hidden = false;
    els.chips.hidden = false;
    els.form.hidden = false;
    renderModeBanner();
  }
}
function settingsOpen() {
  return !!(els.settings && !els.settings.hidden);
}

// 模式横幅：告知当前是本地直连 / 生产 Functions / 未配置
function renderModeBanner() {
  if (!els.subtitle) return;
  if (MOCK) { els.subtitle.textContent = t('chat.modeMock'); return; }
  if (isLocal()) {
    const cfg = loadConfig();
    els.subtitle.textContent = cfg && cfg.apiKey
      ? `${t('chat.modeLocal')} · ${getProvider(cfg.provider).name}`
      : t('chat.modeLocalUnset');
  } else {
    els.subtitle.textContent = t('chat.modeServer');
  }
}

// ---------- 发送 ----------
function send(text) {
  if (busy) return;
  const msg = (text || '').trim();
  if (!msg) return;

  // 本地未配置 Key：引导去设置
  if (!MOCK && isLocal() && !hasUsableConfig()) {
    openSettings();
    return;
  }

  busy = true;
  setSendState();
  els.input.value = '';
  els.chips.innerHTML = '';

  appendBubble('user', msg);
  history.push({ role: 'user', content: msg });

  const aiEl = appendBubble('ai', '');
  const status = showThinking(aiEl);

  if (MOCK) mockReply(aiEl, status, msg);
  else if (isLocal()) directReply(aiEl, status);
  else functionsReply(aiEl, status);
}

// ---- 模式 1：Netlify Functions（服务器 Key） ----
async function functionsReply(aiEl, status) {
  controller = new AbortController();
  let acc = '';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-8), lang: window.__lang || 'zh' }),
      signal: controller.signal,
    });
    if (res.status === 429) throw new ChatError('rate');
    if (res.status === 404) throw new ChatError('offline'); // 本地纯静态服务器无 Netlify Functions
    if (!res.ok || !res.body) throw new ChatError('net');

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let firstDelta = true;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split('\n\n');
      buf = frames.pop(); // 残帧留到下一轮
      for (const f of frames) {
        const line = f.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue; // 跳过 :ping 注释帧
        let ev;
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === 'tool') { status.textContent = t('chat.searching'); }
        if (ev.type === 'delta') {
          if (firstDelta) { removeThinking(aiEl); firstDelta = false; aiEl.wrap.classList.add('is-streaming'); }
          acc += ev.text || '';
          aiEl.inner.innerHTML = renderMd(acc);
          els.messages.scrollTop = els.messages.scrollHeight;
        }
        if (ev.type === 'error') throw new ChatError(ev.code || 'net');
        if (ev.type === 'done') { /* 正常结束 */ }
      }
    }
    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    if (!acc) throw new ChatError('net');
    history.push({ role: 'assistant', content: acc });
  } catch (e) {
    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    aiEl.wrap.classList.add('is-error');
    aiEl.inner.textContent = msgForError(e);
    history.pop(); // 失败的 user 消息不污染上下文
  } finally {
    busy = false;
    controller = null;
    setSendState();
  }
}

// ---- 模式 2：本地 BYOK 直连（前端工具循环 + SSE 流式） ----
async function directReply(aiEl, status) {
  const cfg = loadConfig();
  if (!cfg || !cfg.apiKey) {
    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    aiEl.wrap.classList.add('is-error');
    aiEl.inner.textContent = t('chat.settingsNeedConfig');
    history.pop();
    busy = false; setSendState();
    return;
  }
  if (!toolsReady) {
    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    aiEl.wrap.classList.add('is-error');
    aiEl.inner.textContent = t('chat.error');
    history.pop();
    busy = false; setSendState();
    return;
  }

  const provider = getProvider(cfg.provider);
  const baseUrl = provider.baseUrl.replace(/\/$/, '');
  controller = new AbortController();
  const lang = window.__lang || 'zh';
  const convo = [{ role: 'system', content: buildSystemPrompt(lang) }, ...history.slice(-8)];
  const FETCH_TIMEOUT = 30000; // 30s 硬超时

  // 通用超时包装：即使 fetch/abort 失效也保证不永久挂起
  const withTimeout = (promise, label) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new ChatError('timeout')), FETCH_TIMEOUT)),
    ]).catch((e) => {
      // 超时发生时再尝试 abort（忽略失败）
      try { if (controller) controller.abort('timeout'); } catch {}
      console.warn(`[chat] ${label} timeout`);
      throw e;
    });
  };

  const chat = async (body, label) => {
    const res = await withTimeout(fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    }), label);
    return res;
  };

  const baseBody = {
    model: cfg.model,
    temperature: 0.3,
    max_tokens: 800,
  };
  // DeepSeek V4 默认开思考模式，本地直连时显式关闭以控延迟（其他家忽略该参数）
  if (provider.id === 'deepseek') baseBody.thinking = { type: 'disabled' };

  let acc = '';
  try {
    let done = false;
    // 工具循环：规划轮非流式
    for (let round = 0; round < MAX_TOOL_ROUNDS && !done; round++) {
      const res = await chat({ ...baseBody, messages: convo, tools: TOOL_SCHEMAS, tool_choice: 'auto', stream: false }, 'plan-' + (round + 1));
      if (res.status === 401 || res.status === 403) throw new ChatError('auth');
      if (res.status === 429) throw new ChatError('rate');
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
        console.warn('[chat] upstream error', res.status, detail);
        const err = new ChatError('upstream');
        err.detail = detail;
        throw err;
      }
      let data;
      try { data = await res.json(); } catch (parseErr) {
        console.warn('[chat] JSON parse error', parseErr);
        throw new ChatError('net');
      }
      const msg = data.choices && data.choices[0] && data.choices[0].message;
      if (!msg) throw new ChatError('net');

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const content = (msg.content || '').trim();
        if (content) {
          acc = content;
          removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
          aiEl.inner.innerHTML = renderMd(content);
          els.messages.scrollTop = els.messages.scrollHeight;
          done = true;
          break;
        }
        // 内容为空：走流式兜底
        break;
      }
      convo.push(msg);
      for (const call of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* keep {} */ }
        status.textContent = t('chat.searching');
        const out = runTool(call.function.name, args);
        let content = JSON.stringify(out);
        if (content.length > 6000) content = content.slice(0, 6000) + ',"_truncated":true';
        convo.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content });
      }
    }

    if (!done) {
      // 循环用尽仍要工具，或零工具但 content 为空：强制收口流式
      const res = await chat({ ...baseBody, messages: convo, tool_choice: 'none', stream: true }, 'stream');
      if (res.status === 401 || res.status === 403) throw new ChatError('auth');
      if (res.status === 429) throw new ChatError('rate');
      if (!res.ok || !res.body) throw new ChatError('net');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let firstDelta = true;
      try {
        for (;;) {
          const { value, done: rd } = await withTimeout(reader.read(), 'stream-read');
          if (rd) { break; }
          buf += dec.decode(value, { stream: true });
          // OpenAI SSE 以 \n\n 分隔事件帧
          const frames = buf.split('\n\n');
          buf = frames.pop() || '';
          for (const frame of frames) {
            const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (payload === '[DONE]') { done = true; break; }
            let ev;
            try { ev = JSON.parse(payload); } catch { continue; }
            const delta = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
            if (delta) {
              if (firstDelta) { removeThinking(aiEl); firstDelta = false; aiEl.wrap.classList.add('is-streaming'); }
              acc += delta;
              aiEl.inner.innerHTML = renderMd(acc);
              els.messages.scrollTop = els.messages.scrollHeight;
            }
          }
          if (done) break;
        }
      } catch (streamErr) {
        console.warn('[chat] stream error', streamErr && streamErr.name, streamErr && streamErr.message);
        throw streamErr;
      }
      if (!acc.trim() && firstDelta) throw new ChatError('empty');
    }

    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    if (!acc.trim()) throw new ChatError('net');
    history.push({ role: 'assistant', content: acc });
  } catch (e) {
    console.warn('[chat] directReply catch', e && e.name, e && e.code, e && e.message);
    removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
    aiEl.wrap.classList.add('is-error');
    if (e && (e.name === 'AbortError' || e.code === 'timeout')) {
      aiEl.inner.textContent = msgForError(new ChatError('timeout'));
    } else {
      aiEl.inner.textContent = msgForError(e);
    }
    history.pop();
  } finally {
    busy = false;
    controller = null;
    setSendState();
  }
}

// ---- 模式 0：mock（无 Key 纯 UI 调试） ----
async function mockReply(aiEl, status, msg) {
  status.textContent = t('chat.searching');
  await sleep(350);
  removeThinking(aiEl);
  aiEl.wrap.classList.remove('is-streaming');
  aiEl.wrap.classList.add('is-streaming');
  const demo = window.__lang === 'en'
    ? `Here's what I can tell you:\n\n| Question | Answer |\n|---|---|\n| Golden Boot | **Mbappé** (France) · 10 goals |\n| Champion | **Spain** · beat Argentina 1–0 |\n\n*(mock mode — connect a real API key to go live)*`
    : `我可以回答这些（当前为 mock 模式）：\n\n| 问题 | 答案 |\n|---|---|\n| 金靴 | **姆巴佩**（法国）· 10 球 |\n| 冠军 | **西班牙** · 决赛 1–0 胜阿根廷 |\n\n*（mock 模式——配置真实 API Key 后即可使用）*`;
  let acc = '';
  for (const ch of demo) {
    await sleep(12);
    acc += ch;
    aiEl.inner.innerHTML = renderMd(acc);
    els.messages.scrollTop = els.messages.scrollHeight;
  }
  history.push({ role: 'assistant', content: demo });
  aiEl.wrap.classList.remove('is-streaming');
  busy = false;
  controller = null;
  setSendState();
}

class ChatError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function msgForError(e) {
  if (e && e.code === 'rate') return t('chat.errorRate');
  if (e && e.code === 'auth') return t('chat.errorAuth');
  if (e && e.code === 'timeout') return t('chat.errorTimeout');
  if (e && e.code === 'empty') return t('chat.errorEmpty');
  if (e && e.code === 'upstream') {
    // 上游返回非 2xx：附上简短详情帮助定位（不暴露 Key）
    const d = (e.detail || '').replace(/Bearer sk-[^\s"']+/gi, 'sk-***').slice(0, 120);
    return `${t('chat.errorUpstream')}${d ? ' (' + d + ')' : ''}`;
  }
  if (e && e.code === 'offline') {
    return `${t('chat.errorOffline')} ${location.protocol === 'http:' && !MOCK ? t('chat.errorOfflineHint') : ''}`.trim();
  }
  if (e && e.code === 'no_key') return t('chat.errorNoKey');
  if (e && e.code === 'net') return t('chat.errorNetwork');
  return t('chat.error');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- Markdown 子集渲染（先转义再替换，防 XSS） ----------
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return escapeHTML(s).replace(/&quot;/g, '&quot;');
}

function renderMd(text) {
  let s = escapeHTML(text);
  const tables = [];
  s = s.replace(/^(\|[^\n]*\|)$/gm, (m) => {
    const id = `@@T${tables.length}@@`;
    tables.push(renderTable(m));
    return id;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\n/g, '<br>');
  tables.forEach((tbl, i) => { s = s.replace(`@@T${i}@@`, tbl); });
  return s;
}

function renderTable(mdTable) {
  const rows = mdTable.trim().split('\n').filter((r) => r.trim().startsWith('|'));
  if (rows.length < 2) return mdTable;
  const parse = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = parse(rows[0]);
  const body = rows.slice(1).filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim())).map(parse);
  const html = ['<table><thead><tr>', ...header.map((c) => `<th>${c}</th>`), '</tr></thead><tbody>'];
  for (const r of body) {
    html.push('<tr>', ...r.map((c, i) => `<td>${i === 0 ? '<b>' + c + '</b>' : c}</td>`), '</tr>');
  }
  html.push('</tbody></table>');
  return html.join('');
}

// ---------- 事件 ----------
function bindEvents() {
  if (els.toggle) els.toggle.addEventListener('click', toggleChat);
  if (els.fab) els.fab.addEventListener('click', toggleChat);
  if (els.close) els.close.addEventListener('click', closePanel);
  if (els.settingsBtn) els.settingsBtn.addEventListener('click', openSettings);
  if (els.clear) els.clear.addEventListener('click', () => { els.messages.innerHTML = ''; greeted = false; history = []; ensureGreeting(); });
  if (els.form) els.form.addEventListener('submit', (e) => { e.preventDefault(); });
  if (els.send) els.send.addEventListener('click', (e) => {
    e.preventDefault();
    if (busy && controller) { controller.abort('user-stop'); busy = false; controller = null; setSendState(); }
    else send(els.input.value);
  });
  if (els.input) els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send(els.input.value); }
  });
  if (els.chips) els.chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chat-chip');
    if (btn) send(btn.dataset.q);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.panel && els.panel.classList.contains('open')) {
      if (settingsOpen()) { closeSettings(); return; }
      closePanel('escape');
    }
  });
  document.addEventListener('click', (e) => {
    if (!els.panel) return;
    // 请求进行中时不因误点面板外而关闭
    if (busy) return;
    if (els.panel.classList.contains('open') &&
        !els.panel.contains(e.target) &&
        !(els.toggle && els.toggle.contains(e.target)) &&
        !(els.fab && els.fab.contains(e.target))) {
      if (settingsOpen()) { closeSettings(); return; }
      closePanel('outside-click');
    }
  });
}
