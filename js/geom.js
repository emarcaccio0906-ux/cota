/* Cota — geometría pura (sin canvas ni DOM). Unidades: metros, Y hacia arriba.
 * Objetos del dibujo:
 *   line     {a, b}
 *   polyline {pts, closed}
 *   rect     {a, b}                 esquinas opuestas
 *   circle   {c, r}
 *   wall     {a, b, t}              eje de la pared y espesor
 *   door     {wall, pos, w, flip}   abertura sobre una pared; pos = metros desde wall.a hasta el centro
 *   window   {wall, pos, w, flip}
 *   dim      {a, b, off}            cota alineada; off = separación de la línea de cota
 */
(function (root) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports) ? require('./furniture.js') : root.CotaFurn;

  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function len(a) { return Math.hypot(a[0], a[1]); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function norm(a) { var l = len(a); return l < 1e-12 ? [1, 0] : [a[0] / l, a[1] / l]; }
  function perp(a) { return [-a[1], a[0]]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** Distancia de un punto a un segmento. Devuelve {d, t, q}: t en 0..1, q punto más cercano. */
  function segDist(p, a, b) {
    var ab = sub(b, a);
    var l2 = dot(ab, ab);
    var t = l2 < 1e-18 ? 0 : clamp(dot(sub(p, a), ab) / l2, 0, 1);
    var q = add(a, mul(ab, t));
    return { d: dist(p, q), t: t, q: q };
  }

  function rectCorners(o) {
    var a = o.a, b = o.b;
    return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
  }

  /** Datos de una pared: extremos, largo, dirección y normal. */
  function wallInfo(w) {
    var d = sub(w.b, w.a);
    var L = len(d);
    var u = norm(d);
    return { a: w.a, b: w.b, L: L, u: u, n: perp(u), t: w.t };
  }

  /** Rango [desde, hasta] (metros sobre la pared) que ocupa una abertura. */
  function openingRange(op) {
    return [op.pos - op.w / 2, op.pos + op.w / 2];
  }

  /** Tramos macizos de una pared después de recortar sus aberturas. */
  function solidRanges(wall, openings) {
    var info = wallInfo(wall);
    var cuts = openings.map(openingRange).sort(function (p, q) { return p[0] - q[0]; });
    var out = [];
    var cursor = 0;
    cuts.forEach(function (c) {
      var s = clamp(c[0], 0, info.L), e = clamp(c[1], 0, info.L);
      if (s > cursor) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
    });
    if (cursor < info.L) out.push([cursor, info.L]);
    return out;
  }

  /** Geometría de una abertura sobre su pared (para dibujarla y para probarla). */
  function openingGeom(op, wall) {
    var info = wallInfo(wall);
    var c = add(info.a, mul(info.u, op.pos));
    var half = op.w / 2;
    var p0 = add(c, mul(info.u, -half));
    var p1 = add(c, mul(info.u, half));
    var side = op.flip ? -1 : 1;
    return { c: c, p0: p0, p1: p1, u: info.u, n: mul(info.n, side), t: info.t, w: op.w };
  }

  /** Coloca una abertura en la pared más cercana al punto p. Devuelve null si ninguna está cerca. */
  function placeOnWall(p, walls, width, maxDist) {
    var best = null;
    walls.forEach(function (w) {
      var s = segDist(p, w.a, w.b);
      var limit = maxDist + w.t / 2;
      if (s.d <= limit && (!best || s.d < best.d)) best = { wall: w, d: s.d, q: s.q };
    });
    if (!best) return null;
    var info = wallInfo(best.wall);
    if (info.L < width) return null;
    var pos = clamp(dot(sub(best.q, info.a), info.u), width / 2, info.L - width / 2);
    // lado hacia donde abre: el lado donde está el cursor
    var side = dot(sub(p, best.q), info.n) < 0 ? true : false;
    return { wall: best.wall, pos: pos, flip: side };
  }

  function polyLength(pts, closed) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]);
    return s;
  }

  function polyArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(s) / 2;
  }

  /** Posiciones de las dos líneas de extensión y de la línea de cota. */
  function dimGeom(d) {
    var dir = norm(sub(d.b, d.a));
    var n = perp(dir);
    var o = mul(n, d.off);
    return { a2: add(d.a, o), b2: add(d.b, o), dir: dir, n: n, length: dist(d.a, d.b) };
  }

  function bboxOf(o, byId) {
    var pts;
    switch (o.type) {
      case 'line': case 'dim': pts = [o.a, o.b]; break;
      case 'polyline': pts = o.pts; break;
      case 'rect': pts = rectCorners(o); break;
      case 'circle': pts = [[o.c[0] - o.r, o.c[1] - o.r], [o.c[0] + o.r, o.c[1] + o.r]]; break;
      case 'wall': pts = [o.a, o.b]; break;
      case 'furn': pts = F.corners(o); break;
      case 'room': pts = [[o.p[0] - 0.2, o.p[1] - 0.2], [o.p[0] + 0.2, o.p[1] + 0.2]]; break;
      case 'door': case 'window':
        var w = byId && byId[o.wall];
        if (!w) return null;
        var g = openingGeom(o, w);
        pts = [g.p0, g.p1];
        break;
      default: return null;
    }
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    pts.forEach(function (p) {
      minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]);
      maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
    });
    var pad = o.type === 'wall' ? o.t / 2 : 0;
    return { minx: minx - pad, miny: miny - pad, maxx: maxx + pad, maxy: maxy + pad };
  }

  /** Distancia del punto p al objeto (0 si está encima). Sirve para elegir con el dedo o el mouse. */
  function distToObject(p, o, byId) {
    var i, best;
    switch (o.type) {
      case 'line': return segDist(p, o.a, o.b).d;
      case 'polyline':
        best = Infinity;
        for (i = 1; i < o.pts.length; i++) best = Math.min(best, segDist(p, o.pts[i - 1], o.pts[i]).d);
        if (o.closed && o.pts.length > 2) best = Math.min(best, segDist(p, o.pts[o.pts.length - 1], o.pts[0]).d);
        return best;
      case 'rect':
        var c = rectCorners(o);
        best = Infinity;
        for (i = 0; i < 4; i++) best = Math.min(best, segDist(p, c[i], c[(i + 1) % 4]).d);
        return best;
      case 'circle': return Math.abs(dist(p, o.c) - o.r);
      case 'furn': return F.distTo(o, p[0], p[1]);
      case 'room': return Math.max(0, dist(p, o.p) - 0.25);
      case 'wall': return Math.max(0, segDist(p, o.a, o.b).d - o.t / 2);
      case 'door': case 'window':
        var w = byId && byId[o.wall];
        if (!w) return Infinity;
        var g = openingGeom(o, w);
        var s = segDist(p, g.p0, g.p1);
        return Math.max(0, s.d - w.t / 2);
      case 'dim':
        var dg = dimGeom(o);
        return segDist(p, dg.a2, dg.b2).d;
      default: return Infinity;
    }
  }

  /** Puntos de enganche del objeto: extremos (kind 'end') y puntos medios (kind 'mid'). */
  function snapPointsOf(o) {
    var out = [], i;
    function end(p) { out.push({ p: p, kind: 'end' }); }
    function midp(p) { out.push({ p: p, kind: 'mid' }); }
    switch (o.type) {
      case 'line': case 'wall':
        end(o.a); end(o.b); midp(mid(o.a, o.b)); break;
      case 'polyline':
        o.pts.forEach(end);
        for (i = 1; i < o.pts.length; i++) midp(mid(o.pts[i - 1], o.pts[i]));
        if (o.closed && o.pts.length > 2) midp(mid(o.pts[o.pts.length - 1], o.pts[0]));
        break;
      case 'rect':
        var c = rectCorners(o);
        c.forEach(end);
        for (i = 0; i < 4; i++) midp(mid(c[i], c[(i + 1) % 4]));
        break;
      case 'circle':
        end(o.c);
        end([o.c[0] + o.r, o.c[1]]); end([o.c[0] - o.r, o.c[1]]);
        end([o.c[0], o.c[1] + o.r]); end([o.c[0], o.c[1] - o.r]);
        break;
      case 'dim': end(o.a); end(o.b); break;
      default: break;
    }
    return out;
  }

  /** Busca el mejor enganche cerca de p. Prioridad: extremo > punto medio > cuadrícula.
   *  tol y grid vienen en metros. Devuelve {p, kind}. */
  function findSnap(p, objects, opts) {
    var tol = opts.tol, grid = opts.grid;
    var bestEnd = null, bestMid = null;
    objects.forEach(function (o) {
      if (opts.skip && opts.skip(o)) return;
      snapPointsOf(o).forEach(function (s) {
        var d = dist(p, s.p);
        if (d > tol) return;
        if (s.kind === 'end') { if (!bestEnd || d < bestEnd.d) bestEnd = { p: s.p, d: d, kind: 'end' }; }
        else if (!bestMid || d < bestMid.d) bestMid = { p: s.p, d: d, kind: 'mid' };
      });
    });
    // un extremo gana si no está mucho más lejos que el punto medio
    if (bestEnd && (!bestMid || bestEnd.d <= bestMid.d * 1.5)) return { p: bestEnd.p.slice(), kind: 'end' };
    if (bestMid) return { p: bestMid.p.slice(), kind: 'mid' };
    if (opts.useGrid && grid > 0) {
      return { p: [Math.round(p[0] / grid) * grid, Math.round(p[1] / grid) * grid], kind: 'grid' };
    }
    return { p: p.slice(), kind: 'free' };
  }

  /** Ortogonal: deja el punto en horizontal o vertical respecto a `from`. */
  function orthoPoint(from, p) {
    var dx = p[0] - from[0], dy = p[1] - from[1];
    return Math.abs(dx) >= Math.abs(dy) ? [p[0], from[1]] : [from[0], p[1]];
  }

  function translateObj(o, dx, dy) {
    function mv(p) { p[0] += dx; p[1] += dy; }
    switch (o.type) {
      case 'line': case 'rect': case 'wall': case 'dim': mv(o.a); mv(o.b); break;
      case 'polyline': o.pts.forEach(mv); break;
      case 'circle': mv(o.c); break;
      case 'furn': case 'room': mv(o.p); break;
      default: break; // las aberturas se mueven con su pared
    }
  }

  function rotatePoint(p, c, ang) {
    var cos = Math.cos(ang), sin = Math.sin(ang);
    var x = p[0] - c[0], y = p[1] - c[1];
    return [c[0] + x * cos - y * sin, c[1] + x * sin + y * cos];
  }

  /** Gira un objeto alrededor de c. Un rectángulo girado pasa a ser polilínea cerrada. */
  function rotateObj(o, c, ang) {
    function rt(p) { var q = rotatePoint(p, c, ang); p[0] = q[0]; p[1] = q[1]; }
    switch (o.type) {
      case 'line': case 'wall': case 'dim': rt(o.a); rt(o.b); break;
      case 'polyline': o.pts.forEach(rt); break;
      case 'circle': rt(o.c); break;
      case 'furn': rt(o.p); o.ang = (((o.ang || 0) + ang * 180 / Math.PI) % 360 + 360) % 360; break;
      case 'room': rt(o.p); break;
      case 'rect':
        o.type = 'polyline';
        o.pts = rectCorners(o).map(function (p) { return rotatePoint(p, c, ang); });
        o.closed = true;
        delete o.a; delete o.b;
        break;
      default: break;
    }
  }

  var api = {
    add: add, sub: sub, mul: mul, dot: dot, len: len, dist: dist, norm: norm, perp: perp,
    lerp: lerp, mid: mid, clamp: clamp,
    segDist: segDist, rectCorners: rectCorners,
    wallInfo: wallInfo, openingRange: openingRange, solidRanges: solidRanges,
    openingGeom: openingGeom, placeOnWall: placeOnWall,
    polyLength: polyLength, polyArea: polyArea, dimGeom: dimGeom,
    bboxOf: bboxOf, distToObject: distToObject,
    snapPointsOf: snapPointsOf, findSnap: findSnap, orthoPoint: orthoPoint,
    translateObj: translateObj, rotatePoint: rotatePoint, rotateObj: rotateObj
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaGeom = api;
})(this);
