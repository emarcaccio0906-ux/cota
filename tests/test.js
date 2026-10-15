/* Pruebas de la lógica pura de Cota. Correr con:  node tests/test.js */
'use strict';
const assert = require('assert');
const U = require('../js/units.js');
const G = require('../js/geom.js');
const M = require('../js/model3d.js');

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

console.log('Modelo 3D');
const mkWall = (id, a, b, t = 0.114) => ({ id, type: 'wall', a, b, t });
const room = (x0, y0, x1, y1, id0 = 1) => [
  mkWall(id0, [x0, y0], [x1, y0]), mkWall(id0 + 1, [x1, y0], [x1, y1]),
  mkWall(id0 + 2, [x1, y1], [x0, y1]), mkWall(id0 + 3, [x0, y1], [x0, y0])
];
const H = 2.4384;

test('pared con puerta: muro, dintel y hoja', () => {
  const objs = [mkWall(1, [0, 0], [10, 0]), { id: 2, type: 'door', wall: 1, pos: 4, w: 1, flip: false }];
  const m = M.build(objs, {});
  const walls = m.parts.filter(p => p.kind === 'wall');
  assert.strictEqual(walls.length, 3);   // dos tramos + dintel
  const lintel = walls.find(p => p.h0 > 0);
  near(lintel.h0, 2.032); near(lintel.h1, H); near(lintel.len, 1, 0.01);
  assert.strictEqual(m.parts.filter(p => p.kind === 'leaf').length, 1);
  assert.strictEqual(m.stats.doors, 1);
});
test('los tramos extremos se alargan medio espesor', () => {
  const m = M.build([mkWall(1, [0, 0], [10, 0], 0.2)], {});
  const w = m.parts[0];
  near(w.len, 10.2); near(w.c[0], 5);
});
test('ventana: muro bajo, muro alto, marco y vidrio', () => {
  const objs = [mkWall(1, [0, 0], [10, 0]), { id: 2, type: 'window', wall: 1, pos: 5, w: 1.5, flip: false }];
  const m = M.build(objs, {});
  const walls = m.parts.filter(p => p.kind === 'wall');
  assert.strictEqual(walls.length, 4);   // dos tramos, antepecho y dintel
  near(Math.min(...walls.map(p => p.h1).filter(h => h < H)), 0.9144, 0.01);
  const glass = m.parts.filter(p => p.kind === 'glass');
  assert.strictEqual(glass.length, 1);
  near(glass[0].h0, 0.9144 + 0.05); near(glass[0].h1, 0.9144 + 1.2192 - 0.05);
  assert.ok(m.parts.filter(p => p.kind === 'frame').length >= 5);   // marco + parteluz (ventana ancha)
});
test('ventana angosta no lleva parteluz', () => {
  const m = M.build([mkWall(1, [0, 0], [10, 0]), { id: 2, type: 'window', wall: 1, pos: 5, w: 0.8, flip: false }], {});
  assert.strictEqual(m.parts.filter(p => p.kind === 'frame').length, 4);
});
test('ninguna pieza pasa de la altura de pared', () => {
  const objs = room(0, 0, 6, 4).concat([{ id: 9, type: 'door', wall: 1, pos: 2, w: 0.9 }, { id: 10, type: 'window', wall: 2, pos: 2, w: 1.2 }]);
  const m = M.build(objs, { wallH: 2.7 });
  assert.ok(m.parts.every(p => p.h1 <= 2.7 + 1e-9 && p.h0 >= -1e-9));
});
test('pared baja: la abertura se recorta a la altura', () => {
  const m = M.build([mkWall(1, [0, 0], [10, 0]), { id: 2, type: 'door', wall: 1, pos: 4, w: 1 }], { wallH: 1.8 });
  assert.ok(m.parts.every(p => p.h1 <= 1.8 + 1e-9));
  assert.strictEqual(m.parts.filter(p => p.kind === 'wall' && p.h0 > 0).length, 0);   // sin dintel
});
test('hoja de puerta abierta 90° va hacia el lado de apertura', () => {
  const base = { id: 2, type: 'door', wall: 1, pos: 4, w: 1 };
  const a = M.build([mkWall(1, [0, 0], [10, 0]), Object.assign({ flip: false }, base)], {}).parts.find(p => p.kind === 'leaf');
  const b = M.build([mkWall(1, [0, 0], [10, 0]), Object.assign({ flip: true }, base)], {}).parts.find(p => p.kind === 'leaf');
  assert.ok(a.c[1] > 0.3); assert.ok(b.c[1] < -0.3);
  near(Math.abs(Math.sin(a.ang)), 1);
});
test('puerta cerrada queda dentro de la pared', () => {
  const l = M.build([mkWall(1, [0, 0], [10, 0]), { id: 2, type: 'door', wall: 1, pos: 4, w: 1 }], { doorAngle: 0 }).parts.find(p => p.kind === 'leaf');
  near(l.c[1], 0); near(l.ang, 0);
});
test('abertura de una pared oculta no se cuenta', () => {
  const m = M.build([{ id: 2, type: 'door', wall: 99, pos: 4, w: 1 }], {});
  assert.strictEqual(m.stats.doors, 0); assert.strictEqual(m.parts.length, 0); assert.strictEqual(m.bounds, null);
});
test('límites del modelo incluyen el espesor', () => {
  const m = M.build([mkWall(1, [0, 0], [10, 0], 0.2)], {});
  near(m.bounds.minx, -0.1); near(m.bounds.maxx, 10.1); near(m.bounds.miny, -0.1); near(m.bounds.maxy, 0.1);
});

test('cuarto cerrado: área interior', () => {
  const f = M.floorMask(room(0, 0, 6, 4), {});
  assert.ok(f.ok); assert.strictEqual(f.rooms.length, 1);
  const expected = (6 - 0.114) * (4 - 0.114);
  assert.ok(Math.abs(f.rooms[0].area - expected) / expected < 0.03, `${f.rooms[0].area} vs ${expected}`);
});
test('cuarto cerrado: la puerta no abre la máscara', () => {
  const f = M.floorMask(room(0, 0, 6, 4), {});
  const objs = room(0, 0, 6, 4).concat([{ id: 9, type: 'door', wall: 1, pos: 3, w: 1 }]);
  const g = M.floorMask(M.build(objs, {}).walls, {});
  near(g.rooms[0].area, f.rooms[0].area, 1e-6);
});
test('cuarto abierto (hueco en una pared): sin interior', () => {
  const walls = [
    mkWall(1, [0, 0], [2.5, 0]), mkWall(2, [3.5, 0], [6, 0]),   // hueco de 1 m abajo
    mkWall(3, [6, 0], [6, 4]), mkWall(4, [6, 4], [0, 4]), mkWall(5, [0, 4], [0, 0])
  ];
  const f = M.floorMask(walls, {});
  assert.strictEqual(f.rooms.length, 0); near(f.enclosedArea, 0);
});
test('dos cuartos con tabique', () => {
  const f = M.floorMask(room(0, 0, 8, 4).concat([mkWall(9, [4, 0], [4, 4])]), {});
  assert.strictEqual(f.rooms.length, 2);
  assert.ok(Math.abs(f.rooms[0].area - f.rooms[1].area) < 0.5);
});
test('esquinas sin extremos que se tocan quedan cerradas', () => {
  // paredes que terminan justo en el punto de la esquina, como las dibuja la herramienta
  const f = M.floorMask(room(0, 0, 5, 5), {});
  assert.strictEqual(f.rooms.length, 1);
});
test('punto de inicio dentro del cuarto más grande', () => {
  const f = M.floorMask(room(0, 0, 8, 4).concat([mkWall(9, [6, 0], [6, 4])]), {});
  assert.ok(f.start[0] > 0 && f.start[0] < 6 && f.start[1] > 0 && f.start[1] < 4, String(f.start));
});
test('forma en L: el punto de inicio cae dentro del cuarto', () => {
  const L = [mkWall(1, [0, 0], [8, 0]), mkWall(2, [8, 0], [8, 3]), mkWall(3, [8, 3], [3, 3]),
    mkWall(4, [3, 3], [3, 8]), mkWall(5, [3, 8], [0, 8]), mkWall(6, [0, 8], [0, 0])];
  const f = M.floorMask(L, {});
  assert.strictEqual(f.rooms.length, 1);
  const inside = (x, y) => (x > 0 && x < 8 && y > 0 && y < 3) || (x > 0 && x < 3 && y > 0 && y < 8);
  assert.ok(inside(f.start[0], f.start[1]), String(f.start));
});
test('la máscara incluye el piso bajo las paredes pero no afuera', () => {
  const f = M.floorMask(room(0, 0, 6, 4), {});
  const at = (x, y) => f.floor[Math.floor((y - f.oy) / f.cell) * f.nx + Math.floor((x - f.ox) / f.cell)];
  assert.strictEqual(at(3, 2), 1); assert.strictEqual(at(0, 2), 1); assert.strictEqual(at(-0.3, 2), 0); assert.strictEqual(at(3, 4.3), 0); assert.strictEqual(at(6.3, 2), 0);
});
test('el piso no asoma fuera de la pared exterior', () => {
  const f = M.floorMask(room(0, 0, 6, 4), {});
  const at = (x, y) => f.floor[Math.floor((y - f.oy) / f.cell) * f.nx + Math.floor((x - f.ox) / f.cell)];
  assert.strictEqual(at(-0.075, 2), 0);   // fuera de la pared
  assert.strictEqual(at(-0.03, 2), 1);    // bajo la pared
});
test('sin paredes no hay piso', () => assert.strictEqual(M.floorMask([], {}).ok, false));
test('plano largo no revienta la memoria', () => {
  const f = M.floorMask(room(0, 0, 120, 6), {});
  assert.ok(f.nx * f.ny <= 2500000); assert.strictEqual(f.rooms.length, 1);
});

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', con fallas' : ''}.`);
