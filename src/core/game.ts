import type { Board, Move } from './types';
import { addBottle, applyMove, isWon, undoMove } from './rules';

export type TryMoveResult = 'ok' | 'invalid';

/** Состояние одной партии: доска, глубокая история ходов, счётчики. Чистая логика. */
export class Game {
  private readonly initial: Board;
  board: Board;
  history: Move[] = [];
  undoUsed = 0;
  extraBottlesUsed = 0;
  /** Сколько ходов было сделано в момент добавления каждой доп. бутылки (для точного восстановления партии). */
  extraAts: number[] = [];
  hintsUsed = 0;

  constructor(initial: Board) {
    this.initial = initial;
    this.board = initial;
  }

  get moves(): number { return this.history.length; }
  get won(): boolean { return isWon(this.board); }

  tryMove(from: number, to: number): TryMoveResult {
    const r = applyMove(this.board, from, to);
    if (!r) return 'invalid'; // ход не засчитывается, состояние не меняется
    this.board = r.board;
    this.history.push(r.move);
    return 'ok';
  }

  undo(): Move | null {
    const m = this.history.pop();
    if (!m) return null;
    this.board = undoMove(this.board, m);
    this.undoUsed++;
    this.extraAts = this.extraAts.map((a) => Math.min(a, this.history.length)); // бутылка осталась, но «добавлена» теперь раньше
    return m;
  }

  /** Добавляет пустую бутылку, если лимит на уровень не исчерпан. */
  addExtraBottle(limit: number): boolean {
    if (this.extraBottlesUsed >= limit) return false;
    this.board = addBottle(this.board);
    this.extraBottlesUsed++;
    this.extraAts.push(this.history.length);
    return true;
  }

  restart(): void {
    this.board = this.initial;
    this.history = [];
    this.undoUsed = 0;
    this.extraBottlesUsed = 0;
    this.extraAts = [];
    this.hintsUsed = 0;
  }
}
