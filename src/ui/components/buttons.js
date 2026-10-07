// 버튼 부품(components.css의 .sv-ctl / .sv-primary / .sv-secondary / .sv-ghost).
// 상태는 접근성 속성으로 표시한다: 켜짐 aria-pressed="true", 잠김 disabled, 눌러 보라는 안내 .is-cue
import { el } from './dom.js';
import { icon } from './icon.js';

// 하단 조작 버튼(아이콘 + 글자).
export function controlButton({ iconName, label, disabled = false, cue = false, onClick }) {
  return el('button', {
    type: 'button',
    class: cue ? 'sv-ctl is-cue' : 'sv-ctl',
    disabled,
    onclick: onClick
  }, [iconName && icon(iconName), label]);
}

// 켜고 끄는 조작 버튼(이름 보기, 고리 찾기 등). 누를 때마다 aria-pressed가 바뀌고 onChange(켜짐 여부)를 부른다.
export function toggleButton({ iconName, label, pressed = false, disabled = false, onChange }) {
  const button = controlButton({ iconName, label, disabled });
  setPressed(button, pressed);
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    setPressed(button, next);
    onChange?.(next);
  });
  return button;
}

export function setPressed(button, pressed) {
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

export function setCue(button, on) {
  button.classList.toggle('is-cue', on);
}

// 큰 주요 버튼("도감에 기록하기" 등). 강조 색 바탕.
export function primaryButton({ label, iconName, disabled = false, onClick }) {
  return el('button', { type: 'button', class: 'sv-primary', disabled, onclick: onClick }, [iconName && icon(iconName), label]);
}

// 보조 버튼(종이·대화 상자 위, 취소 등).
export function secondaryButton({ label, iconName, onClick }) {
  return el('button', { type: 'button', class: 'sv-secondary', onclick: onClick }, [iconName && icon(iconName), label]);
}

// 작은 테두리 버튼("다시 보내기", "다른 친구가 사용해요" 등).
export function ghostButton({ label, iconName, onClick }) {
  return el('button', { type: 'button', class: 'sv-ghost', onclick: onClick }, [iconName && icon(iconName), label]);
}
