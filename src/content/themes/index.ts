import { AUTUMN } from './autumn';
import { FIREPLACE } from './fireplace';
import { LAB } from './lab';
import { OCEAN } from './ocean';
import type { Theme } from './types';
import { WINTER } from './winter';

export type { Theme } from './types';

/** Порядок = порядок в магазине. Добавить тему = создать файл и добавить её сюда. */
export const THEMES: readonly Theme[] = [LAB, WINTER, OCEAN, AUTUMN, FIREPLACE];
export const DEFAULT_THEME = LAB;
export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
