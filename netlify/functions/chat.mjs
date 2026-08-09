// netlify/functions/chat.mjs
// Netlify Functions v2 流式入口：/ .netlify/functions/chat
// 职责：请求校验裁剪 → 三层限流 → DeepSeek 工具循环（规划轮非流式 + 最终答案流式）→ SSE 输出。
// 环境变量：DEEPSEEK_API_KEY(必需), DEEPSEEK_MODEL(默认 deepseek-v4-flash),
//           CHAT_IP_DAILY_CAP(默认60), CHAT_MAX_TOKENS(默认800), CHAT_GLOBAL_DAILY_CAP(默认800)
import { TOOL_SCHEMAS, runTool } from "./_tools.mjs";
import { buildSystemPrompt } from "./_prompt.mjs";

const API = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const MAX_TOKENS = Number(process.env.CHAT_MAX_TOKENS || 800);
const IP_DAILY_CAP = Number(process.env.CHAT_IP_DAILY_CAP || 60);
const GLOBAL_DAILY_CAP = Number(process.env.CHAT_GLOBAL_DAILY_CAP || 800);
const MAX_TOOL_ROUNDS = 3;
const BUDGET_MS = 8500; // 留余量给收尾，Netlify 流式硬上限 ~10s
const BURST_CAP = 5;
const BURST_REFILL_MS = 12000;

// ============ 限流（内存桶，尽力而为；Serverless 实例会回收/横向扩容） ============
const burst = new Map();   // ip -> tokens
const daily = new Map();   // ip -> { day, used }
const lastSeen = new Map(); // ip -> timestamp（用于清理）
let globalUsed = 0;
let globalDay = today();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sweep() {
  const now = Date.now();
  for (const [k, t] of lastSeen) {
    if (now - t > 24 * 3600 * 1000) {
      burst.delete(k); daily.delete(k); lastSeen.delete(k);
    }
  }
  if (burst.size > 5000) { burst.clear(); daily.clear(); lastSeen.clear(); }
  if (globalDay !== today()) { globalDay = today(); globalUsed = 0; }
}

function takeBurstToken(ip) {
  const now = Date.now();
  const last = lastSeen.get(ip) || now;
  const tokens = Math.min(BURST_CAP, (burst.get(ip) || BURST_CAP) + (now - last) / BURST_REFILL_MS);
  if (tokens < 1) return false;
  burst.set(ip, tokens - 1);
  lastSeen.set(ip, now);
  return true;
}

function checkRateLimit(ip) {
  sweep();
  const day = today();
  if (globalDay !== day) { globalDay = day; globalUsed = 0; }
  if (globalUsed >= GLOBAL_DAILY_CAP) return { limited: true, retryAfter: 3600 };
  const rec = daily.get(ip);
  if (rec && rec.day === day && rec.used >= IP_DAILY_CAP) {
    return { limited: true, retryAfter: 60 };
  }
  if (!takeBurstToken(ip)) return { limited: true, retryAfter: 60 };
  if (!rec || rec.day !== day) daily.set(ip, { day, used: 1 });
  else rec.used++;
  globalUsed++;
  return { limited: false };
}

// ============ SSE 辅助 ============
function sseFrame(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// ============ 请求处理 ============
function readBody(req, maxBytes) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) return { tooLarge: true };
  return { promise: req.text() };
}

function validateInput(body) {
  if (!body || typeof body !== "object") return { error: "invalid body" };
  const { messages, lang } = body;
  if (!Array.isArray(messages) || messages.length === 0) return { error: "messages required" };
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 600) }));
  if (clean.length === 0) return { error: "no valid messages" };
  const l = lang === "en" ? "en" : "zh";
  return { messages: clean, lang: l };
}

// ============ DeepSeek 调用 ============
async function callDeepSeek({ messages, stream = false, tool_choice = "auto", signal }) {
  const body = {
    model: MODEL,
    messages,
    tools: TOOL_SCHEMAS,
    tool_choice,
    thinking: { type: "disabled" }, // V4 默认开思考，必须显式关闭以控延迟
    temperature: 0.3,
    max_tokens: MAX_TOKENS,
    stream,
  };
  if (stream) delete body.tools; // 最终流式轮不需要 tools（tool_choice=none 收口）
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  return res;
}

// 解析上游 SSE 块（处理网络分片）
function parseSSEChunk(buf) {
  const frames = [];
  let start = 0;
  while (true) {
    const idx = buf.indexOf("\n\n", start);
    if (idx === -1) break;
    const frame = buf.slice(start, idx);
    start = idx + 2;
    const line = frame.split("\n").find((l) => l.startsWith("data:"));
    if (!line || line.trim() === "data: [DONE]") {
      if (line && line.trim() === "data: [DONE]") frames.push({ done: true });
      continue;
    }
    try { frames.push(JSON.parse(line.slice(5).trim())); }
    catch { /* 坏行静默跳过 */ }
  }
  return { frames, rest: buf.slice(start) };
}

// ============ DeepSeek 内联工具调用兜底解析 ============
// 部分模型/变体会把工具调用写成内联文本（<｜DSML｜｜tool_calls> ... <｜DSML｜｜invoke name="fn"> ...），
// 而非 OpenAI 结构化 tool_calls。下面负责把它解析回 {name, args}，避免把原始标记当答案泄漏给用户。
function parseLegacyToolCalls(content) {
  const calls = [];
  if (!content || !/invoke\s+name=/.test(content)) return calls;
  const invokeRe = /invoke\s+name="([^"]+)"\s*>([\s\S]*?)(?=<invoke\s+name=|<[^>]*invoke>|$)/g;
  let m;
  while ((m = invokeRe.exec(content)) !== null) {
    const name = m[1];
    const body = m[2];
    const args = {};
    const paramRe = /<[^>]*parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*parameter\s*>/g;
    let p;
    while ((p = paramRe.exec(body)) !== null) {
      const key = p[1];
      let val = p[2].trim();
      if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      args[key] = val;
    }
    calls.push({ name, args });
  }
  return calls;
}

// 把可能混入答案正文的内联工具标记整体剔除（仅在兜底直答时使用）
function sanitizeLegacy(content) {
  if (!content) return content;
  const idx = content.search(/<\s*[｜DSML]*\s*tool_calls/);
  return (idx === -1 ? content : content.slice(0, idx)).trim();
}

// 流式收口轮的安全网：剔除任何残留的 <｜DSML｜｜...> 类标记（含其参数值）
function stripMarkers(s) {
  if (!s) return s;
  return s
    .replace(/<[^>]*parameter[^>]*>[\s\S]*?<\/[^>]*parameter[^>]*>/g, "")
    .replace(/<\/?\s*[｜DSML]*\s*(invoke|tool_calls)[^>]*>/g, "")
    .replace(/\btool_calls\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ============ 主处理 ============
export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "unknown";

  // 限流
  const rl = checkRateLimit(ip);
  if (rl.limited) {
    return new Response(JSON.stringify({ error: "rate_limited", retryAfter: rl.retryAfter }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) },
    });
  }

  // 读 body（20KB 上限）
  const { promise, tooLarge } = readBody(req, 20 * 1024);
  if (tooLarge) return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413, headers: { "Content-Type": "application/json" } });
  let raw;
  try { raw = await promise; } catch { return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  const input = validateInput(parsed);
  if (input.error) return new Response(JSON.stringify({ error: input.error }), { status: 400, headers: { "Content-Type": "application/json" } });

  const { messages, lang } = input;

  // Key 检查
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(sseFrame({ type: "error", code: "no_key" }) + "\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" },
    });
  }

  const encoder = new TextEncoder();
  const controller = new AbortController();
  const budgetTimer = setTimeout(() => controller.abort("budget"), BUDGET_MS);

  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (obj) => { try { ctrl.enqueue(encoder.encode(sseFrame(obj))); } catch {} };
      emit({ type: "ping" }); // 注释帧，强制刷新首字节
      try {
        const convo = [{ role: "system", content: buildSystemPrompt(lang) }, ...messages];
        let answer = "";
        let finalStream = null;

        // ---- 工具循环 ----
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const res = await callDeepSeek({ messages: convo, stream: false, tool_choice: "auto", signal: controller.signal });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            console.error(`[chat] upstream ${res.status}:`, detail.slice(0, 500));
            if (res.status === 429) { emit({ type: "error", code: "upstream_rate" }); }
            else { emit({ type: "error", code: "upstream" }); }
            emit({ type: "done" });
            return;
          }
          const data = await res.json();
          const msg = data.choices && data.choices[0] && data.choices[0].message;
          if (!msg) {
            emit({ type: "error", code: "upstream" });
            emit({ type: "done" });
            return;
          }

          // 提取工具调用：优先 OpenAI 结构化，其次 DeepSeek 内联 <｜DSML｜｜> 格式
          let calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
          if (calls.length === 0 && /invoke\s+name=/.test(msg.content || "")) {
            calls = parseLegacyToolCalls(msg.content).map((c, i) => ({
              id: "legacy-" + i,
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            }));
          }

          if (calls.length === 0) {
            // 零工具直答：短路（先剥离可能残留的内联工具标记，避免泄漏）
            answer = sanitizeLegacy(msg.content || "");
            emit({ type: "delta", text: answer });
            emit({ type: "done" });
            return;
          }

          // 有工具调用：执行并回填
          convo.push({
            role: "assistant",
            content: msg.content || null,
            tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.function.name, arguments: c.function.arguments } })),
          });
          for (const call of calls) {
            let args = {};
            try { args = JSON.parse(call.function.arguments || "{}"); } catch {}
            emit({ type: "tool", name: call.function.name });
            const out = runTool(call.function.name, args);
            let content = JSON.stringify(out);
            if (content.length > 6000) content = content.slice(0, 6000) + ',"_truncated":true';
            convo.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content });
          }
        }

        // ---- 循环用尽仍在要工具：强制收口 ----
        finalStream = await callDeepSeek({ messages: convo, stream: true, tool_choice: "none", signal: controller.signal });
        if (!finalStream.ok) {
          console.error(`[chat] final upstream ${finalStream.status}`);
          emit({ type: "error", code: "upstream" });
          emit({ type: "done" });
          return;
        }
        const reader = finalStream.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const { frames, rest } = parseSSEChunk(buf);
          buf = rest;
          for (const f of frames) {
            if (f.done) continue;
            const delta = f.choices && f.choices[0] && f.choices[0].delta && (f.choices[0].delta.content || "");
            if (delta) { const clean = stripMarkers(delta); if (clean) { acc += clean; emit({ type: "delta", text: clean }); } }
          }
        }
        emit({ type: "done" });
      } catch (e) {
        console.error("[chat] error:", e && e.message ? e.message : e);
        if (e && e.name === "AbortError") {
          emit({ type: "delta", text: lang === "zh" ? "…（回答被截断）" : "…(truncated)" });
          emit({ type: "done" });
        } else {
          emit({ type: "error", code: "internal" });
          emit({ type: "done" });
        }
      } finally {
        clearTimeout(budgetTimer);
        try { ctrl.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
