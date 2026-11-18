/**
 * ExportUI — 导出日志 UI 组件
 * 创建包含"导出日志"按钮和状态区域的 DOM 片段，
 * 执行浏览器能力检测并绑定控制器。
 */

import { t } from '../../i18n.js';
import { initExportButton } from './controller.js';

/**
 * 检测当前浏览器是否支持所需的文件下载 API。
 *
 * @returns {boolean}
 */
function isBrowserSupported() {
  return (
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

/**
 * 创建并返回"导出日志"区块的 HTMLElement。
 *
 * 返回的元素可直接追加到设置面板容器中。
 * - 若浏览器支持 Blob + URL.createObjectURL，则调用 initExportButton 绑定导出逻辑。
 * - 若不支持，则禁用按钮并在旁边显示说明文字。
 *
 * @returns {HTMLDivElement}
 */
export function renderExportSection() {
  const section = document.createElement('div');
  section.className = 'export-logs-section';

  const buttonEl = document.createElement('button');
  buttonEl.type = 'button';
  buttonEl.className = 'chat-settings-btn';
  buttonEl.textContent = t('exportLogs.button');

  const statusEl = document.createElement('span');
  statusEl.className = 'export-logs-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  // 初始为空，由控制器在操作过程中填充
  statusEl.textContent = '';

  section.appendChild(buttonEl);
  section.appendChild(statusEl);

  if (!isBrowserSupported()) {
    buttonEl.disabled = true;
    const unsupportedEl = document.createElement('span');
    unsupportedEl.className = 'export-logs-unsupported';
    unsupportedEl.textContent = t('exportLogs.unsupported');
    section.appendChild(unsupportedEl);
  } else {
    section.dispose = initExportButton(buttonEl, statusEl);
  }

  return section;
}
