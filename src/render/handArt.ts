/**
 * Рука-указатель (палец вверх): указательный палец, три согнутых, большой палец и ладонь.
 * Чистый canvas-2D без зависимостей — игра и превью используют одну функцию. Кончик пальца — в точке TIP.
 */
export const HAND_W = 128;
export const HAND_H = 160;
/** Доли (x, y от верха) картинки, где находится кончик пальца. */
export const HAND_TIP = { x: 51 / 128, y: 6 / 160 };

export function drawHand(g: CanvasRenderingContext2D): void {
  const OUT = '#243052';
  const shapes: Array<(c: CanvasRenderingContext2D) => void> = [
    (c) => c.roundRect(40, 6, 22, 100, 11),            // указательный
    (c) => c.roundRect(61, 58, 21, 60, 10.5),          // средний (согнут)
    (c) => c.roundRect(81, 66, 19, 54, 9.5),           // безымянный
    (c) => c.roundRect(99, 78, 17, 46, 8.5),           // мизинец
    (c) => c.roundRect(30, 84, 86, 66, 26),            // ладонь
  ];
  const thumb = (c: CanvasRenderingContext2D): void => { c.save(); c.translate(40, 112); c.rotate(-0.62); c.beginPath(); c.roundRect(-11, -30, 22, 60, 11); c.restore(); };

  // 1) тень и общий тёмный контур (рисуем толстой обводкой все формы — внутренние стыки потом закрасит заливка)
  g.save();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
  g.lineJoin = 'round'; g.lineWidth = 11; g.strokeStyle = OUT;
  for (const s of shapes) { g.beginPath(); s(g); g.stroke(); }
  thumb(g); g.stroke();
  g.restore();

  // 2) белая заливка поверх (получается чистый силуэт с единым контуром)
  const grd = g.createLinearGradient(0, 0, 0, g.canvas.height);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.7, '#f4f7ff'); grd.addColorStop(1, '#d9e2f6');
  g.fillStyle = grd;
  for (const s of shapes) { g.beginPath(); s(g); g.fill(); }
  thumb(g); g.fill();

  // 3) внутренние линии: стыки пальцев и складка у большого пальца
  g.strokeStyle = 'rgba(36,48,82,.55)'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(61, 66); g.lineTo(61, 104);   // между указательным и средним
  g.moveTo(81, 74); g.lineTo(81, 106);   // между средним и безымянным
  g.moveTo(99, 84); g.lineTo(99, 108);   // между безымянным и мизинцем
  g.moveTo(44, 112); g.quadraticCurveTo(50, 124, 62, 128); // у основания большого пальца
  g.stroke();
  // блик на указательном пальце
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(47, 22); g.lineTo(47, 70); g.stroke();
}
