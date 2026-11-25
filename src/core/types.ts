/** Цвет жидкости — целый индекс палитры темы (0..N-1). Логика ничего не знает о реальных цветах. */
export type Color = number;

export interface Bottle {
  readonly cap: number;
  /** Слои снизу вверх. */
  readonly layers: readonly Color[];
  /** Механика «?»: сколько НИЖНИХ слоёв ещё скрыто. Слой открывается, когда становится верхним. */
  readonly hidden?: number;
  /** Механика «печать»: бутылка недоступна (нельзя ни переливать из неё, ни в неё), пока не будет собрана бутылка lockedBy. */
  readonly locked?: boolean;
  readonly lockedBy?: number;
}

export interface Board {
  readonly bottles: readonly Bottle[];
}

/** Запись о ходе — достаточна для точного отката. */
export interface Move {
  readonly from: number;
  readonly to: number;
  readonly color: Color;
  readonly count: number;
  /** Сколько слоёв было скрыто в бутылке-источнике ДО хода (если ход открыл слой). */
  readonly prevHidden?: number;
  /** Бутылки, которые этот ход распечатал. */
  readonly unlocked?: readonly number[];
}

export interface LevelSpec {
  readonly colors: number;
  readonly empties: number;
  readonly capacity: number;
  /** Разная вместимость: caps[i] — вместимость (и число слоёв) i-го цвета. */
  readonly caps?: readonly number[];
  /** Вместимость пустых бутылок (по умолчанию — наибольшая). */
  readonly emptyCap?: number;
  /** Сколько бутылок «с секретом»: все слои, кроме верхнего, скрыты. */
  readonly hidden?: number;
  /** Сколько бутылок запечатано. */
  readonly sealed?: number;
}
