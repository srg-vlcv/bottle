import type { CharId, Mood } from '../content/dialogs';
import { t } from '../services/i18n';
import { el } from './dom';
import { portrait } from './portraits';

export interface DialogLineView { who: CharId; mood: Mood; name: string; text: string }

/** Короткая вставка-диалог: портрет + реплика с «печатной машинкой». Тап — дописать/дальше, «Пропустить» — закрыть. */
export function showDialog(root: HTMLElement, lines: DialogLineView[], onDone: () => void): void {
  const ov = el('div', 'dialog');
  const skip = el('button', 'dlg-skip', `${t('skip')} ›`);
  const stage = el('div', 'dlg-stage');
  const box = el('div', 'dlg-box');
  const name = el('div', 'dlg-name'), text = el('div', 'dlg-text'), hint = el('div', 'dlg-hint', t('tapContinue'));
  box.append(name, text, hint);
  ov.append(skip, stage, box);
  root.append(ov);

  let i = -1, timer = 0, full = '', shown = 0, typing = false, finished = false;
  const finish = (): void => { if (finished) return; finished = true; window.clearInterval(timer); ov.remove(); onDone(); };
  const show = (): void => {
    const l = lines[i]!;
    stage.replaceChildren();
    if (l.who !== 'note') {
      const p = portrait(l.who, l.mood);
      p.classList.add(l.who === 'leo' ? 'left' : 'right');
      stage.append(p);
    } else stage.append(portrait('note', 'normal'));
    name.textContent = l.name; name.style.display = l.name ? '' : 'none';
    box.classList.toggle('narr', l.who === 'note');
    full = l.text; shown = 0; typing = true; text.textContent = ''; hint.style.visibility = 'hidden';
    window.clearInterval(timer);
    timer = window.setInterval(() => {
      shown += 1; text.textContent = full.slice(0, shown);
      if (shown >= full.length) { typing = false; hint.style.visibility = 'visible'; window.clearInterval(timer); }
    }, 24);
  };
  const advance = (): void => {
    if (typing) { shown = full.length; text.textContent = full; typing = false; hint.style.visibility = 'visible'; window.clearInterval(timer); return; }
    i += 1;
    if (i >= lines.length) finish(); else show();
  };
  ov.addEventListener('click', (e) => { if (e.target !== skip) advance(); });
  skip.addEventListener('click', finish);
  advance();
}
