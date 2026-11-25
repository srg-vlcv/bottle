import { BALANCE } from '../config/balance';
import type { Save } from './save';

export type RegenId = 'undo' | 'hint';
export const REGEN_IDS: readonly RegenId[] = ['undo', 'hint'];

/** Одна единица восстанавливается за regenFullMs / cap. */
export const regenIntervalMs = (id: RegenId): number => BALANCE.bonuses[id].regenFullMs / BALANCE.bonuses[id].cap;

/**
 * Начисляет восстановленные бонусы за прошедшее время (в том числе пока игрока не было в игре).
 * `now` — эффективное время (серверное, защищённое от отката часов). Возвращает ТУ ЖЕ ссылку, если ничего не изменилось.
 */
export function tickRegen(save: Save, now: number): Save {
  let next = save;
  for (const id of REGEN_IDS) {
    const cap = BALANCE.bonuses[id].cap;
    const count = next.bonuses[id];
    if (count >= cap) continue; // запас полон — таймер «припаркован», запустится при первой трате
    const iv = regenIntervalMs(id);
    const at = next.regen[id];
    if (at <= 0 || now < at) { next = { ...next, regen: { ...next.regen, [id]: now } }; continue; } // нет таймера / аномалия часов
    const n = Math.floor((now - at) / iv);
    if (n <= 0) continue;
    const c = Math.min(cap, count + n);
    next = { ...next, bonuses: { ...next.bonuses, [id]: c }, regen: { ...next.regen, [id]: c >= cap ? now : at + n * iv } };
  }
  return next;
}

/** Через сколько мс появится следующая единица; null — запас полон. */
export function regenRemainingMs(save: Save, id: RegenId, now: number): number | null {
  if (save.bonuses[id] >= BALANCE.bonuses[id].cap) return null;
  const at = save.regen[id];
  if (at <= 0 || now < at) return regenIntervalMs(id);
  return Math.max(0, regenIntervalMs(id) - (now - at));
}
