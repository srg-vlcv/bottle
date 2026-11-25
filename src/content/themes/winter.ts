import type { Theme } from './types';

export const WINTER: Theme = {
  id: 'winter',
  name: { ru: 'Зимний вечер', en: 'Winter Evening' },
  desc: { ru: 'Новогодний уют, тихий снегопад', en: 'Cozy holiday mood and quiet snowfall' },
  priceRare: 20, priceCoins: 500,
  palette: ['#d32f2f', '#f57c00', '#f9c23c', '#c0d94a', '#2f8f4e', '#1fb5a8', '#64b5f6', '#2d5bd6', '#8e44ad', '#f48fb1', '#8d5b3c', '#f1f5f9'],
  css: { col1: '#2c3f6b', col2: '#121c38', bg1: '#24365f', bg2: '#080d1c' },
  shelf: '#7a5a3a', glassTint: '#e3f1ff', bubble: '#e8f4ff',
  ambient: 'snow', ambientColors: ['#ffffff', '#dff0ff', '#cfe6ff'],
  music: { scale: [392, 440, 493.88, 587.33, 659.25, 783.99, 880], pad: [196, 174.61, 164.81, 146.83], wave: 'sine' }, // «колокольчики»
};
