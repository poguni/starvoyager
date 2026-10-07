// 확인 대화 상자(components.css의 .sv-dialog). 누른 버튼에 따라 true/false로 끝나는 Promise를 돌려준다.
import { el } from './dom.js';
import { primaryButton, secondaryButton } from './buttons.js';

export function confirmDialog({ title, message, confirmLabel, cancelLabel = '취소', container = document.body }) {
  return new Promise((resolve) => {
    const close = (result) => {
      backdrop.remove();
      resolve(result);
    };
    const cancel = secondaryButton({ label: cancelLabel, onClick: () => close(false) });
    const confirm = primaryButton({ label: confirmLabel, onClick: () => close(true) });
    const dialog = el('div', { class: 'sv-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('h2', {}, title),
      el('p', {}, message),
      el('div', { class: 'sv-dialog-actions' }, [cancel, confirm])
    ]);
    const backdrop = el('div', { class: 'sv-dialog-backdrop' }, dialog);
    backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    container.append(backdrop);
    cancel.focus();
  });
}
