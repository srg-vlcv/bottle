/** Замок для запечатанных бутылок (чистый canvas-2D, без зависимостей). */
export const LOCK_W = 96;
export const LOCK_H = 112;

export function drawLock(g: CanvasRenderingContext2D): void {
  const OUT = '#3a0d12';
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.lineWidth = 15; g.strokeStyle = OUT; g.beginPath(); g.arc(48, 40, 22, Math.PI, 0); g.lineTo(70, 56); g.moveTo(26, 40); g.lineTo(26, 56); g.stroke();
  g.lineWidth = 8; g.strokeStyle = '#e8edf6'; g.beginPath(); g.arc(48, 40, 22, Math.PI, 0); g.lineTo(70, 56); g.moveTo(26, 40); g.lineTo(26, 56); g.stroke();
  g.fillStyle = OUT; g.beginPath(); g.roundRect(12, 52, 72, 54, 14); g.fill();
  g.restore();
  const grd = g.createLinearGradient(0, 56, 0, 104); grd.addColorStop(0, '#ff6b6b'); grd.addColorStop(1, '#c4202c');
  g.fillStyle = grd; g.beginPath(); g.roundRect(17, 57, 62, 44, 11); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(22, 60, 52, 10, 5); g.fill();
  g.fillStyle = OUT; g.beginPath(); g.arc(48, 76, 7, 0, Math.PI * 2); g.fill(); g.beginPath(); g.roundRect(44, 78, 8, 15, 3); g.fill();
}
