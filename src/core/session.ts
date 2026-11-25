import { Game } from './game';
import type { Session } from './save';
import type { Board } from './types';

export const sessionOf = (id: string, g: Game): Session => ({
  id,
  moves: g.history.map((m) => [m.from, m.to] as [number, number]),
  extraAts: g.extraAts.slice(),
  undo: g.undoUsed,
  hints: g.hintsUsed,
});

/**
 * Восстанавливает партию, переиграв ходы на исходной доске (уровень детерминирован по seed).
 * null — запись не подходит к доске (например, изменился генератор): тогда начинаем уровень заново.
 */
export function restoreGame(initial: Board, s: Session): Game | null {
  const g = new Game(initial);
  for (let k = 0; k <= s.moves.length; k++) {
    for (const at of s.extraAts) if (at === k) g.addExtraBottle(Number.MAX_SAFE_INTEGER);
    const mv = s.moves[k];
    if (mv && g.tryMove(mv[0], mv[1]) === 'invalid') return null;
  }
  g.undoUsed = s.undo; g.hintsUsed = s.hints;
  return g;
}
