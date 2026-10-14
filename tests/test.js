/* Pruebas de la lógica pura de Cota. Correr con:  node tests/test.js */
'use strict';
const assert = require('assert');
const U = require('../js/units.js');
const G = require('../js/geom.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n        ' + e.message); process.exitCode = 1; }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es cercano a ${b}`);

console.log('Unidades');
test('12\'6" = 3.81 m', () => near(U.parseLength('12\'6"', 'ft'), 3.81));
test('12\'-6" = 3.81 m', () => near(U.parseLength('12\'-6"', 'ft'), 3.81));
test("12' = 3.6576 m", () => near(U.parseLength("12'", 'ft'), 3.6576));
test('12ft 6in', () => near(U.parseLength('12ft 6in', 'ft'), 3.81));
test('6 1/2" fracción', () => near(U.parseLength('6 1/2"', 'ft'), 6.5 * 0.0254));
test('3/4" fracción sola', () => near(U.parseLength('3/4"', 'ft'), 0.75 * 0.0254));
test('150cm', () => near(U.parseLength('150cm', 'ft'), 1.5));
test('1500mm', () => near(U.parseLength('1500mm', 'ft'), 1.5));
test('3.5m', () => near(U.parseLength('3.5m', 'ft'), 3.5));
test('número suelto usa la unidad en pantalla (ft)', () => near(U.parseLength('10', 'ft'), 3.048));
test('número suelto usa la unidad en pantalla (m)', () => near(U.parseLength('10', 'm'), 10));
test('negativo', () => near(U.parseLength("-5'", 'ft'), -1.524));
test('texto inválido da NaN', () => assert.ok(Number.isNaN(U.parseLength('hola', 'ft'))));
test('vacío da NaN', () => assert.ok(Number.isNaN(U.parseLength('', 'ft'))));
test('formato 3.81 m en ft', () => assert.strictEqual(U.formatLength(3.81, 'ft'), '12\'-6"'));
test('formato con fracción', () => assert.strictEqual(U.formatLength(0.3048 * 3 + 0.0254 * 2.5, 'ft'), '3\'-2 1/2"'));
test('formato solo pulgadas', () => assert.strictEqual(U.formatLength(0.0254 * 6, 'ft'), '6"'));
test('formato pies exactos', () => assert.strictEqual(U.formatLength(0.3048 * 10, 'ft'), '10\'-0"'));
test('formato redondeo 11 15/16 -> 1\'-0"', () => assert.strictEqual(U.formatLength(0.3048 - 0.0254 / 40, 'ft'), '1\'-0"'));
test('formato metros', () => assert.strictEqual(U.formatLength(3.456, 'm'), '3.46 m'));
test('formato metros chicos', () => assert.strictEqual(U.formatLength(0.15, 'm'), '0.15 m'));
test('ida y vuelta', () => {
  ['7\'-3 1/4"', '24\'-0"', '9"', '0.5 m'].forEach(() => {});
  const m = U.parseLength('7\'3 1/4"', 'ft');
  assert.strictEqual(U.formatLength(m, 'ft'), '7\'-3 1/4"');
});
test('precisión en pies: 1/4"', () => assert.strictEqual(U.formatLength(0.3048 * 3 + 0.0254 * 2.3, 'ft', 4), '3\'-2 1/4"'));
test('precisión en pies: 1/8"', () => assert.strictEqual(U.formatLength(0.3048 * 3 + 0.0254 * 2.3, 'ft', 8), '3\'-2 1/4"'));
test('precisión en pies: pulgada entera', () => assert.strictEqual(U.formatLength(0.3048 * 3 + 0.0254 * 2.6, 'ft', 1), '3\'-3"'));
test('precisión en pies: media pulgada', () => assert.strictEqual(U.formatLength(0.0254 * 4.5, 'ft', 2), '4 1/2"'));
test('precisión en metros: 3 decimales', () => assert.strictEqual(U.formatLength(3.4567, 'm', 3), '3.457 m'));
test('precisión en metros: 1 decimal', () => assert.strictEqual(U.formatLength(3.456, 'm', 1), '3.5 m'));
test('metros automático (0)', () => assert.strictEqual(U.formatLength(3.456, 'm', 0), '3.46 m'));
test('área en ft²', () => assert.strictEqual(U.formatArea(9.290304, 'ft'), '100 ft²'));
test('área en m²', () => assert.strictEqual(U.formatArea(12.5, 'm'), '12.5 m²'));

console.log('Geometría');
test('distancia punto-segmento', () => near(G.segDist([5, 3], [0, 0], [10, 0]).d, 3));
test('extremo del segmento', () => near(G.segDist([-4, 3], [0, 0], [10, 0]).d, 5));
test('área del rectángulo', () => near(G.polyArea([[0, 0], [4, 0], [4, 3], [0, 3]]), 12));
test('largo polilínea cerrada', () => near(G.polyLength([[0, 0], [4, 0], [4, 3], [0, 3]], true), 14));

const walls = [
  { id: 1, type: 'wall', a: [0, 0], b: [10, 0], t: 0.2 },
  { id: 2, type: 'wall', a: [10, 0], b: [10, 6], t: 0.2 }
];
test('pared: distancia usa el espesor', () => near(G.distToObject([5, 0.1], walls[0], {}), 0));
test('pared: fuera del espesor', () => near(G.distToObject([5, 0.5], walls[0], {}), 0.4));
test('abertura se coloca en la pared más cercana', () => {
  const r = G.placeOnWall([4, 0.3], walls, 0.9, 0.5);
  assert.ok(r); assert.strictEqual(r.wall.id, 1); near(r.pos, 4);
});
test('abertura no se sale del extremo', () => {
  const r = G.placeOnWall([0.1, 0.1], walls, 0.9, 0.5);
  near(r.pos, 0.45);
});
test('abertura lejos de toda pared da null', () => assert.strictEqual(G.placeOnWall([5, 4], walls, 0.9, 0.3), null));
test('abertura más ancha que la pared da null', () => assert.strictEqual(G.placeOnWall([5, 0], walls, 12, 0.5), null));
test('tramos macizos recortan la abertura', () => {
  const r = G.solidRanges(walls[0], [{ pos: 4, w: 1 }]);
  assert.deepStrictEqual(r, [[0, 3.5], [4.5, 10]]);
});
test('tramos macizos con dos aberturas', () => {
  const r = G.solidRanges(walls[0], [{ pos: 8, w: 1 }, { pos: 2, w: 2 }]);
  assert.deepStrictEqual(r, [[0, 1], [3, 7.5], [8.5, 10]]);
});
test('tramos macizos sin aberturas', () => assert.deepStrictEqual(G.solidRanges(walls[0], []), [[0, 10]]));

test('snap prefiere extremo', () => {
  const s = G.findSnap([10.05, 0.04], walls, { tol: 0.2, grid: 0.5, useGrid: true });
  assert.strictEqual(s.kind, 'end'); near(s.p[0], 10); near(s.p[1], 0);
});
test('snap punto medio', () => {
  const s = G.findSnap([5.05, 0.03], walls, { tol: 0.2, grid: 0.5, useGrid: false });
  assert.strictEqual(s.kind, 'mid'); near(s.p[0], 5);
});
test('snap a la cuadrícula', () => {
  const s = G.findSnap([3.12, 7.4], walls, { tol: 0.05, grid: 0.5, useGrid: true });
  assert.strictEqual(s.kind, 'grid'); near(s.p[0], 3); near(s.p[1], 7.5);
});
test('snap libre sin cuadrícula', () => {
  const s = G.findSnap([3.12, 7.4], walls, { tol: 0.05, grid: 0.5, useGrid: false });
  assert.strictEqual(s.kind, 'free'); near(s.p[0], 3.12);
});
test('ortogonal horizontal', () => assert.deepStrictEqual(G.orthoPoint([0, 0], [5, 1]), [5, 0]));
test('ortogonal vertical', () => assert.deepStrictEqual(G.orthoPoint([0, 0], [1, 5]), [0, 5]));

test('mover línea', () => {
  const o = { type: 'line', a: [0, 0], b: [1, 1] };
  G.translateObj(o, 2, 3);
  assert.deepStrictEqual([o.a, o.b], [[2, 3], [3, 4]]);
});
test('girar 90° una línea', () => {
  const o = { type: 'line', a: [1, 0], b: [2, 0] };
  G.rotateObj(o, [0, 0], Math.PI / 2);
  near(o.a[0], 0); near(o.a[1], 1); near(o.b[0], 0); near(o.b[1], 2);
});
test('girar un rectángulo lo vuelve polilínea cerrada', () => {
  const o = { type: 'rect', a: [0, 0], b: [2, 1] };
  G.rotateObj(o, [0, 0], Math.PI / 2);
  assert.strictEqual(o.type, 'polyline'); assert.strictEqual(o.closed, true); assert.strictEqual(o.pts.length, 4);
  near(G.polyArea(o.pts), 2);
});
test('caja envolvente de pared incluye espesor', () => {
  const b = G.bboxOf(walls[0], {});
  near(b.miny, -0.1); near(b.maxy, 0.1);
});
test('geometría de abertura', () => {
  const g = G.openingGeom({ pos: 4, w: 1, flip: false }, walls[0]);
  near(g.p0[0], 3.5); near(g.p1[0], 4.5); near(g.c[0], 4);
});
test('cota alineada', () => {
  const d = G.dimGeom({ a: [0, 0], b: [4, 0], off: 1 });
  near(d.length, 4); near(d.a2[1], 1);
});

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', con fallas' : ''}.`);
