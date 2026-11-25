import { characterArt } from '../content/assets';
import type { CharId, Mood } from '../content/dialogs';
import { el } from './dom';

const eyes = (mood: Mood, cx1: number, cx2: number, cy: number, r = 4): string => {
  if (mood === 'happy') return [cx1, cx2].map((x) => `<path d="M${x - 6} ${cy + 1} Q${x} ${cy - 7} ${x + 6} ${cy + 1}" stroke="#2a2233" stroke-width="3.2" fill="none" stroke-linecap="round"/>`).join('');
  if (mood === 'surprised') return [cx1, cx2].map((x) => `<circle cx="${x}" cy="${cy}" r="${r + 3.5}" fill="#fff"/><circle cx="${x}" cy="${cy}" r="${r - 1}" fill="#2a2233"/>`).join('');
  if (mood === 'think') return `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="#2a2233"/><circle cx="${cx2}" cy="${cy}" r="${r}" fill="#2a2233"/><path d="M${cx2 - 7} ${cy - 11} L${cx2 + 7} ${cy - 14}" stroke="#2a2233" stroke-width="3" stroke-linecap="round"/>`;
  return `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="#2a2233"/><circle cx="${cx2}" cy="${cy}" r="${r}" fill="#2a2233"/>`;
};
const mouth = (mood: Mood, cx: number, cy: number): string => {
  if (mood === 'happy') return `<path d="M${cx - 12} ${cy - 2} Q${cx} ${cy + 14} ${cx + 12} ${cy - 2} Z" fill="#7a2b3a"/>`;
  if (mood === 'surprised') return `<ellipse cx="${cx}" cy="${cy + 3}" rx="6" ry="8" fill="#7a2b3a"/>`;
  if (mood === 'think') return `<path d="M${cx - 8} ${cy + 4} Q${cx} ${cy} ${cx + 8} ${cy + 5}" stroke="#7a2b3a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${cx - 9} ${cy} Q${cx} ${cy + 8} ${cx + 9} ${cy}" stroke="#7a2b3a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
};

/** Запасной рисованный портрет (пока нет настоящих картинок). */
function svgPortrait(who: CharId, mood: Mood): string {
  if (who === 'leo') {
    return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 200 Q24 142 80 138 Q136 142 140 200 Z" fill="#f4f6fb"/><path d="M62 140 L80 170 L98 140" fill="#cfd8ea"/>
      <rect x="68" y="112" width="24" height="30" rx="9" fill="#e9bf9a"/>
      <ellipse cx="80" cy="82" rx="42" ry="46" fill="#f3cfae"/>
      <path d="M36 78 Q34 28 82 30 Q128 30 124 80 Q112 52 82 54 Q52 52 36 78 Z" fill="#6b4331"/>
      <rect x="38" y="58" width="84" height="16" rx="8" fill="#37465e"/><circle cx="62" cy="66" r="11" fill="#9fe3ff" stroke="#2a3348" stroke-width="4"/><circle cx="98" cy="66" r="11" fill="#9fe3ff" stroke="#2a3348" stroke-width="4"/>
      ${eyes(mood, 64, 96, 92)}${mouth(mood, 80, 112)}
      <ellipse cx="52" cy="104" rx="7" ry="4" fill="#f09a8e" opacity=".55"/><ellipse cx="108" cy="104" rx="7" ry="4" fill="#f09a8e" opacity=".55"/></svg>`;
  }
  if (who === 'bulk') {
    return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 30 Q82 14 92 10" stroke="#3aa8b8" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="94" cy="9" r="7" fill="#ffd54a"/>
      <path d="M80 36 Q30 80 30 128 Q30 182 80 182 Q130 182 130 128 Q130 80 80 36 Z" fill="#4fd1d9"/>
      <path d="M52 100 Q50 78 70 62" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>
      <ellipse cx="80" cy="168" rx="38" ry="10" fill="#2f9aa8" opacity=".5"/>
      <circle cx="62" cy="116" r="15" fill="#fff"/><circle cx="98" cy="116" r="15" fill="#fff"/>
      ${mood === 'happy' ? `<path d="M52 118 Q62 106 72 118" stroke="#2a2233" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M88 118 Q98 106 108 118" stroke="#2a2233" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : `<circle cx="${mood === 'think' ? 66 : 62}" cy="${mood === 'think' ? 112 : 116}" r="${mood === 'surprised' ? 6 : 8}" fill="#2a2233"/><circle cx="${mood === 'think' ? 102 : 98}" cy="${mood === 'think' ? 112 : 116}" r="${mood === 'surprised' ? 6 : 8}" fill="#2a2233"/>`}
      ${mouth(mood, 80, 146)}
      <circle cx="42" cy="140" r="5" fill="#ffffff" opacity=".5"/><circle cx="122" cy="96" r="4" fill="#ffffff" opacity=".5"/></svg>`;
  }
  return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg"><rect x="34" y="40" width="92" height="120" rx="8" fill="#f1e2bd" stroke="#b79a5b" stroke-width="4"/>
    <path d="M50 70 H110 M50 92 H110 M50 114 H90" stroke="#a98c4f" stroke-width="5" stroke-linecap="round"/></svg>`;
}

/** Портрет: картинка из assets, а если её нет — запасной SVG. */
export function portrait(who: CharId, mood: Mood): HTMLElement {
  const box = el('div', `portrait ${who}`);
  const url = characterArt(who, mood);
  if (url) { const img = el('img'); img.src = url; img.alt = ''; img.draggable = false; box.append(img); }
  else box.innerHTML = svgPortrait(who, mood);
  return box;
}
