import type { Theme } from './types';

export const AUTUMN: Theme = {
  id: 'autumn',
  name: { ru: 'Осенний сад', en: 'Autumn Garden' },
  desc: { ru: 'Золотая осень на даче, падают листья', en: 'Golden autumn, falling leaves' },
  priceRare: 20, priceCoins: 500,
  palette: ['#c62828', '#ef6c00', '#f2b01e', '#8d9a2c', '#388e3c', '#00897b', '#4fa3d9', '#3949ab', '#7b3fa0', '#d86a8f', '#6d4c41', '#efe3c8'],
  css: { col1: '#6b4a2e', col2: '#2b1c12', bg1: '#5a3c25', bg2: '#150d08' },
  shelf: '#4a3320', glassTint: '#fff3dc', bubble: '#fff0cf',
  ambient: 'leaves', ambientColors: ['#e65100', '#ef6c00', '#f9a825', '#bf360c', '#8d6e63'],
  music: { scale: [220, 261.63, 293.66, 329.63, 392, 440, 523.25], pad: [110, 98, 130.81, 87.31], wave: 'triangle' }, // тёплая, чуть грустная
};
