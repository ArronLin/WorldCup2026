const controllers = new WeakMap();

// The app owns this delegated listener; disposal permits a clean reinitialization.
export function initTeamsFilter(root) {
  if (controllers.has(root)) return controllers.get(root);
  const onChange = event => {
    if (!event.target.matches('[data-group-choice]')) return;
    const choices = [...root.querySelectorAll('[data-group-choice]')];
    if (event.target.value === '' && event.target.checked) {
      choices.forEach(choice => { choice.checked = choice.value === ''; });
    }
    const codes = new Set(choices.filter(choice => choice.checked && choice.value).map(choice => choice.value));
    choices.find(choice => choice.value === '').checked = codes.size === 0;
    for (const group of root.querySelectorAll('[data-team-group]')) {
      group.hidden = codes.size > 0 && !codes.has(group.dataset.teamGroup);
    }
  };
  const onOutsideClick = event => {
    for (const panel of root.querySelectorAll('.teams-filter[open]')) {
      if (!panel.contains(event.target)) panel.open = false;
    }
  };
  const ownerDocument = root.ownerDocument;
  root.addEventListener('change', onChange);
  ownerDocument.addEventListener('click', onOutsideClick, true);
  const dispose = () => {
    root.removeEventListener('change', onChange);
    ownerDocument.removeEventListener('click', onOutsideClick, true);
    controllers.delete(root);
  };
  controllers.set(root, dispose);
  return dispose;
}

