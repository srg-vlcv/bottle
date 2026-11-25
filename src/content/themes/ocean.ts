import type { Theme } from './types';

export const OCEAN: Theme = {
  id: 'ocean',
  name: { ru: 'Подводный мир', en: 'Underwater' },
  desc: { ru: 'Лагуна, пузырьки и мягкий свет', en: 'A lagoon, bubbles and soft light' },
  priceRare: 20, priceCoins: 500,
  palette: ['#ff6f61', '#ffa040', '#ffe066', '#3fa34d', '#b8e04a', '#19c3c3', '#5bb8f5', '#2a52d4', '#7e57c2', '#e040a0', '#e8eef2', '#8a6a52'],
  css: { col1: '#1b6a86', col2: '#0a2f4a', bg1: '#145a78', bg2: '#04182a' },
  shelf: '#b79b6c', glassTint: '#dffaff', bubble: '#d8fbff',
  ambient: 'bubbles', ambientColors: ['#bff3ff', '#e6fdff'],
  music: { scale: [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88], pad: [110, 123.47, 82.41, 98], wave: 'sine' }, // плавно и глубоко
};
