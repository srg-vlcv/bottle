import type { CharId, Mood } from './dialogs';

/**
 * Картинки персонажей и фонов подхватываются автоматически — просто положите файлы в папки (см. ASSETS.md):
 *   src/assets/characters/<персонаж>_<настроение>.webp|png   например leo_happy.webp
 *   src/assets/themes/<id темы>/bg.webp|png|jpg              фон для телефона (вертикальный), например themes/lab/bg.webp
 *   src/assets/themes/<id темы>/bg_wide.webp|png|jpg         фон для ПК (горизонтальный 16:9), необязательный
 * Если файла нет — используется встроенный рисованный запасной вариант (ничего не ломается).
 */
const chars = import.meta.glob('../assets/characters/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const bgs = import.meta.glob('../assets/themes/*/bg{,_wide}.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const find = (map: Record<string, string>, tail: RegExp): string | null => {
  const k = Object.keys(map).find((p) => tail.test(p));
  return k ? map[k]! : null;
};

export function characterArt(who: CharId, mood: Mood): string | null {
  return find(chars, new RegExp(`/${who}_${mood}\\.(webp|png)$`)) ?? find(chars, new RegExp(`/${who}_normal\\.(webp|png)$`));
}

/** wide = широкий экран (ПК): берём bg_wide.*, а если его нет — обычный bg.* (и наоборот). */
export function themeBackground(themeId: string, wide = false): string | null {
  const portrait = find(bgs, new RegExp(`/themes/${themeId}/bg\\.(webp|png|jpg)$`));
  const landscape = find(bgs, new RegExp(`/themes/${themeId}/bg_wide\\.(webp|png|jpg)$`));
  return wide ? landscape ?? portrait : portrait ?? landscape;
}
