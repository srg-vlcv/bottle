import type { Theme } from './types';

export const FIREPLACE: Theme = {
  id: 'fireplace',
  name: { ru: 'Уютный камин', en: 'Cozy Fireplace' },
  desc: { ru: 'Старая библиотека, тёплый огонь, искры', en: 'An old library, warm fire and sparks' },
  priceRare: 25, priceCoins: 600,
  palette: ['#c0262d', '#e8761a', '#f6c244', '#5f8f3a', '#1f9d6b', '#2fb8c6', '#3b6fd8', '#8a4fc7', '#e27396', '#9a5b34', '#f1e6d0', '#7d8a99'],
  css: { col1: '#5a2c25', col2: '#220f0d', bg1: '#4a221c', bg2: '#100605' },
  shelf: '#3d2616', glassTint: '#ffeed6', bubble: '#ffe2b0',
  ambient: 'embers', ambientColors: ['#ff9a3c', '#ffb74d', '#ff7043'],
  music: { scale: [196, 220, 246.94, 293.66, 329.63, 392, 440], pad: [98, 110, 73.42, 82.41], wave: 'triangle' },
};
