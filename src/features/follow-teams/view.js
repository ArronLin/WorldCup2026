import { t } from '../../i18n.js';
export function renderFollowNotice(snapshot) {
  const messages = [];
  if (snapshot.restoreIssue) messages.push(t('follow.restore.' + snapshot.restoreIssue));
  if (snapshot.saveIssue) messages.push(t('follow.saveFailed'));
  return messages.length ? '<p class="follow-notice" role="status">' + messages.join(' · ') + '</p>' : '';
}
export function renderDataError(snapshot) {
  return '<div class="follow-empty"><h2>' + t('follow.loadError') + '</h2>' + renderFollowNotice(snapshot) +
    '<button type="button" class="filter-btn" data-follow-action="retry" data-follow-focus="follow-retry">' + t('follow.retry') + '</button></div>';
}
