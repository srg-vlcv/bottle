import type { Theme } from './types';

export type { Theme } from './types';

export const LAB: Theme = {
  id: 'lab',
  name: { ru: 'Лаборатория', en: 'Laboratory' },
  desc: { ru: 'Классика: тёплый свет и чистые цвета', en: 'The classic: warm light and clean colors' },
  priceRare: 0, priceCoins: 0,
  palette: ['#e53935', '#fb8c00', '#fdd835', '#2e9e4f', '#00838f', '#1e66f5', '#8e24aa', '#f06292', '#795548', '#aed581', '#4dd0e1', '#cfd8dc'],
  css: { col1: '#3b4f7c', col2: '#18223c', bg1: '#2b3a5e', bg2: '#0b1020' },
  shelf: '#5a4630', glassTint: '#e8f4ff', bubble: '#ffffff',
  ambient: 'none', ambientColors: [],
  music: { scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33], pad: [130.81, 146.83, 110, 98], wave: 'sine' },
};
