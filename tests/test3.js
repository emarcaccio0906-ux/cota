/* Pruebas de la mesa de dibujo: escalas, hojas, isométrico, escuadras y plantillas de clase.  node tests/test3.js */
'use strict';
const assert = require('assert');
const D = require('../js/drafting.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n        ' + e.message); process.exitCode = 1; }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es cercano a ${b}`);
const IN = 0.0254, FT = 0.3048;

console.log('Escalas y hojas');
test('1/4" = 1\'-0" es 1:48', () => {
  const s = D.scaleById('a0.25'); near(s.k, 1 / 48);
  near(D.unitOf(s.k), 4 * FT);                       // una pulgada de papel son 4 pies
  assert.ok(D.SCALES_FT.length === 11 && D.SCALES_M.length >= 8);
});
test('la hoja 18x24 a 1/4" mide 96\' x 72\' reales', () => {
  const r = D.sheetRect({ sheet: '18x24', orient: 'land', origin: [0, 0] }, 1 / 48);
  near(r.x1 - r.x0, 96 * FT); near(r.y1 - r.y0, 72 * FT);
  const v = D.sheetRect({ sheet: '18x24', orient: 'port', origin: [0, 0] }, 1 / 48);
  near(v.x1 - v.x0, 72 * FT);
});
test('marco y cajetín quedan dentro de la hoja', () => {
  const l = D.sheetLayout({ sheet: '11x17', orient: 'land', origin: [1, 2] }, 1 / 12);
  assert.ok(l.frame.x0 > l.sheet.x0 && l.frame.x1 < l.sheet.x1 && l.title.x0 > l.frame.x0 && l.title.x1 <= l.frame.x1 + 1e-9);
});

console.log('Isométrico y ángulos');
test('isoSnap cae en la red de 30°', () => {
  const p = D.isoSnap([0.9, 0.3], 1);
  near(p[0], Math.cos(Math.PI / 6)); near(p[1], 0.5);
  const q = D.isoSnap([0.05, 1.96], 1); near(q[0], 0); near(q[1], 2);
});
test('constrainDir lleva a 30° y respeta la tolerancia', () => {
  const r = D.constrainDir([0, 0], [10, 6.2], [30, 90, 150], 4);
  near(r.ang, 30); near(r.p[1] / r.p[0], Math.tan(Math.PI / 6));
  assert.strictEqual(D.constrainDir([0, 0], [10, 3], [30, 90, 150], 4), null);
  near(D.constrainDir([0, 0], [-10, -5.9], [30], 4).ang, 210);
});

console.log('Escuadras');
test('la 30-60 tiene cantos a 0°, 90° y 60°', () => {
  const g = D.instGeom({ kind: 't3060', p: [0, 0], ang: 0, flip: false }, IN, null);
  const dirs = D.edgeDirs(g.edges).map(a => Math.round(a)).sort((a, b) => a - b);
  assert.deepStrictEqual(dirs, [0, 90, 120]);
  assert.ok(g.hole && D.pointInPoly(g.hole[0], g.outer));
  const g2 = D.instGeom({ kind: 't3060', p: [0, 0], ang: 90, flip: false }, IN, null);
  assert.deepStrictEqual(D.edgeDirs(g2.edges).map(a => Math.round(a) % 180).sort((a, b) => a - b), [0, 30, 90]);
});
test('la de 45 da 45°', () => {
  const g = D.instGeom({ kind: 't45', p: [0, 0], ang: 0, flip: true }, IN, null);
  assert.ok(D.edgeDirs(g.edges).some(a => Math.abs(a - 45) < 1e-6 || Math.abs(a - 135) < 1e-6));
});
test('el punto se pega al canto', () => {
  const e = [{ a: [0, 0], b: [10, 0] }];
  const s = D.snapToEdges([3, 0.2], e, 0.5); near(s.p[0], 3); near(s.p[1], 0);
  assert.strictEqual(D.snapToEdges([3, 2], e, 0.5), null);
});
test('toLocal deshace toWorld', () => {
  const it = { p: [2, 3], ang: 33, flip: true }, w = D.toWorld(it, 0.5, [1.2, -0.7]), l = D.toLocal(it, 0.5, w);
  near(l[0], 1.2); near(l[1], -0.7);
});
test('escalímetro: a 1/4" cada pie mide 1/4" de papel', () => {
  const r = D.rulerTicks(1 / 48, false), f = r.ticks.filter(t => !t.sub);
  near(f[1].x - f[0].x, 0.25);
  assert.ok(r.ticks.every(t => t.x >= 0 && t.x <= D.RULER.len));
  const m = D.rulerTicks(1 / 50, true);
  assert.ok(m.ticks.some(t => t.label === '1'));
});

console.log('Minas y plantillas de clase');
test('cada tipo de línea usa una mina que existe', () => {
  D.PENS.forEach(p => assert.ok(D.leadById(p.lead), p.id));
  const mm = D.LEADS.map(l => l.mm);
  assert.deepStrictEqual(mm, mm.slice().sort((a, b) => a - b));     // de dura a blanda, más gruesa
});
test('las plantillas de clase caben en su zona de dibujo', () => {
  D.CLASS_LIST.forEach(c => {
    if (c.base) return;
    const b = D.buildClass(c.id), a = D.drawArea(c.paper), tol = 0.02;
    b.objects.forEach(o => [o.a, o.b, o.p].forEach(q => {
      if (!q) return;
      assert.ok(q[0] >= a.x0 - tol && q[0] <= a.x1 + tol && q[1] >= a.y0 - tol && q[1] <= a.y1 + tol, c.id + ' se sale: ' + q);
    }));
  });
});

console.log('\n' + passed + ' pruebas pasaron.');
