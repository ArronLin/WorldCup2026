const controllers = new WeakMap();

// The app owns this delegated listener; disposal permits a clean reinitialization.
export function initTeamsFilter(root) {
  if (controllers.has(root)) return controllers.get(root);
  const syncGroups = reset => {
    const choices = [...root.querySelectorAll('[data-group-choice]')];
    if (reset) {
      choices.forEach(choice => { choice.checked = choice.value === ''; });
    }
    const codes = new Set(choices.filter(choice => choice.checked && choice.value).map(choice => choice.value));
    choices.find(choice => choice.value === '').checked = codes.size === 0;
    root.querySelector('[data-clear-team-groups]').hidden = codes.size === 0;
    for (const group of root.querySelectorAll('[data-team-group]')) {
      group.hidden = codes.size > 0 && !codes.has(group.dataset.teamGroup);
    }
  };
  const onChange = event => {
    if (!event.target.matches('[data-group-choice]')) return;
    syncGroups(event.target.value === '' && event.target.checked);
  };
  const onClear = event => {
    const button = event.target.closest('[data-clear-team-groups]');
    if (!button || button.hidden) return;
    syncGroups(true);
    root.querySelector('.teams-filter summary').focus();
  };
  const onOutsideClick = event => {
    for (const panel of root.querySelectorAll('.teams-filter[open]')) {
      if (!panel.contains(event.target)) panel.open = false;
    }
  };
  const ownerDocument = root.ownerDocument;
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClear);
  ownerDocument.addEventListener('click', onOutsideClick, true);
  const dispose = () => {
    root.removeEventListener('change', onChange);
    root.removeEventListener('click', onClear);
    ownerDocument.removeEventListener('click', onOutsideClick, true);
    controllers.delete(root);
  };
  controllers.set(root, dispose);
  return dispose;
}

