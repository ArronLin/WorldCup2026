// ===== Voice I/O via Web Speech API (pure client-side, no backend) =====
// - STT: window.SpeechRecognition / webkitSpeechRecognition
// - TTS: window.speechSynthesis
// Graceful degradation: if a capability is missing, the UI hides the control
// and the helper functions become no-ops.
const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
const synth = (typeof window !== 'undefined') && window.speechSynthesis;

export function sttSupported() { return !!SR; }
export function ttsSupported() { return !!synth; }

// App locale ('zh' | 'en' | ...) -> BCP-47 tag for speech engines.
function langTag(lang) {
  if (lang === 'en') return 'en-US';
  if (lang === 'zh') return 'zh-CN';
  return (lang && String(lang).replace('_', '-')) || 'zh-CN';
}

function clampRate(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.5, n));
}

// Strip markdown so the spoken text is readable (no tables / asterisks / pipes).
function stripForSpeech(s) {
  return String(s)
    .replace(/\|[^\n]*\|/g, ' ')        // table rows
    .replace(/[#*_`>~]/g, ' ')          // common md markers
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- STT ----
// createSTT({ lang, onFinal, onInterim, onState, onError }) -> { start, stop, active }
export function createSTT({ lang = 'zh', onFinal, onInterim, onState, onError } = {}) {
  if (!SR) {
    if (onError) onError(new Error('stt-unsupported'));
    return { start() {}, stop() {}, get active() { return false; } };
  }
  let recognition = null;
  let active = false;

  const stop = () => {
    if (recognition) { try { recognition.stop(); } catch { /* ignore */ } }
    active = false;
    if (onState) onState(false);
  };

  const start = () => {
    if (active) return;
    try { recognition = new SR(); } catch (e) { if (onError) onError(e); return; }
    recognition.lang = langTag(lang);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { active = true; if (onState) onState(true); };
    recognition.onend = () => { active = false; if (onState) onState(false); };
    recognition.onerror = (e) => { active = false; if (onState) onState(false); if (onError) onError(e.error || e); };
    recognition.onresult = (ev) => {
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (interim && onInterim) onInterim(interim);
      if (finalText) {
        if (onFinal) onFinal(finalText.trim());
        stop();
      }
    };
    try { recognition.start(); }
    catch (e) { if (onError) onError(e); }
  };

  return { start, stop, get active() { return active; } };
}

// ---- TTS ----
// createTTS() -> { speak(text, opts), cancel(), speaking() }
export function createTTS() {
  let current = null;
  const speak = (text, { voice = null, rate = 1 } = {}) => {
    if (!synth || !text) return;
    cancel();
    const u = new SpeechSynthesisUtterance(stripForSpeech(text));
    const tag = langTag(window.__lang || 'zh');
    // 朗读语言始终以全站语言（window.__lang）为准，确保与整个应用一致
    u.lang = tag;
    if (voice) {
      const v = synth.getVoices().find((x) => x.name === voice);
      const baseLang = (l) => (l || '').replace(/-/g, '').slice(0, 2).toLowerCase();
      // 仅当用户所选音色语言与全站语言一致时才启用，否则跟随全站语言（引擎自动选音色）
      if (v && baseLang(v.lang) === baseLang(tag)) {
        u.voice = v;
        u.lang = v.lang;
      }
    }
    u.rate = clampRate(rate);
    current = u;
    synth.speak(u);
  };
  const cancel = () => {
    if (synth) { try { synth.cancel(); } catch { /* ignore */ } }
    current = null;
  };
  const speaking = () => !!synth && synth.speaking;
  return { speak, cancel, speaking };
}

// Available TTS voices (may be empty until 'voiceschanged' fires).
export function getVoices() {
  if (!synth) return [];
  return synth.getVoices() || [];
}
export function onVoicesChanged(cb) {
  if (!synth) return () => {};
  synth.addEventListener('voiceschanged', cb);
  return () => synth.removeEventListener('voiceschanged', cb);
}
