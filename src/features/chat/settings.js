// ===== Chat Settings (BYOK) =====
// 用户自带 Key 配置：7 家国内主流 OpenAI 兼容服务商。
// 仅本地模式（localhost/127.0.0.1）允许填写 Key，存 localStorage。
// Netlify 生产模式固定走 Functions（服务器 Key），不提供设置入口。
// 语音设置是跨模式能力（本地/线上都可用），故放在 isLocal() 守卫之外。
import { t } from '../../i18n.js';
import { ttsSupported, sttSupported, getVoices, onVoicesChanged } from './voice.js';

const STORE_KEY = 'wc2026-chat-config';

// 7 家服务商（排除百度文心一言——AK/SK 双密钥鉴权，不兼容 OpenAI 格式）
export const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-flash',
    desc: '深度求索',
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    defaultModel: 'qwen-plus',
    desc: '阿里云百炼',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.6', 'moonshot-v1-128k'],
    defaultModel: 'kimi-k2.6',
    desc: '月之暗面',
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.1', 'glm-5', 'glm-4.6'],
    defaultModel: 'glm-5.1',
    desc: '智谱AI',
  },
  {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-1.5-pro-32k-250115', 'doubao-1.5-lite-32k-250115'],
    defaultModel: 'doubao-1.5-pro-32k-250115',
    desc: '火山方舟（如需用推理模型可填对应 endpoint id）',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.7'],
    defaultModel: 'MiniMax-M2.7',
    desc: '稀宇科技',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-turbos-latest', 'hunyuan-large'],
    defaultModel: 'hunyuan-turbos-latest',
    desc: '腾讯云',
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

// 环境检测：本地（BYOK 直连）vs 线上（Netlify Functions）
export function isLocal() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

// 配置结构：{ provider, apiKey, model }
export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    const p = getProvider(c.provider);
    return {
      provider: p.id,
      apiKey: typeof c.apiKey === 'string' ? c.apiKey : '',
      model: p.models.includes(c.model) ? c.model : p.defaultModel,
      voiceOut: !!c.voiceOut,
      voiceIn: !!c.voiceIn,
      ttsVoice: typeof c.ttsVoice === 'string' ? c.ttsVoice : '',
      ttsRate: (typeof c.ttsRate === 'number') ? c.ttsRate : 1,
    };
  } catch (e) {
    return null;
  }
}

export function saveConfig(cfg) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearConfig() {
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
}

// 是否有可用配置（本地模式 + Key 非空）
export function hasUsableConfig() {
  if (!isLocal()) return false;
  const c = loadConfig();
  return !!(c && c.apiKey && c.apiKey.trim());
}

// 构建设置面板 DOM（挂在聊天面板内）。onChange 在保存后回调，onBack 在点击返回时回调。
export function renderSettings(container, { onChange, onBack } = {}) {
  const cfg = loadConfig();
  const current = cfg ? getProvider(cfg.provider) : PROVIDERS[0];
  const model = cfg ? cfg.model : current.defaultModel;

  const wrap = document.createElement('div');
  wrap.className = 'chat-settings';

  // 所有配置控件的引用（语音 + Key），供统一的 gatherConfig 使用
  let sel = null;
  let modelSel = null;
  let keyInput = null;
  let inChk = null;
  let outChk = null;
  let voiceSel = null;
  let rateInput = null;

  // 从当前面板读取完整配置（无论点哪个保存按钮都生效）
  function gatherConfig() {
    const voiceCfg = {
      voiceOut: outChk ? outChk.checked : false,
      voiceIn: inChk ? inChk.checked : false,
      ttsVoice: voiceSel ? voiceSel.value : '',
      ttsRate: (rateInput && parseFloat(rateInput.value)) || 1,
    };
    if (isLocal() && sel && keyInput && modelSel) {
      const p = getProvider(sel.value);
      return {
        provider: p.id,
        apiKey: keyInput.value.trim(),
        model: modelSel.value,
        ...voiceCfg,
      };
    }
    // 线上模式：保留已有的 provider/apiKey/model（即使线上不用，也避免误清空）
    const prev = loadConfig() || {};
    return {
      provider: prev.provider || 'deepseek',
      apiKey: prev.apiKey || '',
      model: prev.model || '',
      ...voiceCfg,
    };
  }

  const titleRow = document.createElement('div');
  titleRow.className = 'chat-settings-title-row';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'chat-settings-back';
  backBtn.setAttribute('aria-label', t('chat.settingsBack'));
  backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onBack) onBack();
  });
  const title = document.createElement('div');
  title.className = 'chat-settings-title';
  title.textContent = t('chat.settingsTitle');
  titleRow.appendChild(backBtn);
  titleRow.appendChild(title);
  wrap.appendChild(titleRow);

  // ---- 语音设置（本地与线上均可见）----
  const cfgNow = loadConfig() || {};
  const vTitle = document.createElement('div');
  vTitle.className = 'chat-settings-subtitle';
  vTitle.textContent = t('chat.voiceSettings');
  wrap.appendChild(vTitle);

  // 语音输入开关
  const inLabel = document.createElement('label');
  inLabel.className = 'chat-settings-check';
  inChk = document.createElement('input');
  inChk.type = 'checkbox';
  inChk.checked = !!cfgNow.voiceIn;
  if (!sttSupported()) inChk.disabled = true;
  const inSpan = document.createElement('span');
  inSpan.textContent = t('chat.voiceIn');
  inLabel.appendChild(inChk);
  inLabel.appendChild(inSpan);
  wrap.appendChild(inLabel);
  if (!sttSupported()) {
    const hint = document.createElement('div');
    hint.className = 'chat-settings-warn';
    hint.textContent = t('chat.voiceSttUnsupported');
    wrap.appendChild(hint);
  }

  // 语音播报开关
  const outLabel = document.createElement('label');
  outLabel.className = 'chat-settings-check';
  outChk = document.createElement('input');
  outChk.type = 'checkbox';
  outChk.checked = !!cfgNow.voiceOut;
  if (!ttsSupported()) outChk.disabled = true;
  const outSpan = document.createElement('span');
  outSpan.textContent = t('chat.voiceOut');
  outLabel.appendChild(outChk);
  outLabel.appendChild(outSpan);
  wrap.appendChild(outLabel);

  // 音色选择
  const voiceLabel = document.createElement('label');
  voiceLabel.className = 'chat-settings-label';
  voiceLabel.textContent = t('chat.ttsVoice');
  voiceSel = document.createElement('select');
  voiceSel.className = 'chat-settings-input';
  const fillVoices = () => {
    voiceSel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = t('chat.ttsVoiceDefault');
    voiceSel.appendChild(noneOpt);
    const voices = getVoices();
    const tag = window.__lang || 'zh';
    const baseLang = (l) => (l || '').replace(/-/g, '').slice(0, 2).toLowerCase();
    const matchLang = (v) => baseLang(v.lang) === baseLang(tag);
    let matched = false;
    voices.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name;
      o.textContent = `${v.name} (${v.lang})`;
      // 仅当已存音色与全站语言一致时保持选中，否则交给下面的默认同语言音色
      if (v.name === cfgNow.ttsVoice && matchLang(v)) { o.selected = true; matched = true; }
      voiceSel.appendChild(o);
    });
    // 已存音色为空或与全站语言不一致时，默认选中一个同语言音色，使下拉与全站语言一致
    if (!matched) {
      const first = voices.find(matchLang);
      if (first) voiceSel.value = first.name;
    }
  };
  fillVoices();
  onVoicesChanged(fillVoices);
  voiceLabel.appendChild(voiceSel);
  wrap.appendChild(voiceLabel);

  // 语速
  const curRate = (typeof cfgNow.ttsRate === 'number') ? cfgNow.ttsRate : 1;
  const rateLabel = document.createElement('label');
  rateLabel.className = 'chat-settings-label';
  rateLabel.textContent = `${t('chat.ttsRate')} (${curRate.toFixed(1)}x)`;
  rateInput = document.createElement('input');
  rateInput.type = 'range';
  rateInput.min = '0.5';
  rateInput.max = '2';
  rateInput.step = '0.1';
  rateInput.value = String(curRate);
  rateInput.className = 'chat-settings-range';
  rateInput.addEventListener('input', () => {
    rateLabel.textContent = `${t('chat.ttsRate')} (${parseFloat(rateInput.value).toFixed(1)}x)`;
  });
  rateLabel.appendChild(rateInput);
  wrap.appendChild(rateLabel);

  // 保存语音设置
  const vBtnRow = document.createElement('div');
  vBtnRow.className = 'chat-settings-actions';
  const vSave = document.createElement('button');
  vSave.type = 'button';
  vSave.className = 'chat-settings-btn primary';
  vSave.textContent = t('chat.voiceSave');
  vBtnRow.appendChild(vSave);
  wrap.appendChild(vBtnRow);
  const vStatus = document.createElement('div');
  vStatus.className = 'chat-settings-status';
  wrap.appendChild(vStatus);
  if (!ttsSupported()) {
    const hint2 = document.createElement('div');
    hint2.className = 'chat-settings-warn';
    hint2.textContent = t('chat.voiceTtsUnsupported');
    wrap.appendChild(hint2);
  }
  vSave.addEventListener('click', () => {
    const merged = gatherConfig();
    if (saveConfig(merged)) {
      vStatus.textContent = t('chat.voiceSaved');
      vStatus.className = 'chat-settings-status ok';
      if (onChange) onChange();
    } else {
      vStatus.textContent = t('chat.settingsSaveFail');
      vStatus.className = 'chat-settings-status error';
    }
  });

  // 仅本地模式显示 Key 表单
  if (isLocal()) {
    const label = document.createElement('label');
    label.className = 'chat-settings-label';
    label.textContent = t('chat.settingsProvider');
    sel = document.createElement('select');
    sel.className = 'chat-settings-input';
    PROVIDERS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}（${p.desc}）`;
      if (p.id === current.id) opt.selected = true;
      sel.appendChild(opt);
    });
    label.appendChild(sel);
    wrap.appendChild(label);

    const modelLabel = document.createElement('label');
    modelLabel.className = 'chat-settings-label';
    modelLabel.textContent = t('chat.settingsModel');
    modelSel = document.createElement('select');
    modelSel.className = 'chat-settings-input';
    current.models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === model) opt.selected = true;
      modelSel.appendChild(opt);
    });
    modelLabel.appendChild(modelSel);
    wrap.appendChild(modelLabel);

    const keyLabel = document.createElement('label');
    keyLabel.className = 'chat-settings-label';
    keyLabel.textContent = t('chat.settingsApiKey');
    keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'chat-settings-input';
    keyInput.placeholder = 'sk-...';
    keyInput.value = cfg ? cfg.apiKey : '';
    keyInput.autocomplete = 'off';
    keyLabel.appendChild(keyInput);
    wrap.appendChild(keyLabel);

    const hint = document.createElement('div');
    hint.className = 'chat-settings-warn';
    hint.textContent = t('chat.settingsKeyWarning');
    wrap.appendChild(hint);

    const btnRow = document.createElement('div');
    btnRow.className = 'chat-settings-actions';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'chat-settings-btn';
    testBtn.textContent = t('chat.settingsTest');
    btnRow.appendChild(testBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'chat-settings-btn primary';
    saveBtn.textContent = t('chat.settingsSave');
    btnRow.appendChild(saveBtn);
    wrap.appendChild(btnRow);

    const status = document.createElement('div');
    status.className = 'chat-settings-status';
    wrap.appendChild(status);

    // 切换服务商时刷新模型下拉
    sel.addEventListener('change', () => {
      const p = getProvider(sel.value);
      modelSel.innerHTML = '';
      p.models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === p.defaultModel) opt.selected = true;
        modelSel.appendChild(opt);
      });
    });

    testBtn.addEventListener('click', async () => {
      const p = getProvider(sel.value);
      const key = keyInput.value.trim();
      if (!key) { status.textContent = t('chat.settingsKeyMissing'); status.className = 'chat-settings-status error'; return; }
      status.textContent = t('chat.settingsTesting');
      status.className = 'chat-settings-status';
      const okRes = await testConnection(p, key, modelSel.value);
      status.textContent = okRes ? t('chat.settingsTestOk') : t('chat.settingsTestFail');
      status.className = okRes ? 'chat-settings-status ok' : 'chat-settings-status error';
    });

    saveBtn.addEventListener('click', () => {
      const cfg2 = gatherConfig();
      if (saveConfig(cfg2)) {
        status.textContent = t('chat.settingsSaved');
        status.className = 'chat-settings-status ok';
        if (onChange) onChange();
      } else {
        status.textContent = t('chat.settingsSaveFail');
        status.className = 'chat-settings-status error';
      }
    });
  } else {
    // 线上模式：提示由站长配置，无表单
    const info = document.createElement('div');
    info.className = 'chat-settings-warn';
    info.textContent = t('chat.settingsServerMode');
    wrap.appendChild(info);
  }

  container.appendChild(wrap);
  return wrap;
}

// 测试连接：发一个最小 chat 请求（非流式，max_tokens=1），15s 超时
export async function testConnection(provider, apiKey, model) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
