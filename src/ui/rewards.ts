import type { BonusId } from '../config/balance';
import type { ChestTier, Reward } from '../config/shop';
import { getTheme } from '../content/themes';
import { getLang, t } from '../services/i18n';
import { COIN, GEM } from './dom';

export const bonusLabel = (id: BonusId): string => t(id === 'extraBottle' ? 'extra' : id);

/** Короткая подпись награды (с иконками валют). */
export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case 'rare': return `${GEM} +${r.n}`;
    case 'coins': return `${COIN} +${r.n}`;
    case 'bonus': return `${bonusLabel(r.id)} +${r.n}`;
    case 'chest': return `${t(`chest.${r.tier}`)} ×${r.n}`;
    case 'theme': return r.id === 'random' ? t('randomTheme') : getTheme(r.id).name[getLang()];
  }
}

const PALETTE: Record<ChestTier, { body: string; band: string; dark: string }> = {
  wood: { body: '#9a6538', band: '#9aa1ad', dark: '#6a4224' },
  silver: { body: '#6a7ba2', band: '#e8eef8', dark: '#465577' },
  gold: { body: '#c4781c', band: '#ffd54a', dark: '#8a520f' },
};

/** Иконка сундука для карточек магазина. */
export function chestIcon(tier: ChestTier, size = 64): string {
  const c = PALETTE[tier];
  return `<svg viewBox="0 0 80 64" width="${size}" height="${size * 0.8}" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="30" width="64" height="28" rx="4" fill="${c.body}"/><path d="M8 32 Q8 8 40 8 Q72 8 72 32 Z" fill="${c.dark}"/>
    <path d="M12 30 Q14 12 40 12 Q66 12 68 30 Z" fill="${c.body}"/>
    <rect x="8" y="28" width="64" height="6" fill="${c.band}"/><rect x="20" y="10" width="7" height="48" fill="${c.band}" opacity=".9"/><rect x="53" y="10" width="7" height="48" fill="${c.band}" opacity=".9"/>
    <rect x="34" y="26" width="12" height="14" rx="3" fill="${c.band}" stroke="${c.dark}" stroke-width="2"/><circle cx="40" cy="33" r="2" fill="${c.dark}"/></svg>`;
}
