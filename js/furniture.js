/* Cota — catálogo de muebles (puro: sin DOM ni Three.js, se prueba en Node).
 *
 * Cada mueble es un objeto del plano:  { type:'furn', kind, p:[x,y], w, d, ang }
 *   p    centro en el plano (metros)
 *   w, d ancho (eje x local) y fondo (eje y local)
 *   ang  grados, antihorario
 * El "fondo" del mueble (cabecera de la cama, respaldo del sofá, pared de atrás) está hacia +y local.
 * En una escalera, +y local es hacia donde se sube.
 *
 * boxes(kind, w, d) devuelve cajas en coordenadas locales para armarlo en 3D:
 *   { x, y, w, d, h0, h1, color }                                                                    */
(function (root) {
  'use strict';

  var IN = 0.0254;
  function inch(v) { return v * IN; }

  function B(x, y, w, d, h0, h1, color) { return { x: x, y: y, w: w, d: d, h0: h0, h1: h1, color: color }; }

  /* ---------- generadores ---------- */
  function bed(pillows) {
    return function (w, d) {
      var hd = d / 2, out = [
        B(0, 0, w, d, 0.08, 0.30, 0x8a6a4a),
        B(0, -0.04, w - 0.06, d - 0.14, 0.30, 0.52, 0xf2efe9),
        B(0, hd - 0.04, w + 0.04, 0.08, 0.08, 1.02, 0x6e5238),
        B(0, -d * 0.2, w - 0.04, d * 0.56, 0.52, 0.565, 0x7d8fa6)
      ];
      if (pillows === 2) {
        out.push(B(-w / 4, hd - 0.3, w / 2 - 0.1, 0.4, 0.52, 0.61, 0xffffff));
        out.push(B(w / 4, hd - 0.3, w / 2 - 0.1, 0.4, 0.52, 0.61, 0xffffff));
      } else out.push(B(0, hd - 0.3, w - 0.2, 0.4, 0.52, 0.61, 0xffffff));
      return out;
    };
  }

  function sofa(w, d) {
    var hd = d / 2, hw = w / 2, c = 0x5c6b7d, c2 = 0x6c7d92;
    return [
      B(0, 0, w, d, 0.1, 0.4, c),
      B(0, hd - 0.1, w, 0.2, 0.4, 0.85, c),
      B(-(hw - 0.1), -0.1, 0.2, d - 0.2, 0.4, 0.62, c),
      B(hw - 0.1, -0.1, 0.2, d - 0.2, 0.4, 0.62, c),
      B(0, -0.06, Math.max(0.2, w - 0.4), Math.max(0.2, d - 0.36), 0.4, 0.5, c2)
    ];
  }

  function table(h, color, legs) {
    return function (w, d) {
      var hw = w / 2, hd = d / 2, t = 0.04, l = legs || 0.06, out = [B(0, 0, w, d, h - t, h, color)];
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        out.push(B(s[0] * (hw - l), s[1] * (hd - l), l, l, 0, h - t, 0x7b5d3d));
      });
      return out;
    };
  }

  function chair(w, d) {
    var hw = w / 2, hd = d / 2, out = [B(0, 0, w, d, 0.42, 0.46, 0xa88055), B(0, hd - 0.02, w, 0.04, 0.46, 0.9, 0xa88055)];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { out.push(B(s[0] * (hw - 0.03), s[1] * (hd - 0.03), 0.04, 0.04, 0, 0.42, 0x7b5d3d)); });
    return out;
  }

  function block(h, color) { return function (w, d) { return [B(0, 0, w, d, 0, h, color)]; }; }

  function desk(w, d) {
    var out = table(0.74, 0x9a7650)(w, d);
    out.push(B(w / 2 - 0.22, 0, 0.4, d - 0.1, 0.1, 0.7, 0x86663f));
    return out;
  }

  function tv(w, d) {
    return [B(0, 0, w, d, 0, 0.5, 0x3a3330), B(0, 0.04, w * 0.72, 0.05, 0.6, 1.12, 0x111214), B(0, 0.04, 0.4, 0.2, 0.5, 0.6, 0x222222)];
  }

  function stove(w, d) {
    var b = [B(0, 0, w, d, 0, 0.9, 0xe8e8ea), B(0, 0, w - 0.04, d - 0.04, 0.9, 0.92, 0x222224)];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { b.push(B(s[0] * w * 0.22, s[1] * d * 0.2, 0.15, 0.15, 0.92, 0.94, 0x4a4a4e)); });
    return b;
  }

  function sink(w, d) {
    return [
      B(0, 0, w, d, 0, 0.86, 0xc9b79c), B(0, 0, w, d, 0.86, 0.9, 0xbfc3c7),
      B(0, -0.02, w * 0.62, d * 0.58, 0.9, 0.905, 0x7f8a93), B(0, d / 2 - 0.07, 0.04, 0.04, 0.9, 1.06, 0xb0b4b8)
    ];
  }

  function cabinet(w, d) { return [B(0, 0, w, d, 0, 0.86, 0xc9b79c), B(0, 0, w, d, 0.86, 0.9, 0xd9d9d6)]; }

  function washer(w, d) { return [B(0, 0, w, d, 0, 0.9, 0xf1f1f1), B(0, -d / 2 + 0.01, w * 0.55, 0.02, 0.2, 0.62, 0x9db3c8)]; }

  function toilet(w, d) {
    return [
      B(0, d / 2 - 0.1, w * 0.95, 0.2, 0, 0.78, 0xf4f4f4),
      B(0, -0.06, w * 0.9, d * 0.62, 0, 0.4, 0xf4f4f4),
      B(0, -0.06, w * 0.95, d * 0.66, 0.4, 0.43, 0xeaeaea)
    ];
  }

  function vanity(w, d) {
    return [
      B(0, d / 2 - 0.12, Math.min(0.2, w * 0.35), 0.2, 0, 0.7, 0xf4f4f4),
      B(0, 0, w, d, 0.7, 0.82, 0xf4f4f4), B(0, d / 2 - 0.06, 0.04, 0.04, 0.82, 0.96, 0xb0b4b8)
    ];
  }

  function shower(w, d) {
    return [B(0, 0, w, d, 0, 0.08, 0xe8e8e8), B(w / 2 - 0.06, d / 2 - 0.06, 0.04, 0.04, 0.08, 2.05, 0xaaaaaa), B(w / 2 - 0.2, d / 2 - 0.06, 0.3, 0.04, 2.0, 2.04, 0xaaaaaa)];
  }

  function tub(w, d) { return [B(0, 0, w, d, 0, 0.55, 0xf4f4f4), B(0, 0, w - 0.16, d - 0.16, 0.55, 0.56, 0xc7d8e4)]; }

  function car(w, d) {
    var hw = w / 2, out = [
      B(0, 0, w, d, 0.3, 0.84, 0x7e1f26),
      B(0, -d * 0.04, w - 0.2, d * 0.46, 0.84, 1.42, 0x701c22),
      B(0, -d * 0.04, w - 0.12, d * 0.46 - 0.16, 0.92, 1.32, 0x1d2630)
    ];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { out.push(B(s[0] * (hw - 0.1), s[1] * d * 0.31, 0.24, 0.66, 0, 0.66, 0x1b1b1b)); });
    return out;
  }

  /* escalera recta: los escalones suben hacia +y. rise = altura total que debe salvar */
  function stairs(w, d, rise) {
    var r = rise > 0.3 ? rise : 2.6;
    var n = Math.max(3, Math.round(r / 0.18)), out = [], run = d / n;
    for (var i = 0; i < n; i++) {
      var y = -d / 2 + (i + 0.5) * run;
      out.push(B(0, y, w, run + 0.002, 0, r * (i + 1) / n, i % 2 ? 0xb9b4aa : 0xc8c3b8));
    }
    return out;
  }

  /* ---------- catálogo (medidas en metros) ---------- */
  var CATALOG = [
    { id: 'cama-queen', name: 'Cama queen', cat: 'Dormitorio', w: 1.52, d: 2.03, wall: true, make: bed(2) },
    { id: 'cama-king', name: 'Cama king', cat: 'Dormitorio', w: 1.93, d: 2.03, wall: true, make: bed(2) },
    { id: 'cama-sencilla', name: 'Cama sencilla', cat: 'Dormitorio', w: 0.99, d: 1.91, wall: true, make: bed(1) },
    { id: 'closet', name: 'Clóset', cat: 'Dormitorio', w: 1.8, d: 0.6, wall: true, make: block(2.1, 0xd8d2c6) },
    { id: 'comoda', name: 'Cómoda', cat: 'Dormitorio', w: 1.0, d: 0.5, wall: true, make: block(0.85, 0xb89a74) },
    { id: 'sofa', name: 'Sofá 3 puestos', cat: 'Sala', w: 2.1, d: 0.92, wall: true, make: sofa },
    { id: 'sofa2', name: 'Sofá 2 puestos', cat: 'Sala', w: 1.6, d: 0.9, wall: true, make: sofa },
    { id: 'sillon', name: 'Sillón', cat: 'Sala', w: 0.9, d: 0.9, wall: true, make: sofa },
    { id: 'mesa-centro', name: 'Mesa de centro', cat: 'Sala', w: 1.1, d: 0.6, make: table(0.42, 0x8a6a4a, 0.05) },
    { id: 'tv', name: 'Mueble de TV', cat: 'Sala', w: 1.5, d: 0.45, wall: true, make: tv },
    { id: 'mesa-comedor', name: 'Mesa de comedor', cat: 'Comedor', w: 1.8, d: 0.9, make: table(0.76, 0x9a7650) },
    { id: 'silla', name: 'Silla', cat: 'Comedor', w: 0.45, d: 0.45, make: chair },
    { id: 'escritorio', name: 'Escritorio', cat: 'Comedor', w: 1.4, d: 0.7, wall: true, make: desk },
    { id: 'nevera', name: 'Nevera', cat: 'Cocina', w: 0.9, d: 0.75, wall: true, make: block(1.78, 0xc9ccd0) },
    { id: 'estufa', name: 'Estufa', cat: 'Cocina', w: 0.76, d: 0.65, wall: true, make: stove },
    { id: 'fregadero', name: 'Fregadero', cat: 'Cocina', w: 0.9, d: 0.6, wall: true, make: sink },
    { id: 'gabinete', name: 'Gabinete', cat: 'Cocina', w: 0.6, d: 0.6, wall: true, make: cabinet },
    { id: 'lavadora', name: 'Lavadora', cat: 'Cocina', w: 0.68, d: 0.7, wall: true, make: washer },
    { id: 'inodoro', name: 'Inodoro', cat: 'Baño', w: 0.4, d: 0.7, wall: true, make: toilet },
    { id: 'lavamanos', name: 'Lavamanos', cat: 'Baño', w: 0.6, d: 0.5, wall: true, make: vanity },
    { id: 'ducha', name: 'Ducha', cat: 'Baño', w: 0.9, d: 0.9, wall: true, make: shower },
    { id: 'banera', name: 'Bañera', cat: 'Baño', w: 1.52, d: 0.76, wall: true, make: tub },
    { id: 'carro', name: 'Carro', cat: 'Garaje', w: 1.85, d: 4.5, make: car },
    { id: 'mesa-trabajo', name: 'Mesa de trabajo', cat: 'Garaje', w: 1.8, d: 0.7, wall: true, make: table(0.9, 0x7c7f83, 0.07) },
    { id: 'estante', name: 'Estante', cat: 'Garaje', w: 1.2, d: 0.45, wall: true, make: block(1.9, 0x6d7076) },
    { id: 'escalera', name: 'Escalera recta', cat: 'Escalera', w: 1.0, d: 3.0, stairs: true, make: stairs }
  ];
  var BY_ID = {};
  CATALOG.forEach(function (c) { BY_ID[c.id] = c; });

  function get(kind) { return BY_ID[kind] || null; }
  function cats() {
    var out = [];
    CATALOG.forEach(function (c) { if (out.indexOf(c.cat) < 0) out.push(c.cat); });
    return out;
  }

  /** Cajas locales del mueble para armarlo en 3D. rise solo importa para escaleras. */
  function boxes(kind, w, d, rise) {
    var c = BY_ID[kind];
    if (!c) return [B(0, 0, w, d, 0, 0.5, 0x999999)];
    return c.make(w, d, rise);
  }

  /* ---------- geometría del mueble en el plano ---------- */
  function frame(f) {
    var a = (f.ang || 0) * Math.PI / 180;
    return { c: Math.cos(a), s: Math.sin(a), a: a };
  }
  /** local (lx, ly) -> plano */
  function toWorld(f, lx, ly) {
    var r = frame(f);
    return [f.p[0] + lx * r.c - ly * r.s, f.p[1] + lx * r.s + ly * r.c];
  }
  /** plano -> local */
  function toLocal(f, x, y) {
    var r = frame(f), dx = x - f.p[0], dy = y - f.p[1];
    return [dx * r.c + dy * r.s, -dx * r.s + dy * r.c];
  }
  function corners(f) {
    var hw = f.w / 2, hd = f.d / 2;
    return [toWorld(f, -hw, -hd), toWorld(f, hw, -hd), toWorld(f, hw, hd), toWorld(f, -hw, hd)];
  }
  function contains(f, x, y, pad) {
    var l = toLocal(f, x, y), e = pad || 0;
    return Math.abs(l[0]) <= f.w / 2 + e && Math.abs(l[1]) <= f.d / 2 + e;
  }
  /** distancia de un punto al mueble (0 si está encima) */
  function distTo(f, x, y) {
    var l = toLocal(f, x, y);
    var dx = Math.max(Math.abs(l[0]) - f.w / 2, 0), dy = Math.max(Math.abs(l[1]) - f.d / 2, 0);
    return Math.hypot(dx, dy);
  }

  /** Si hay una pared cerca, pega el fondo del mueble a ella. walls = [{a,b,t}]. Devuelve {p, ang} o null. */
  function alignToWall(pt, w, d, walls, reach) {
    var best = null;
    walls.forEach(function (wl) {
      var ax = wl.b[0] - wl.a[0], ay = wl.b[1] - wl.a[1], L = Math.hypot(ax, ay);
      if (L < 1e-9) return;
      var ux = ax / L, uy = ay / L, nx = -uy, ny = ux;
      var s = (pt[0] - wl.a[0]) * ux + (pt[1] - wl.a[1]) * uy;
      var side = (pt[0] - wl.a[0]) * nx + (pt[1] - wl.a[1]) * ny;
      var off = wl.t / 2 + d / 2;
      var gap = Math.abs(side) - off;
      if (s < -wl.t || s > L + wl.t) return;
      if (gap > reach || gap < -(d / 2 + wl.t / 2)) return;
      var score = Math.abs(gap);
      if (!best || score < best.score) best = { score: score, wl: wl, ux: ux, uy: uy, nx: nx, ny: ny, s: s, sg: side < 0 ? -1 : 1, L: L };
    });
    if (!best) return null;
    var sc = Math.max(w / 2, Math.min(best.L - w / 2, best.s));
    if (best.L < w) sc = best.L / 2;
    var off2 = best.wl.t / 2 + d / 2;
    var cx = best.wl.a[0] + best.ux * sc + best.nx * best.sg * off2;
    var cy = best.wl.a[1] + best.uy * sc + best.ny * best.sg * off2;
    var bx = -best.nx * best.sg, by = -best.ny * best.sg;       // hacia la pared
    var ang = Math.atan2(by, bx) * 180 / Math.PI - 90;
    ang = Math.round(((ang % 360) + 360) % 360 * 1000) / 1000;
    if (ang >= 359.9995) ang = 0;
    return { p: [cx, cy], ang: ang };
  }

  var api = {
    CATALOG: CATALOG, get: get, cats: cats, boxes: boxes, inch: inch,
    toWorld: toWorld, toLocal: toLocal, corners: corners, contains: contains, distTo: distTo, alignToWall: alignToWall
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaFurn = api;
})(this);
