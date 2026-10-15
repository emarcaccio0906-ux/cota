/* Pruebas de muebles, plantillas, cuartos y escaleras.  node tests/test2.js */
'use strict';
const assert = require('assert');
const F = require('../js/furniture.js');
const G = require('../js/geom.js');
const M = require('../js/model3d.js');
const T = require('../js/templates.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FALLÓ  ' + name + '\n        ' + e.message); process.exitCode = 1; }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} no es cercano a ${b}`);

console.log('Muebles');
test('el catálogo tiene piezas completas', () => {
  assert.ok(F.CATALOG.length >= 20);
  F.CATALOG.forEach(c => {
    assert.ok(c.w > 0.2 && c.d > 0.2, c.id);
    const bx = F.boxes(c.id, c.w, c.d, 2.6);
    assert.ok(bx.length >= 1, c.id);
    bx.forEach(b => {
      assert.ok(b.w > 0 && b.d > 0 && b.h1 > b.h0 && b.h0 >= 0, c.id);
      assert.ok(Math.abs(b.x) <= c.w / 2 + 1e-9 && Math.abs(b.y) <= c.d / 2 + 1e-9, c.id + ' sale de su huella');
      assert.ok(Math.abs(b.x) + b.w / 2 <= c.w / 2 + 0.06 && Math.abs(b.y) + b.d / 2 <= c.d / 2 + 0.06, c.id + ' caja fuera de la huella');
    });
  });
});
test('esquinas, giro y contiene', () => {
  const f = { p: [2, 3], w: 2, d: 1, ang: 90 };
  const c = F.corners(f);
  near(c[0][0], 2.5); near(c[0][1], 2);          // (-1,-0.5) girado 90° -> (0.5,-1)
  assert.ok(F.contains(f, 2, 3.9)); assert.ok(!F.contains(f, 3.2, 3));
  near(F.distTo(f, 2, 3), 0); near(F.distTo(f, 4, 3), 1.5);
});
test('toLocal es el inverso de toWorld', () => {
  const f = { p: [5, -2], w: 1, d: 1, ang: 33 };
  const w = F.toWorld(f, 0.3, -0.7), l = F.toLocal(f, w[0], w[1]);
  near(l[0], 0.3); near(l[1], -0.7);
});
test('alignToWall pega el fondo a la pared', () => {
  const wl = { a: [0, 0], b: [6, 0], t: 0.1 };           // pared horizontal
  const r = F.alignToWall([2, 0.9], 1.5, 0.9, [wl], 0.5);
  assert.ok(r); near(r.ang, 180); near(r.p[0], 2); near(r.p[1], 0.05 + 0.45);
  const r2 = F.alignToWall([2, -0.9], 1.5, 0.9, [wl], 0.5);
  near(r2.ang, 0); near(r2.p[1], -0.5);
  assert.strictEqual(F.alignToWall([2, 3], 1.5, 0.9, [wl], 0.5), null);
});
test('geom: elegir, mover y girar un mueble', () => {
  const f = { type: 'furn', kind: 'sofa', p: [1, 1], w: 2, d: 1, ang: 0 };
  near(G.distToObject([1, 1], f, {}), 0);
  const b = G.bboxOf(f, {}); near(b.minx, 0); near(b.maxy, 1.5);
  G.translateObj(f, 1, 1); near(f.p[0], 2);
  G.rotateObj(f, [2, 2], Math.PI / 2); near(f.ang, 90); near(f.p[0], 2); near(f.p[1], 2);
});

console.log('Cuartos y escaleras');
function boxWalls(x0, y0, x1, y1, t) {
  return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].map((s, i) => ({ id: i + 1, type: 'wall', a: [s[0], s[1]], b: [s[2], s[3]], t: t || 0.1 }));
}
test('roomAt encuentra el cuarto', () => {
  const walls = boxWalls(0, 0, 4, 3).concat([{ id: 9, type: 'wall', a: [2, 0], b: [2, 3], t: 0.1 }]);
  const mk = M.floorMask(walls, {});
  assert.strictEqual(mk.rooms.length, 2);
  const a = M.roomAt(mk, 1, 1.5), b = M.roomAt(mk, 3, 1.5);
  assert.ok(a && b && a.id !== b.id);
  assert.strictEqual(M.roomAt(mk, 10, 10), null);
  assert.strictEqual(M.roomAt(mk, 2, 1.5), null);       // sobre la pared
  near(a.area, 1.9 * 2.9, 0.4);
});
test('carve abre un hueco con la forma de la escalera', () => {
  const mk = M.floorMask(boxWalls(0, 0, 6, 4), {});
  const arr = Uint8Array.from(mk.floor);
  const st = { type: 'furn', kind: 'escalera', p: [3, 2], w: 1, d: 3, ang: 0 };
  M.carve(mk, arr, st);
  const at = (a, x, y) => a[Math.floor((y - mk.oy) / mk.cell) * mk.nx + Math.floor((x - mk.ox) / mk.cell)];
  assert.strictEqual(at(arr, 3, 2), 0); assert.strictEqual(at(arr, 3, 3.4), 0); assert.strictEqual(at(arr, 1, 2), 1);
  assert.strictEqual(at(mk.floor, 3, 2), 1);              // el original no cambia
});
test('furnParts de una escalera sube hasta la altura pedida', () => {
  const parts = M.furnParts({ id: 1, kind: 'escalera', p: [0, 0], w: 1, d: 3, ang: 0 }, 2.7);
  const top = Math.max(...parts.map(p => p.h1));
  near(top, 2.7);
  assert.ok(parts.length >= 12);
  parts.forEach(p => assert.strictEqual(p.kind, 'furn'));
});

console.log('Plantillas');
function levelsOf(t) { return t.levels.map(l => ({ l, objs: t.objects.filter(o => (o.lv || t.levels[0].id) === l.id) })); }
function rectsOverlap(a, b, shrink) {
  // SAT con dos rectángulos girados, algo reducidos
  const ca = F.corners(Object.assign({}, a, { w: a.w - shrink, d: a.d - shrink })), cb = F.corners(Object.assign({}, b, { w: b.w - shrink, d: b.d - shrink }));
  function axes(c) { return [[c[1][0] - c[0][0], c[1][1] - c[0][1]], [c[3][0] - c[0][0], c[3][1] - c[0][1]]]; }
  return !axes(ca).concat(axes(cb)).some(ax => {
    const proj = c => c.map(p => p[0] * ax[0] + p[1] * ax[1]);
    const pa = proj(ca), pb = proj(cb);
    return Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa);
  });
}
const EXPECT = { blank: [0], studio: [2], apartamento: [4], casa: [6], casa2: [3, 4], garaje: [1] };

T.LIST.forEach(item => {
  const t = T.build(item.id);
  test(`${item.name}: estructura válida`, () => {
    assert.ok(t && t.objects && t.levels.length >= 1);
    const ids = new Set();
    t.objects.forEach(o => { assert.ok(!ids.has(o.id)); ids.add(o.id); assert.ok(t.levels.some(l => l.id === o.lv), 'nivel'); });
    const byId = {}; t.objects.forEach(o => byId[o.id] = o);
    t.objects.filter(o => o.type === 'door' || o.type === 'window').forEach(o => {
      const w = byId[o.wall]; assert.ok(w && w.type === 'wall' && w.lv === o.lv, 'abertura sin pared');
      const L = G.dist(w.a, w.b);
      assert.ok(o.pos - o.w / 2 >= -1e-9 && o.pos + o.w / 2 <= L + 1e-9, `abertura fuera de la pared ${o.id} (${o.pos / 0.3048} / ${L / 0.3048})`);
    });
    // aberturas que no se cruzan
    const ops = t.objects.filter(o => o.type === 'door' || o.type === 'window');
    ops.forEach((a, i) => ops.slice(i + 1).forEach(b => {
      if (a.wall === b.wall) assert.ok(a.pos + a.w / 2 <= b.pos - b.w / 2 + 1e-9 || b.pos + b.w / 2 <= a.pos - a.w / 2 + 1e-9, `aberturas se cruzan en pared ${a.wall}`);
    }));
  });
  test(`${item.name}: cuartos cerrados`, () => {
    const exp = EXPECT[item.id];
    levelsOf(t).forEach(({ l, objs }, i) => {
      const walls = objs.filter(o => o.type === 'wall');
      if (!walls.length) { assert.strictEqual(exp[0], 0); return; }
      const mk = M.floorMask(walls, {});
      assert.strictEqual(mk.rooms.length, exp[Math.min(i, exp.length - 1)], `${l.name}: ${mk.rooms.length} cuartos`);
      objs.filter(o => o.type === 'room').forEach(r => assert.ok(M.roomAt(mk, r.p[0], r.p[1]), `etiqueta "${r.name}" fuera de un cuarto`));
    });
  });
  test(`${item.name}: muebles dentro y sin chocar`, () => {
    levelsOf(t).forEach(({ l, objs }) => {
      const walls = objs.filter(o => o.type === 'wall');
      const fs = objs.filter(o => o.type === 'furn');
      if (!fs.length) return;
      const mk = M.floorMask(walls, {});
      fs.forEach(f => {
        const c = M.roomAt(mk, f.p[0], f.p[1]);
        assert.ok(c, `${f.kind} (${l.name}) tiene el centro fuera de los cuartos`);
        F.corners(f).forEach(p => {
          const i = Math.floor((p[0] - mk.ox) / mk.cell), j = Math.floor((p[1] - mk.oy) / mk.cell);
          assert.ok(i >= 0 && j >= 0 && i < mk.nx && j < mk.ny && mk.floor[j * mk.nx + i] === 1, `${f.kind} (${l.name}) sale del edificio`);
        });
      });
      fs.forEach((a, i) => fs.slice(i + 1).forEach(b => {
        assert.ok(!rectsOverlap(a, b, 0.04), `${a.kind} choca con ${b.kind} en ${l.name} (${(a.p[0] / 0.3048).toFixed(1)},${(a.p[1] / 0.3048).toFixed(1)}) / (${(b.p[0] / 0.3048).toFixed(1)},${(b.p[1] / 0.3048).toFixed(1)})`);
      }));
    });
  });
});
test('la casa de dos pisos tiene 2 niveles y una escalera', () => {
  const t = T.build('casa2');
  assert.strictEqual(t.levels.length, 2);
  assert.strictEqual(t.objects.filter(o => o.kind === 'escalera').length, 1);
});
test('plantilla desconocida da null', () => assert.strictEqual(T.build('xx'), null));

console.log(`\n${passed} pruebas pasaron${process.exitCode ? ', con fallas' : ''}.`);
