export type AmbientKind = 'none' | 'snow' | 'bubbles' | 'leaves' | 'embers';

/**
 * Тема оформления. Новая тема = один файл с объектом Theme + строка в index.ts (+ необязательный фон
 * src/assets/themes/<id>/bg.webp, см. ASSETS.md).
 */
export interface Theme {
  id: string;
  name: { ru: string; en: string };
  desc: { ru: string; en: string };
  /** Цена в кристаллах / монетах (у стартовой темы 0). */
  priceRare: number;
  priceCoins: number;
  /** 12 хорошо различимых цветов жидкости (индекс цвета в ядре → hex). */
  palette: string[];
  /** Градиент колонки и фон по бокам (CSS-переменные). */
  css: { col1: string; col2: string; bg1: string; bg2: string };
  shelf: string;
  glassTint: string;
  /** Цвет бликов пузырьков внутри жидкости. */
  bubble: string;
  /** Фоновые частицы за бутылками: снег, пузыри, листья, искры камина. */
  ambient: AmbientKind;
  ambientColors: string[];
  /** Музыка: ноты мелодии, басы «подушки» (Гц) и тембр. */
  music: { scale: number[]; pad: number[]; wave: OscillatorType };
}
