export interface AdChainConfig { readonly scheduleMs: readonly number[]; readonly resetAfterMs: number | null }

/**
 * Лестница ожидания между бонусами за рекламу (2 → 5 → 10 → 20 мин → 20 …).
 * Если resetAfterMs задан и игрок не брал бонус дольше него после окончания кулдауна — начинаем с первой ступени (null — не сбрасываем).
 * Возвращает длительность кулдауна, который стартует СЕЙЧАС, и новую ступень.
 */
export function nextAdCooldown(step: number, prevNextAvailableAt: number, now: number, cfg: AdChainConfig): { cooldownMs: number; step: number } {
  const idle = prevNextAvailableAt > 0 ? now - prevNextAvailableAt : 0;
  const s = cfg.resetAfterMs !== null && idle >= cfg.resetAfterMs ? 0 : step;
  const cooldownMs = cfg.scheduleMs[Math.min(s, cfg.scheduleMs.length - 1)]!;
  return { cooldownMs, step: s + 1 };
}
