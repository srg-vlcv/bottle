import type { ChestTier, Reward } from '../config/shop';
import { CHESTS } from '../config/shop';
import { chestOdds } from '../core/shop';
import { ChestScene } from '../render/chestScene';
import { t } from '../services/i18n';
import { button, el, modal } from './dom';
import { rewardLabel } from './rewards';

export interface ChestWindowOpts {
  tier: ChestTier;
  owned: number;
  /** Списывает сундук, разыгрывает награду и сохраняет. null — сундука нет. */
  onOpen(): Reward[] | null;
  onClose(): void;
}

/** Окно сундука: 3D-сундук, ШАНСЫ выпадения (из тех же весов, что и розыгрыш), кнопка «Открыть», карточки наград. */
export function showChestWindow(root: HTMLElement, o: ChestWindowOpts): void {
  let scene: ChestScene | null = null;
  const close = modal(root, (card, shut) => {
    card.classList.add('chest-card');
    card.append(el('h2', '', t(`chest.${o.tier}`)));
    const stage = el('div', 'chest-stage');
    const odds = el('div', 'odds');
    odds.append(el('h4', '', `${t('oddsTitle')} · ${t('itemsInChest')}: ${CHESTS[o.tier].rolls}`));
    for (const row of chestOdds(o.tier)) {
      const r = el('div', 'odds-row'); r.append(el('span', '', rewardLabel(row.reward)), el('b', '', `${(row.p * 100).toFixed(row.p < 0.1 ? 1 : 0)}%`));
      odds.append(r);
    }
    const cards = el('div', 'reward-cards');
    const actions = el('div', '');
    card.append(stage, cards, odds, actions);

    const done = (): void => { scene?.dispose(); scene = null; shut(); o.onClose(); };
    const openBtn = button(`${t('open')}${o.owned > 0 ? ` (${o.owned})` : ''}`, async () => {
      const rewards = o.onOpen();
      if (!rewards) return;
      openBtn.remove(); closeBtn.remove(); odds.remove();
      await scene?.open();
      rewards.forEach((r, i) => {
        const c = el('div', 'reward-card', rewardLabel(r)); c.style.animationDelay = `${i * 0.18}s`; cards.append(c);
      });
      actions.append(button(t('claim'), done, 'btn wide green'));
    }, 'btn wide green');
    const closeBtn = button(t('close'), done, 'btn wide ghost');
    if (o.owned > 0) actions.append(openBtn);
    actions.append(closeBtn);

    scene = new ChestScene(stage, o.tier);
    void scene.dropIn();
  });
  void close;
}
