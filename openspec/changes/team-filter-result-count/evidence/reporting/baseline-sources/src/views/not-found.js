// ===== Not Found View =====
import { t } from '../i18n.js';
export default function notFound() {
  const lang = window.__lang || 'zh';
  return `
    <div class="loading" style="padding:4rem">
      <div style="font-size:4rem;font-weight:900;color:var(--text-muted)">404</div>
      <p style="margin-top:1rem">${lang === 'zh' ? '页面未找到' : 'Page not found'}</p>
      <a href="#/" class="back-link" style="margin-top:1rem">${lang === 'zh' ? '返回首页' : 'Back to Home'}</a>
    </div>`;
}
