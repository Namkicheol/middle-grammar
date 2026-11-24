/* Input questions for the supplemental verb-form set. */
window.SoloInput = {
  matches(q) { return q?.type === 'input' && /^g1_verb_forms_/.test(q.id || ''); },
  value(q, value) { const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); return norm(value) === norm(q.ans) ? q.ans : value.trim(); },
  render(container, q, submit) {
    const form = document.createElement('form');
    form.className = 'solo-input-form';
    form.style.cssText = 'display:flex;gap:8px;grid-column:1/-1;width:100%;align-items:stretch';
    const input = document.createElement('input');
    input.type = 'text'; input.autocomplete = 'off'; input.autocapitalize = 'none'; input.spellcheck = false;
    input.placeholder = '영어 단어 입력'; input.setAttribute('aria-label', '정답 입력');
    input.style.cssText = 'min-width:0;flex:1;font-size:16px;min-height:44px;padding:8px 10px;border:2px solid #94a3b8;border-radius:8px;color:#182438;background:white';
    const button = document.createElement('button'); button.type = 'submit'; button.textContent = '확인';
    button.style.cssText = 'min-width:58px;min-height:44px;padding:8px;border:0;border-radius:8px;background:#2563eb;color:white;font-weight:700';
    form.addEventListener('keydown', e => e.stopPropagation());
    form.addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); if (!input.value.trim()) { input.focus(); return; } const value = this.value(q, input.value); submit(value, button); });
    form.append(input, button); container.append(form);
    requestAnimationFrame(() => { if (form.isConnected && !matchMedia('(pointer: coarse)').matches) input.focus({preventScroll:true}); });
    return form;
  }
};
