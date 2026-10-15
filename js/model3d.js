/* Cota — modelo 3D puro (sin Three.js ni DOM, se prueba en Node).
 * Convierte el plano 2D en piezas: cajas orientadas (paredes, dinteles, antepechos, marcos,
 * vidrios, hojas de puerta) y una máscara de piso que detecta los cuartos cerrados.
 *
 * Coordenadas: las del plano, en metros, Y hacia arriba. La vista 3D las lleva a (x, altura, -y).
 * Una caja es: { kind, c:[cx,cy], ang, len, thick, h0, h1, wall }
 *   c      centro en el plano
 *   ang    ángulo del eje largo, en radianes
 *   len    largo sobre ese eje, thick el espesor perpendicular, h0..h1 la altura. */
(function (root) {
  'use strict';

  var G = (typeof module !== 'undefined' && module.exports) ? require('./geom.js') : root.CotaGeom;
  var F = (typeof module !== 'undefined' && module.exports) ? require('./furniture.js') : root.CotaFurn;

  var DEFAULTS = {
    wallH: 2.4384,      // 8'
    doorH: 2.032,       // 6'-8"
    sillH: 0.9144,      // 3'
    winH: 1.2192,       // 4'
    leafT: 0.045,
    doorAngle: 90       // grados; 0 = puerta cerrada
  };

  var EPS = 0.004;   // las piezas se traslapan 4 mm para que no queden rendijas entre cajas

  function withDefaults(o) {
    var r = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      r[k] = (o && typeof o[k] === 'number' && isFinite(o[k])) ? o[k] : DEFAULTS[k];
    });
    return r;
  }

  /** Piezas de una pared y de las aberturas que tiene. */
  function wallParts(w, openings, o) {
    var info = G.wallInfo(w), L = info.L, H = o.wallH, parts = [];
    if (L < 1e-9) return parts;
    var ang = Math.atan2(info.u[1], info.u[0]);

    function add(kind, s0, s1, h0, h1, thick) {
      if (s1 - s0 < 1e-6 || h1 - h0 < 1e-6) return;
      var mid = (s0 + s1) / 2;
      parts.push({
        kind: kind, c: G.add(info.a, G.mul(info.u, mid)), ang: ang,
        len: s1 - s0, thick: thick || w.t, h0: h0, h1: h1, wall: w.id
      });
    }

    // tramos macizos; los extremos libres se alargan medio espesor para cerrar las esquinas
    G.solidRanges(w, openings).forEach(function (r) {
      add('wall', r[0] <= 1e-9 ? -w.t / 2 : r[0], r[1] >= L - 1e-9 ? L + w.t / 2 : r[1], 0, H);
    });

    openings.forEach(function (op) {
      var lo = Math.max(0, op.pos - op.w / 2), hi = Math.min(L, op.pos + op.w / 2);
      if (hi - lo < 1e-6) return;

      if (op.type === 'door') {
        var head = Math.min(o.doorH, H);
        add('wall', lo - EPS, hi + EPS, head, H);                  // muro sobre la puerta
        var tw = w.t + 0.02;
        add('trim', lo, lo + 0.045, 0, head, tw);                  // jambas y cabezal
        add('trim', hi - 0.045, hi, 0, head, tw);
        add('trim', lo + 0.045, hi - 0.045, head - 0.045, head, tw);

        if (op.roll) {                                             // portón enrollable: subido, no estorba
          add('trim', lo + 0.045, hi - 0.045, head - 0.25, head, w.t + 0.04);
          return;
        }
        var g = G.openingGeom(op, w);
        var len = Math.max(0.2, op.w - 0.09);
        var th = o.doorAngle * Math.PI / 180;
        var hinge = G.add(g.p0, G.mul(g.u, 0.045));
        var dir = G.add(G.mul(g.u, Math.cos(th)), G.mul(g.n, Math.sin(th)));
        parts.push({
          kind: 'leaf', c: G.add(hinge, G.mul(dir, len / 2)), ang: Math.atan2(dir[1], dir[0]),
          len: len, thick: o.leafT, h0: 0, h1: head - 0.01, wall: w.id
        });
      } else {
        var sill = Math.min(o.sillH, H), top = Math.min(sill + o.winH, H);
        add('wall', lo - EPS, hi + EPS, 0, sill + EPS);            // muro bajo la ventana
        add('wall', lo - EPS, hi + EPS, top - EPS, H);             // muro sobre la ventana
        if (top - sill < 0.15) return;
        var fw = 0.05, fd = Math.min(w.t, 0.09);
        add('frame', lo, lo + fw, sill, top, fd);                  // marco
        add('frame', hi - fw, hi, sill, top, fd);
        add('frame', lo + fw, hi - fw, sill, sill + fw, fd);
        add('frame', lo + fw, hi - fw, top - fw, top, fd);
        if (hi - lo > 1.0) add('frame', (lo + hi) / 2 - 0.02, (lo + hi) / 2 + 0.02, sill + fw, top - fw, fd);
        add('glass', lo + fw, hi - fw, sill + fw, top - fw, 0.012);
        add('trim', lo - 0.03, hi + 0.03, sill - 0.03, sill, w.t + 0.06);   // repisa
      }
    });
    return parts;
  }

  function wallCorners(w) {
    var info = G.wallInfo(w), h = w.t / 2;
    var a = G.add(info.a, G.mul(info.u, -h)), b = G.add(info.b, G.mul(info.u, h));
    return [G.add(a, G.mul(info.n, h)), G.add(b, G.mul(info.n, h)), G.add(b, G.mul(info.n, -h)), G.add(a, G.mul(info.n, -h))];
  }

  /** Piezas de todo el plano. objects = los objetos que se deben mostrar (ya filtrados por capa). */
  function build(objects, options) {
    var o = withDefaults(options);
    var walls = objects.filter(function (x) { return x.type === 'wall'; });
    var byWall = {};
    objects.forEach(function (x) {
      if (x.type === 'door' || x.type === 'window') (byWall[x.wall] = byWall[x.wall] || []).push(x);
    });
    var parts = [], doors = 0, windows = 0;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;

    walls.forEach(function (w) {
      var ops = byWall[w.id] || [];
      ops.forEach(function (op) { if (op.type === 'door') doors++; else windows++; });
      wallParts(w, ops, o).forEach(function (p) { parts.push(p); });
      wallCorners(w).forEach(function (p) {
        minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
      });
    });

    return {
      parts: parts,
      walls: walls,
      bounds: walls.length ? { minx: minx, miny: miny, maxx: maxx, maxy: maxy } : null,
      stats: { walls: walls.length, doors: doors, windows: windows },
      options: o
    };
  }

  /** Detecta qué espacio está cerrado por paredes.
   *  Pinta las paredes (completas, sin descontar puertas ni ventanas) en una cuadrícula fina,
   *  rellena desde afuera y lo que no se alcanza es interior.
   *  Devuelve la máscara del piso (paredes + interior) y los cuartos con su área. */
  function floorMask(walls, opts) {
    opts = opts || {};
    if (!walls || !walls.length) return { ok: false };

    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    walls.forEach(function (w) {
      wallCorners(w).forEach(function (p) {
        minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
      });
    });
    var pad = 0.4;
    var cell = Math.max(opts.minCell || 0.02, (Math.max(maxx - minx, maxy - miny) + 2 * pad) / 1400);
    var nx, ny;
    for (;;) {
      nx = Math.ceil((maxx - minx + 2 * pad) / cell);
      ny = Math.ceil((maxy - miny + 2 * pad) / cell);
      if (nx * ny <= 2500000) break;
      cell *= 1.25;
    }
    var ox = minx - pad, oy = miny - pad;
    var st = new Uint8Array(nx * ny);          // 0 vacío, 1 pared, 2 afuera, 3 interior ya contado

    walls.forEach(function (w) {
      var info = G.wallInfo(w);
      if (info.L < 1e-9) return;
      var half = w.t / 2 + cell * 0.5;
      var smin = -w.t / 2 - cell * 0.5, smax = info.L + w.t / 2 + cell * 0.5;
      var cs = [[smin, -half], [smax, -half], [smax, half], [smin, half]].map(function (sd) {
        return [info.a[0] + info.u[0] * sd[0] + info.n[0] * sd[1], info.a[1] + info.u[1] * sd[0] + info.n[1] * sd[1]];
      });
      var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      cs.forEach(function (p) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); });
      var i0 = Math.max(0, Math.floor((bx0 - ox) / cell)), i1 = Math.min(nx - 1, Math.ceil((bx1 - ox) / cell));
      var j0 = Math.max(0, Math.floor((by0 - oy) / cell)), j1 = Math.min(ny - 1, Math.ceil((by1 - oy) / cell));
      for (var j = j0; j <= j1; j++) {
        var py = oy + (j + 0.5) * cell - info.a[1];
        for (var i = i0; i <= i1; i++) {
          var px = ox + (i + 0.5) * cell - info.a[0];
          var s = px * info.u[0] + py * info.u[1];
          var d = px * info.n[0] + py * info.n[1];
          if (s >= smin && s <= smax && d >= -half && d <= half) st[j * nx + i] = 1;
        }
      }
    });

    var queue = new Int32Array(nx * ny);
    function flood(seedList, from, to, collect) {
      var head = 0, tail = 0, n = 0, sx = 0, sy = 0;
      seedList.forEach(function (k) { if (st[k] === from) { st[k] = to; queue[tail++] = k; } });
      while (head < tail) {
        var k = queue[head++];
        var i = k % nx, j = (k - i) / nx;
        n++;
        if (collect) { sx += i; sy += j; collect.cells.push(k); }
        if (i > 0 && st[k - 1] === from) { st[k - 1] = to; queue[tail++] = k - 1; }
        if (i < nx - 1 && st[k + 1] === from) { st[k + 1] = to; queue[tail++] = k + 1; }
        if (j > 0 && st[k - nx] === from) { st[k - nx] = to; queue[tail++] = k - nx; }
        if (j < ny - 1 && st[k + nx] === from) { st[k + nx] = to; queue[tail++] = k + nx; }
      }
      return { n: n, sx: sx, sy: sy };
    }

    var border = [], i, j;
    for (i = 0; i < nx; i++) { border.push(i); border.push((ny - 1) * nx + i); }
    for (j = 0; j < ny; j++) { border.push(j * nx); border.push(j * nx + nx - 1); }
    flood(border, 0, 2, null);

    var rooms = [], enclosed = 0, c2 = cell * cell;
    var label = new Uint16Array(nx * ny);       // cuarto al que pertenece cada celda (índice + 1), 0 = ninguno
    for (var k0 = 0; k0 < nx * ny; k0++) {
      if (st[k0] !== 0) continue;
      var col = { cells: [] };
      var r = flood([k0], 0, 3, col);
      enclosed += r.n;
      // las paredes se pintan engordadas media celda; se devuelve esa franja para que el área salga casi exacta
      var edges = 0;
      for (var q0 = 0; q0 < col.cells.length; q0++) {
        var k1 = col.cells[q0], i1 = k1 % nx, j1 = (k1 - i1) / nx;
        if (i1 > 0 && st[k1 - 1] === 1) edges++;
        if (i1 < nx - 1 && st[k1 + 1] === 1) edges++;
        if (j1 > 0 && st[k1 - nx] === 1) edges++;
        if (j1 < ny - 1 && st[k1 + nx] === 1) edges++;
      }
      var area = (r.n + edges / 2) * c2;
      if (area < 0.5) continue;
      var cxI = r.sx / r.n, cyI = r.sy / r.n, best = -1, bestD = Infinity;
      for (var q = 0; q < col.cells.length; q++) {
        var kk = col.cells[q], ii = kk % nx, jj = (kk - ii) / nx;
        var dd = (ii - cxI) * (ii - cxI) + (jj - cyI) * (jj - cyI);
        if (dd < bestD) { bestD = dd; best = kk; }
      }
      var bi = best % nx, bj = (best - bi) / nx;
      var rid = rooms.length;
      for (var q2 = 0; q2 < col.cells.length; q2++) label[col.cells[q2]] = rid + 1;
      rooms.push({ id: rid, area: area, cx: ox + (cxI + 0.5) * cell, cy: oy + (cyI + 0.5) * cell, x: ox + (bi + 0.5) * cell, y: oy + (bj + 0.5) * cell });
    }
    rooms.sort(function (p, q) { return q.area - p.area; });

    // piso = interior + paredes, menos la capa de paredes que toca el exterior (así no asoma fuera del muro)
    var floor = new Uint8Array(nx * ny), fi, fj, fk;
    for (fj = 0; fj < ny; fj++) {
      for (fi = 0; fi < nx; fi++) {
        fk = fj * nx + fi;
        if (st[fk] === 3) floor[fk] = 1;
        else if (st[fk] === 1) {
          var edge = fi === 0 || fj === 0 || fi === nx - 1 || fj === ny - 1 ||
            st[fk - 1] === 2 || st[fk + 1] === 2 || st[fk - nx] === 2 || st[fk + nx] === 2;
          floor[fk] = edge ? 0 : 1;
        }
      }
    }

    var cx0 = (minx + maxx) / 2, cy0 = (miny + maxy) / 2;
    return {
      ok: true, ox: ox, oy: oy, nx: nx, ny: ny, cell: cell, floor: floor, label: label,
      rooms: rooms, enclosedArea: enclosed * c2,
      start: rooms.length ? [rooms[0].x, rooms[0].y] : [cx0, cy0]
    };
  }

  /** Cuarto cerrado que contiene el punto (x, y), o null. Necesita el resultado de floorMask. */
  function roomAt(mask, x, y) {
    if (!mask || !mask.ok) return null;
    var i = Math.floor((x - mask.ox) / mask.cell), j = Math.floor((y - mask.oy) / mask.cell);
    if (i < 0 || j < 0 || i >= mask.nx || j >= mask.ny) return null;
    var l = mask.label[j * mask.nx + i];
    if (!l) return null;
    for (var k = 0; k < mask.rooms.length; k++) if (mask.rooms[k].id === l - 1) return mask.rooms[k];
    return null;
  }

  /** Copia del piso con un hueco donde está el rectángulo del mueble f (para el hueco de una escalera). */
  function carve(mask, arr, f, pad) {
    var cs = F.corners(f), minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    cs.forEach(function (p) { minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]); maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]); });
    var i0 = Math.max(0, Math.floor((minx - mask.ox) / mask.cell)), i1 = Math.min(mask.nx - 1, Math.ceil((maxx - mask.ox) / mask.cell));
    var j0 = Math.max(0, Math.floor((miny - mask.oy) / mask.cell)), j1 = Math.min(mask.ny - 1, Math.ceil((maxy - mask.oy) / mask.cell));
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        if (F.contains(f, mask.ox + (i + 0.5) * mask.cell, mask.oy + (j + 0.5) * mask.cell, pad || 0)) arr[j * mask.nx + i] = 0;
      }
    }
    return arr;
  }

  /** Piezas 3D de un mueble. rise = altura que salva una escalera. */
  function furnParts(f, rise) {
    var a = (f.ang || 0) * Math.PI / 180;
    return F.boxes(f.kind, f.w, f.d, rise).map(function (b) {
      return { kind: 'furn', color: b.color, c: F.toWorld(f, b.x, b.y), ang: a, len: b.w, thick: b.d, h0: b.h0, h1: b.h1, furn: f.id };
    });
  }

  var api = { DEFAULTS: DEFAULTS, roomAt: roomAt, carve: carve, furnParts: furnParts, withDefaults: withDefaults, build: build, wallParts: wallParts, floorMask: floorMask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaModel3D = api;
})(this);
