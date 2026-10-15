/* Cota — plantillas para empezar sin hoja en blanco (puro: se prueba en Node).
 * Las medidas de aquí están escritas en pies; se guardan en metros como todo el plano.
 *
 * T.LIST   lista de plantillas {id, name, desc}
 * T.build(id) devuelve {objects, nextId, levels, level} listo para ponerle las capas encima. */
(function (root) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports) ? require('./furniture.js') : root.CotaFurn;
  var FT = 0.3048;

  function Builder() {
    var b = this;
    b.objects = []; b.nextId = 1; b.lv = 'p1'; b.levels = [{ id: 'p1', name: 'Planta baja' }];

    function push(o) { o.id = b.nextId++; o.lv = b.lv; b.objects.push(o); return o; }
    function pt(x, y) { return [x * FT, y * FT]; }

    b.level = function (id, name) {
      if (!b.levels.some(function (l) { return l.id === id; })) b.levels.push({ id: id, name: name || id });
      b.lv = id;
    };
    b.wall = function (ax, ay, bx, by, t) {
      return push({ type: 'wall', layer: 'paredes', a: pt(ax, ay), b: pt(bx, by), t: (t || 0.375) * FT });
    };
    /** Cuatro paredes alrededor de (x0,y0)-(x1,y1). El lado "interior" de cada una es su lado +1. */
    b.box = function (x0, y0, x1, y1, t) {
      return {
        s: b.wall(x0, y0, x1, y0, t), e: b.wall(x1, y0, x1, y1, t),
        n: b.wall(x1, y1, x0, y1, t), w: b.wall(x0, y1, x0, y0, t)
      };
    };
    function opening(type, wall, pos, width, into, extra) {
      var o = { type: type, layer: 'aberturas', wall: wall.id, pos: pos * FT, w: width * FT, flip: into === -1 };
      if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
      return push(o);
    }
    b.door = function (wall, pos, width, into) { return opening('door', wall, pos, width, into); };
    b.garageDoor = function (wall, pos, width) { return opening('door', wall, pos, width, 1, { roll: true }); };
    b.win = function (wall, pos, width) { return opening('window', wall, pos, width, 1); };

    function wallFrame(wall) {
      var dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], L = Math.hypot(dx, dy);
      var u = [dx / L, dy / L];
      return { a: wall.a, u: u, n: [-u[1], u[0]], t: wall.t };
    }
    /** Mueble con el fondo pegado a la pared. pos en pies sobre la pared; side +1 / -1 = lado de la normal. */
    b.onWall = function (kind, wall, pos, side) {
      var c = F.get(kind), f = wallFrame(wall), off = f.t / 2 + c.d / 2 + 0.004;
      var cx = f.a[0] + f.u[0] * pos * FT + f.n[0] * side * off;
      var cy = f.a[1] + f.u[1] * pos * FT + f.n[1] * side * off;
      var ang = Math.atan2(-f.n[1] * side, -f.n[0] * side) * 180 / Math.PI - 90;
      ang = ((Math.round(ang * 1000) / 1000) % 360 + 360) % 360;
      return push({ type: 'furn', layer: 'muebles', kind: kind, p: [cx, cy], w: c.w, d: c.d, ang: ang });
    };
    b.furn = function (kind, x, y, ang) {
      var c = F.get(kind);
      return push({ type: 'furn', layer: 'muebles', kind: kind, p: pt(x, y), w: c.w, d: c.d, ang: ang || 0 });
    };
    b.room = function (name, x, y) { return push({ type: 'room', layer: 'cuartos', p: pt(x, y), name: name }); };
    b.dim = function (ax, ay, bx, by, off) { return push({ type: 'dim', layer: 'cotas', a: pt(ax, ay), b: pt(bx, by), off: off * FT }); };
    b.result = function () { return { objects: b.objects, nextId: b.nextId, levels: b.levels, level: b.levels[0].id }; };
  }

  var EXT = 0.667, INT = 0.375;

  var BUILDERS = {
    blank: function (b) { void b; },

    studio: function (b) {
      var X = b.box(0, 0, 24, 16, EXT);
      var v = b.wall(17, 16, 17, 8, INT);            // baño al noreste
      var h = b.wall(17, 8, 24, 8, INT);
      b.door(X.s, 12.5, 3, 1);
      b.win(X.n, 10, 4); b.win(X.w, 6, 3); b.win(X.n, 3.7, 2);
      b.door(h, 3, 2.5, -1);
      b.onWall('sofa', X.s, 8, 1);
      b.onWall('nevera', X.s, 16.2, 1); b.onWall('estufa', X.s, 19.2, 1); b.onWall('fregadero', X.s, 22.1, 1);
      b.onWall('cama-queen', X.w, 6, 1);
      b.onWall('tv', X.n, 16, 1);
      b.furn('mesa-centro', 8, 4.6, 0);
      b.onWall('inodoro', X.e, 14, 1); b.onWall('lavamanos', X.n, 4.5, 1); b.onWall('ducha', X.e, 10, 1);
      b.room('Estudio', 11, 9); b.room('Baño', 20.5, 12);
      b.dim(0, 0, 24, 0, -3); b.dim(24, 0, 24, 16, -3);
    },

    apartamento: function (b) {
      var X = b.box(0, 0, 30, 28, EXT);
      var v = b.wall(12, 0, 12, 28, INT);
      var h1 = b.wall(0, 11, 12, 11, INT), h2 = b.wall(0, 17, 12, 17, INT);
      b.door(v, 3, 2.5, -1); b.door(v, 14, 2.25, -1); b.door(v, 22, 2.5, -1);
      b.door(X.e, 12, 3, 1);
      b.win(X.w, 5, 4); b.win(X.w, 22.5, 4); b.win(X.w, 14, 1.5);
      b.win(X.n, 24, 4); b.win(X.n, 10, 5); b.win(X.n, 4, 3);
      b.win(X.s, 6, 3); b.win(X.s, 20, 3);
      // dormitorio 1 (noroeste)
      b.onWall('cama-queen', X.n, 24, 1); b.onWall('closet', X.w, 7, 1);
      // dormitorio 2 (suroeste)
      b.onWall('cama-sencilla', X.w, 22, 1); b.onWall('closet', h1, 8, -1);
      // baño
      b.onWall('inodoro', X.w, 14, 1); b.onWall('banera', h1, 6, 1); b.onWall('lavamanos', h2, 9, -1);
      // sala, comedor y cocina
      b.onWall('sofa', X.n, 8, 1); b.furn('mesa-centro', 22, 22.5, 0); b.onWall('tv', X.e, 20, 1);
      b.furn('mesa-comedor', 21, 14, 0);
      b.furn('silla', 19.5, 16.5, 0); b.furn('silla', 22.5, 16.5, 0); b.furn('silla', 19.5, 11.5, 180); b.furn('silla', 22.5, 11.5, 180);
      b.onWall('nevera', X.s, 14, 1); b.onWall('estufa', X.s, 17.2, 1); b.onWall('fregadero', X.s, 20.4, 1);
      b.onWall('gabinete', X.s, 23.2, 1); b.onWall('gabinete', X.s, 25.2, 1);
      b.room('Dormitorio 1', 6, 21); b.room('Dormitorio 2', 3, 9.5); b.room('Baño', 6, 14.5); b.room('Sala y cocina', 21, 7);
      b.dim(0, 0, 30, 0, -3); b.dim(30, 0, 30, 28, -3);
    },

    casa: function (b) {
      var X = b.box(0, 0, 42, 30, EXT);
      var v1 = b.wall(14, 0, 14, 30, INT);
      var h17 = b.wall(0, 17, 14, 17, INT), h11 = b.wall(0, 11, 14, 11, INT), v7 = b.wall(7, 11, 7, 17, INT);
      var v30 = b.wall(30, 0, 30, 11, INT), h11b = b.wall(30, 11, 42, 11, INT);
      b.door(v1, 5, 2.5, -1); b.door(v1, 14, 2.25, -1); b.door(v1, 24, 2.67, -1);
      b.door(h17, 3.5, 2.25, 1);
      b.door(v30, 5, 2.5, 1);
      b.door(X.s, 17, 3, 1);
      b.win(X.n, 35, 5); b.win(X.n, 20, 6); b.win(X.n, 7, 5);
      b.win(X.w, 5, 4); b.win(X.w, 16, 2); b.win(X.w, 25, 4);
      b.win(X.s, 4, 3); b.win(X.e, 20, 5); b.win(X.e, 5, 4);
      // principal
      b.onWall('cama-king', X.n, 35, 1); b.onWall('closet', X.w, 9, 1); b.onWall('comoda', h17, 10, 1);
      // baño principal
      b.onWall('inodoro', X.w, 17, 1); b.onWall('ducha', X.w, 14.7, 1); b.onWall('lavamanos', v7, 1.7, 1);
      // baño 2
      b.onWall('inodoro', v1, 12, 1); b.onWall('ducha', h17, 10.5, -1); b.onWall('lavamanos', v7, 3, -1);
      // dormitorio 2
      b.onWall('cama-queen', X.w, 25, 1); b.onWall('closet', X.s, 10.5, 1); b.onWall('escritorio', h11, 10, -1);
      // dormitorio 3
      b.onWall('cama-sencilla', X.e, 5, 1); b.onWall('closet', X.s, 36, 1);
      // sala, comedor y cocina
      b.onWall('sofa', X.n, 20, 1); b.onWall('tv', X.s, 24, 1); b.furn('mesa-centro', 22, 15, 0);
      b.furn('mesa-comedor', 34, 22, 0);
      b.furn('silla', 32.5, 24.3, 0); b.furn('silla', 35.5, 24.3, 0); b.furn('silla', 32.5, 19.7, 180); b.furn('silla', 35.5, 19.7, 180);
      b.onWall('nevera', X.n, 4, 1); b.onWall('estufa', X.n, 7.2, 1); b.onWall('fregadero', X.n, 11, 1);
      b.onWall('gabinete', X.n, 13.5, 1); b.onWall('gabinete', X.n, 15.5, 1);
      b.room('Dormitorio principal', 8, 22); b.room('Baño principal', 3.5, 14); b.room('Baño 2', 10.5, 14);
      b.room('Dormitorio 2', 5, 9); b.room('Dormitorio 3', 36, 8); b.room('Sala, comedor y cocina', 22, 8);
      b.dim(0, 0, 42, 0, -3); b.dim(42, 0, 42, 30, -3);
    },

    garaje: function (b) {
      var X = b.box(0, 0, 22, 24, EXT);
      b.garageDoor(X.s, 11, 16);
      b.door(X.e, 18, 3, 1);
      b.win(X.n, 11, 4); b.win(X.w, 12, 3);
      b.furn('carro', 5.8, 11, 0); b.furn('carro', 16.2, 11, 0);
      b.onWall('mesa-trabajo', X.n, 6, 1); b.onWall('estante', X.w, 3, 1); b.onWall('estante', X.n, 17, 1);
      b.room('Garaje', 11, 20);
      b.dim(0, 0, 22, 0, -3); b.dim(22, 0, 22, 24, -3);
    },

    casa2: function (b) {
      var X = b.box(0, 0, 30, 24, EXT);
      var v = b.wall(19, 0, 19, 24, INT), h8 = b.wall(19, 8, 30, 8, INT);
      b.door(X.s, 14, 3, 1);
      b.door(v, 6, 3, -1);
      b.door(h8, 3, 2.25, 1);
      b.win(X.w, 6, 4); b.win(X.w, 15, 4); b.win(X.n, 22, 5); b.win(X.n, 4, 3); b.win(X.s, 24.5, 2);
      b.onWall('sofa', X.n, 23, 1); b.onWall('tv', X.s, 7, 1); b.furn('mesa-centro', 7, 18.5, 0);
      b.furn('mesa-comedor', 11, 15, 0);
      b.furn('silla', 9.5, 17.4, 0); b.furn('silla', 12.5, 17.4, 0); b.furn('silla', 9.5, 12.6, 180); b.furn('silla', 12.5, 12.6, 180);
      b.onWall('nevera', v, 21.9, 1); b.onWall('estufa', v, 18.9, 1); b.onWall('fregadero', v, 15.7, 1); b.onWall('gabinete', v, 13, 1);
      b.onWall('inodoro', X.e, 3, 1); b.onWall('lavamanos', h8, 6, -1);
      b.furn('escalera', 28, 15, 0);
      b.room('Sala, comedor y cocina', 9, 8); b.room('Baño social', 24, 4); b.room('Pasillo', 22.5, 14);
      b.dim(0, 0, 30, 0, -3); b.dim(30, 0, 30, 24, -3);

      b.level('p2', 'Piso 2');
      var Y = b.box(0, 0, 30, 24, EXT);
      var w16 = b.wall(16, 0, 16, 24, INT), w11 = b.wall(0, 11, 16, 11, INT), w7 = b.wall(16, 7, 30, 7, INT);
      b.door(w16, 17.5, 2.67, -1); b.door(w16, 4, 2.5, -1); b.door(w7, 3, 2.25, 1);
      b.win(Y.n, 22, 4); b.win(Y.n, 5, 3); b.win(Y.w, 10, 4); b.win(Y.w, 16, 3); b.win(Y.s, 4, 3); b.win(Y.s, 24, 2);
      b.onWall('cama-king', Y.n, 22, 1); b.onWall('closet', Y.w, 4, 1); b.onWall('comoda', w11, 10, 1);
      b.onWall('cama-sencilla', Y.w, 20, 1); b.onWall('escritorio', w11, 10, -1); b.onWall('closet', Y.s, 12, 1);
      b.onWall('inodoro', Y.e, 3, 1); b.onWall('ducha', Y.s, 18, 1); b.onWall('lavamanos', w7, 7, -1);
      b.room('Dormitorio principal', 8, 14); b.room('Dormitorio 2', 8, 7); b.room('Baño', 22, 2.5); b.room('Pasillo', 22, 14);
      b.dim(0, 0, 30, 0, -3); b.dim(30, 0, 30, 24, -3);
    }
  };

  var LIST = [
    { id: 'blank', name: 'En blanco', desc: 'Empieza de cero.' },
    { id: 'studio', name: 'Estudio', desc: '24′ × 16′ · un ambiente, cocina y baño.' },
    { id: 'apartamento', name: 'Apartamento', desc: '30′ × 28′ · 2 dormitorios, baño, sala y cocina.' },
    { id: 'casa', name: 'Casa de un piso', desc: '42′ × 30′ · 3 dormitorios, 2 baños, sala y cocina.' },
    { id: 'casa2', name: 'Casa de dos pisos', desc: '30′ × 24′ · 2 plantas con escalera.' },
    { id: 'garaje', name: 'Garaje', desc: '22′ × 24′ · 2 carros y mesa de trabajo.' }
  ];

  function build(id) {
    var b = new Builder();
    var fn = BUILDERS[id];
    if (!fn) return null;
    fn(b);
    return b.result();
  }

  var api = { LIST: LIST, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaTemplates = api;
})(this);
