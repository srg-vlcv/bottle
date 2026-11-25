import { DAILY_CYCLE, DAILY_GRACE_DAYS } from '../config/daily';
import type { Reward } from '../config/shop';
import type { Save } from './save';
import { applyRewards } from './shop';

/**
 * Индекс календарных суток по ЛОКАЛЬНОМУ времени игрока (граница дня — его полночь).
 * nowMs берём серверное/эффективное, tzOffsetMin — Date.getTimezoneOffset().
 */
export const dayIndex = (nowMs: number, tzOffsetMin: number): number => Math.floor((nowMs - tzOffsetMin * 60_000) / 86_400_000);

export interface DailyStatus { canClaim: boolean; streakAfter: number; dayInCycle: number; rewards: readonly Reward[] }

/** Что будет, если забрать награду сегодня (или почему нельзя). */
export function dailyStatus(d: Save['daily'], today: number): DailyStatus {
  const diff = today - d.lastClaimDay;
  const canClaim = d.lastClaimDay < 0 || diff >= 1;
  // серия продолжается, если пропущено не больше DAILY_GRACE_DAYS дней; иначе начинается заново
  const keeps = d.lastClaimDay >= 0 && diff >= 1 && diff <= 1 + DAILY_GRACE_DAYS;
  const streakAfter = d.lastClaimDay < 0 ? 1 : keeps ? d.streak + 1 : diff >= 1 ? 1 : d.streak;
  const dayInCycle = ((Math.max(1, streakAfter) - 1) % DAILY_CYCLE.length) + 1;
  return { canClaim, streakAfter, dayInCycle, rewards: DAILY_CYCLE[dayInCycle - 1]! };
}

/** Забрать награду; null — сегодня уже забрана. */
export function claimDaily(save: Save, today: number): { save: Save; status: DailyStatus } | null {
  const st = dailyStatus(save.daily, today);
  if (!st.canClaim) return null;
  const next = applyRewards({ ...save, daily: { streak: st.streakAfter, lastClaimDay: today } }, st.rewards);
  return { save: { ...next, stats: { ...next.stats, dailyClaims: next.stats.dailyClaims + 1 } }, status: st };
}
