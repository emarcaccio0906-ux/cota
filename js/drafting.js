/* Cota — mesa de dibujo: escalas de escalímetro, láminas de papel, cuadrícula isométrica
 * y escuadras (regla T, 30-60, 45 y escalímetro) que se pueden mover sobre la lámina.
 * Funciones puras, sin DOM. Unidades internas: metros, Y hacia arriba.
 * "Pulgada de papel" = lo que mide en la hoja impresa; k = papel / real (1/4" = 1'-0" es k = 1/48). */
(function (root) {
  'use strict';

  var IN = 0.0254;
  var D2R = Math.PI / 180;

  /* ------------------------------------------------------------------ */
  /* Escalas                                                             */
  /* ------------------------------------------------------------------ */
  // Las caras del escalímetro de arquitecto (pulgadas de papel por pie real) y la escala completa.
  var ARCH = [
    ['3/32"', 3 / 32], ['1/8"', 1 / 8], ['3/16"', 3 / 16], ['1/4"', 1 / 4], ['3/8"', 3 / 8], ['1/2"', 1 / 2],
    ['3/4"', 3 / 4], ['1"', 1], ['1 1/2"', 1.5], ['3"', 3]
  ];
  var SCALES_FT = ARCH.map(function (a) {
    return { id: 'a' + a[1], label: a[0] + " = 1'-0\"", short: a[0], k: a[1] / 12, use: useOf(a[1]) };
  }).concat([{ id: 'full', label: 'Tamaño real (1:1)', short: '1:1', k: 1, use: 'Detalles a tamaño real' }]);
  var SCALES_M = [1, 5, 10, 20, 25, 50, 75, 100, 200, 500].map(function (n) {
    return { id: 'm' + n, label: '1:' + n, short: '1:' + n, k: 1 / n, use: '' };
  });

  function useOf(inPerFt) {
    if (inPerFt <= 1 / 8) return 'Plantas de sitio y edificios grandes';
    if (inPerFt <= 1 / 4) return 'Plantas y elevaciones de casas';
    if (inPerFt <= 1 / 2) return 'Plantas ampliadas: cocinas y baños';
    if (inPerFt <= 1) return 'Secciones de pared y escaleras';
    return 'Detalles constructivos';
  }

  function scaleById(id) {
    var all = SCALES_FT.concat(SCALES_M);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Láminas                                                             */
  /* ------------------------------------------------------------------ */
  // medidas en pulgadas, horizontal (ancho > alto)
  var SHEETS = {
    '18x24': { w: 24, h: 18, name: '18 × 24 (Arch C)' },
    '11x17': { w: 17, h: 11, name: '11 × 17 (Tabloide)' },
    '24x36': { w: 36, h: 24, name: '24 × 36 (Arch D)' },
    'letter': { w: 11, h: 8.5, name: '8.5 × 11 (Carta)' }
  };
  var MARGIN = 0.5;            // borde de la lámina, en pulgadas de papel
  var TITLE_W = 2.25;          // franja del cajetín (a la derecha en horizontal, abajo en vertical)

  /** Metros reales por pulgada de papel. */
  function unitOf(k) { return IN / k; }

  function sheetSize(paper) {
    var s = SHEETS[paper.sheet] || SHEETS['18x24'];
    return paper.orient === 'port' ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
  }

  /** Rectángulo de la hoja en el mundo, centrado en paper.origin. */
  function sheetRect(paper, k) {
    var sz = sheetSize(paper), u = unitOf(k);
    var w = sz.w * u, h = sz.h * u, c = paper.origin || [0, 0];
    return { x0: c[0] - w / 2, y0: c[1] - h / 2, x1: c[0] + w / 2, y1: c[1] + h / 2, u: u, w: sz.w, h: sz.h };
  }

  /** Marco de dibujo y cajetín, en el mundo. */
  function sheetLayout(paper, k) {
    var r = sheetRect(paper, k), u = r.u, m = MARGIN * u, t = TITLE_W * u;
    var frame = { x0: r.x0 + m, y0: r.y0 + m, x1: r.x1 - m, y1: r.y1 - m };
    var title;
    if (paper.orient === 'port') title = { x0: frame.x0, y0: frame.y0, x1: frame.x1, y1: frame.y0 + t * 0.8 };
    else title = { x0: frame.x1 - t, y0: frame.y0, x1: frame.x1, y1: frame.y1 };
    return { sheet: r, frame: frame, title: title, u: u };
  }

  /* ------------------------------------------------------------------ */
  /* Isométrico                                                          */
  /* ------------------------------------------------------------------ */
  var ISO_DIRS = [30, 90, 150];
  var C30 = Math.cos(30 * D2R);

  /** Punto más cercano de la red isométrica (triángulos de lado s; líneas a 30°, 90° y 150°). */
  function isoSnap(p, s) {
    var bx = s * C30;                  // separación entre verticales
    var i0 = Math.round(p[0] / bx), best = null, bd = Infinity;
    for (var i = i0 - 1; i <= i0 + 1; i++) {
      var x = i * bx, off = i * s / 2;
      var j = Math.round((p[1] - off) / s);
      for (var jj = j - 1; jj <= j + 1; jj++) {
        var y = off + jj * s, d = Math.hypot(p[0] - x, p[1] - y);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    return best;
  }

  /** Lleva p a la dirección más cercana de `dirs` (grados, como rectas: 30 también vale 210) desde `from`.
   *  tolDeg = null obliga siempre; si no, solo cuando está a menos de tolDeg. Devuelve {p, ang} o null. */
  function constrainDir(from, p, dirs, tolDeg) {
    var vx = p[0] - from[0], vy = p[1] - from[1], L = Math.hypot(vx, vy);
    if (L < 1e-12) return null;
    var ang = Math.atan2(vy, vx), best = null, bd = Infinity;
    dirs.forEach(function (dg) {
      [dg, dg + 180].forEach(function (a) {
        var r = a * D2R, diff = Math.abs(Math.atan2(Math.sin(ang - r), Math.cos(ang - r)));
        if (diff < bd) { bd = diff; best = r; }
      });
    });
    if (tolDeg != null && bd > tolDeg * D2R) return null;
    var c = Math.cos(best), s = Math.sin(best), d = vx * c + vy * s;
    return { p: [from[0] + c * d, from[1] + s * d], ang: ((best / D2R) % 360 + 360) % 360, len: d };
  }

  /* ------------------------------------------------------------------ */
  /* Escuadras                                                           */
  /* ------------------------------------------------------------------ */
  // forma local en pulgadas de papel. El canto de trabajo (`edges`) es por donde se traza.
  var T3060 = { a: 10 * Math.tan(30 * D2R), b: 10 };   // base 5.77", alto 10": da 90° y 60°
  var T45 = { a: 8, b: 8 };
  var RULER = { len: 12, w: 1.1 };
  var TSQ = { h: 1.4, extra: 1.5 };
  var KINDS = [
    { id: 'tsq', name: 'Regla T' },
    { id: 't3060', name: 'Escuadra 30°-60°' },
    { id: 't45', name: 'Escuadra 45°' },
    { id: 'ruler', name: 'Escalímetro' }
  ];

  function localShape(kind) {
    if (kind === 't3060') return { outer: [[0, 0], [T3060.a, 0], [0, T3060.b]], tri: T3060 };
    if (kind === 't45') return { outer: [[0, 0], [T45.a, 0], [0, T45.b]], tri: T45 };
    if (kind === 'ruler') return { outer: [[0, 0], [RULER.len, 0], [RULER.len, RULER.w], [0, RULER.w]] };
    return null;
  }

  function toWorld(inst, u, q) {
    var x = (inst.flip ? -q[0] : q[0]) * u, y = q[1] * u, r = (inst.ang || 0) * D2R;
    var c = Math.cos(r), s = Math.sin(r);
    return [inst.p[0] + x * c - y * s, inst.p[1] + x * s + y * c];
  }
  function toLocal(inst, u, w) {
    var r = -(inst.ang || 0) * D2R, c = Math.cos(r), s = Math.sin(r);
    var x = w[0] - inst.p[0], y = w[1] - inst.p[1];
    var lx = (x * c - y * s) / u, ly = (x * s + y * c) / u;
    return [inst.flip ? -lx : lx, ly];
  }

  /** Polígonos en el mundo: outer, hole (el hueco del triángulo) y cantos de trabajo [{a,b}]. */
  function instGeom(inst, u, rect) {
    if (inst.kind === 'tsq') {
      var x0 = rect.x0 - TSQ.extra * u, x1 = rect.x1;
      var y = inst.y, h = TSQ.h * u;
      return {
        outer: [[x0, y - h], [x1, y - h], [x1, y], [x0, y]],
        hole: null,
        edges: [{ a: [x0, y], b: [x1, y] }],
        handle: null
      };
    }
    var sh = localShape(inst.kind);
    var tw = function (q) { return toWorld(inst, u, q); };
    var g = { outer: sh.outer.map(tw), hole: null, edges: [], handle: null };
    if (sh.tri) {
      var A = sh.tri.a, B = sh.tri.b, ins = 1.1;
      // hueco interior: el mismo triángulo, corrido hacia adentro
      var r = (A * B) / (A + B + Math.hypot(A, B));      // radio inscrito
      var f = (r - ins) / r;
      if (f > 0.15) {
        var cx = r, cy = r;
        g.hole = [[0, 0], [A, 0], [0, B]].map(function (q) { return tw([cx + (q[0] - cx) * f, cy + (q[1] - cy) * f]); });
      }
      g.edges = [{ a: g.outer[0], b: g.outer[1] }, { a: g.outer[1], b: g.outer[2] }, { a: g.outer[2], b: g.outer[0] }];
      g.handle = tw([A * 0.22, B * 0.62]);
    } else {
      g.edges = [{ a: g.outer[0], b: g.outer[1] }];        // escalímetro: se mide por el canto de abajo
      g.handle = tw([RULER.len - 0.55, RULER.w * 0.55]);
    }
    return g;
  }

  function pointInPoly(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function closestOnSeg(p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    var t = L2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return { p: [a[0] + vx * t, a[1] + vy * t], t: t };
  }

  /** Lleva p al canto más cercano si está a menos de tol. Devuelve {p, edge, d} o null. */
  function snapToEdges(p, edges, tol) {
    var best = null;
    edges.forEach(function (e) {
      var c = closestOnSeg(p, e.a, e.b), d = Math.hypot(p[0] - c.p[0], p[1] - c.p[1]);
      if (d <= tol && (!best || d < best.d)) best = { p: c.p, edge: e, d: d };
    });
    return best;
  }

  /** Ángulos (grados, como rectas) de los cantos. */
  function edgeDirs(edges) {
    var out = [];
    edges.forEach(function (e) {
      var a = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]) / D2R;
      a = ((a % 180) + 180) % 180;
      if (!out.some(function (x) { return Math.abs(x - a) < 0.01 || Math.abs(Math.abs(x - a) - 180) < 0.01; })) out.push(a);
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Marcas del escalímetro                                              */
  /* ------------------------------------------------------------------ */
  /** Marcas a lo largo de una cara de RULER.len pulgadas de papel. x y h en pulgadas de papel.
   *  metric: escala métrica (k = 1/n) con marcas en metros reales. */
  function rulerTicks(k, metric) {
    var ticks = [], L = RULER.len;
    if (metric) {
      var pin = IN / k;                                   // metros reales por pulgada de papel
      var steps = [0.01, 0.05, 0.1, 0.5, 1, 5, 10];
      var minor = steps[steps.length - 1];
      for (var i = 0; i < steps.length; i++) if (steps[i] / pin >= 0.035) { minor = steps[i]; break; }
      var label = 1;
      [1, 2, 5, 10, 20, 50].some(function (lv) { if (lv >= minor && lv / pin >= 0.45) { label = lv; return true; } return false; });
      var n = Math.floor(L * pin / minor + 1e-9);
      for (var t = 0; t <= n; t++) {
        var real = t * minor, x = real / pin;
        if (x > L - 0.15) break;
        var isLab = Math.abs(real / label - Math.round(real / label)) < 1e-6;
        var half = !isLab && Math.abs(real / (label / 2) - Math.round(real / (label / 2))) < 1e-6;
        ticks.push({ x: x + 0.15, h: isLab ? 0.32 : half ? 0.22 : 0.13, label: isLab ? fmtNum(real) : null });
      }
      return { ticks: ticks, title: '1:' + Math.round(1 / k), zero: 0.15 };
    }
    var foot = 12 * k;                                    // pulgadas de papel que ocupa un pie real
    if (foot >= 6) {
      // tamaño real o casi: regla de pulgadas con 1/16
      var per = 12 * k, sub = 16;                         // per = pulgadas de papel por pulgada real
      var count = Math.floor((L - 0.3) / (per / sub) + 1e-9);
      for (var q = 0; q <= count; q++) {
        var xi = 0.15 + q * per / sub;
        var h = q % 16 === 0 ? 0.36 : q % 8 === 0 ? 0.26 : q % 4 === 0 ? 0.2 : q % 2 === 0 ? 0.15 : 0.1;
        ticks.push({ x: xi, h: h, label: q % 16 === 0 ? String(q / 16) : null });
      }
      return { ticks: ticks, title: k === 1 ? '1:1' : (12 * k) + '"', zero: 0.15 };
    }
    // escalímetro de arquitecto: un pie dividido en pulgadas antes del 0, luego los pies
    var divs = [12, 6, 4, 2].filter(function (d) { return foot / d >= 0.02; })[0] || 1;
    var zero = 0.15 + foot;
    for (var d = 0; d <= divs; d++) {
      var xd = zero - d * foot / divs;
      var big = d === divs || d === 0 || (divs >= 4 && d === divs / 2);
      var subLab = foot >= 0.7 && (d === divs || (divs === 12 && d === 6));
      if (d > 0) ticks.push({ x: xd, h: big ? 0.2 : (divs === 12 && d % 3 === 0) ? 0.16 : 0.1, label: subLab ? String(d * 12 / divs) : null, sub: true });
    }
    var every = [1, 2, 4, 5, 10, 20].filter(function (e) { return e * foot >= 0.32; })[0] || 20;
    var nf = Math.floor((L - zero - 0.1) / foot + 1e-9);
    for (var f = 0; f <= nf; f++) {
      var lab = f % every === 0;
      ticks.push({ x: zero + f * foot, h: lab ? 0.34 : (every > 1 && f % (every / 2) === 0 && every % 2 === 0) ? 0.24 : 0.17, label: lab ? String(f) : null });
    }
    return { ticks: ticks, title: fracLabel(k * 12), zero: zero };
  }

  function fmtNum(v) { return String(Math.round(v * 1000) / 1000); }
  function fracLabel(inPerFt) {
    for (var i = 0; i < ARCH.length; i++) if (Math.abs(ARCH[i][1] - inPerFt) < 1e-9) return ARCH[i][0];
    return fmtNum(inPerFt) + '"';
  }

  /** Posiciones iniciales de las escuadras, en pulgadas de papel medidas desde el centro de la hoja. */
  function defaultInstruments(size) {
    var w = size.w, h = size.h, y = -h / 2 + h * 0.22;
    return {
      tsq: { kind: 'tsq', on: false, y: y },
      t3060: { kind: 't3060', on: false, p: [-w / 2 + w * 0.32, y], ang: 0, flip: false },
      t45: { kind: 't45', on: false, p: [-w / 2 + w * 0.62, y], ang: 0, flip: true },
      ruler: { kind: 'ruler', on: false, p: [-w / 2 + 1.5, h / 2 - 3], ang: 0, flip: false }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Minas y tipos de línea                                              */
  /* ------------------------------------------------------------------ */
  // grosor en mm sobre el papel y qué tan oscura deja la línea (0-1)
  var LEADS = [
    { id: '4H', mm: 0.25, dark: 0.32, desc: 'Muy dura y clara. Líneas de construcción y guías de letra' },
    { id: '2H', mm: 0.3, dark: 0.48, desc: 'Dura. Cotas, ejes y líneas finas' },
    { id: 'H', mm: 0.4, dark: 0.62, desc: 'Media dura. Líneas ocultas y detalles' },
    { id: 'F', mm: 0.45, dark: 0.72, desc: 'Media. Letras y líneas de objeto suaves' },
    { id: 'HB', mm: 0.5, dark: 0.84, desc: 'Media blanda. Líneas visibles de objeto' },
    { id: 'B', mm: 0.6, dark: 0.92, desc: 'Blanda. Contornos y muros' },
    { id: '2B', mm: 0.8, dark: 0.98, desc: 'Muy blanda. Muros cortados, línea de tierra y cortes' }
  ];
  // el "alfabeto de líneas". dash en pulgadas de papel (raya, espacio, ...)
  var PENS = [
    { id: 'visible', name: 'Visible (objeto)', lead: 'HB', dash: null, desc: 'Lo que se ve: bordes y contornos del objeto' },
    { id: 'contorno', name: 'Contorno grueso', lead: '2B', dash: null, desc: 'Muros cortados en planta, línea de tierra' },
    { id: 'oculta', name: 'Oculta', lead: 'H', dash: [1 / 8, 1 / 16], desc: 'Bordes que quedan detrás o debajo' },
    { id: 'eje', name: 'Eje (centro)', lead: '2H', dash: [3 / 4, 1 / 16, 1 / 8, 1 / 16], desc: 'Centros de círculos, ejes de simetría' },
    { id: 'cota', name: 'Cota y extensión', lead: '2H', dash: null, desc: 'Líneas de medida y de extensión' },
    { id: 'construccion', name: 'Construcción', lead: '4H', dash: null, desc: 'Guías suaves para armar el dibujo; casi no se ven al imprimir' },
    { id: 'corte', name: 'Plano de corte', lead: '2B', dash: [3 / 4, 1 / 16, 1 / 8, 1 / 16, 1 / 8, 1 / 16], desc: 'Dónde se corta el edificio para una sección' },
    { id: 'proyeccion', name: 'Proyección (arriba)', lead: 'H', dash: [1 / 4, 1 / 16, 1 / 16, 1 / 16], desc: 'Lo que está por encima del corte: aleros, vigas' }
  ];
  function leadById(id) { for (var i = 0; i < LEADS.length; i++) if (LEADS[i].id === id) return LEADS[i]; return null; }
  function penById(id) { for (var i = 0; i < PENS.length; i++) if (PENS[i].id === id) return PENS[i]; return null; }

  /* ------------------------------------------------------------------ */
  /* Plantillas de clase                                                 */
  /* ------------------------------------------------------------------ */
  var CLASS_LIST = [
    { id: 'c-blank', name: 'Lámina en blanco', desc: '18 × 24 · 1/4" = 1\'-0" · cuadrícula de 1/4".', paper: { sheet: '18x24', orient: 'land', scale: 'a0.25', gridIn: 0.25 } },
    { id: 'c-lineas', name: 'Alfabeto de líneas', desc: '11 × 17 · tamaño real · practica cada tipo de línea y mina.', paper: { sheet: '11x17', orient: 'land', scale: 'full', gridIn: 0.25 } },
    { id: 'c-planta', name: 'Planta arquitectónica', desc: '18 × 24 · 1/4" = 1\'-0" · casa de 3 cuartos para calcar y acotar.', paper: { sheet: '18x24', orient: 'land', scale: 'a0.25', gridIn: 0.25 }, base: 'casa' },
    { id: 'c-elevacion', name: 'Elevación frontal', desc: '18 × 24 · 1/4" = 1\'-0" · alturas, techo 6/12, puerta y ventanas.', paper: { sheet: '18x24', orient: 'land', scale: 'a0.25', gridIn: 0.25 } },
    { id: 'c-orto', name: 'Vistas ortogonales', desc: '11 × 17 · 1" = 1\'-0" · planta, frente y lateral con línea a 45°.', paper: { sheet: '11x17', orient: 'land', scale: 'a1', gridIn: 0.25 } },
    { id: 'c-iso', name: 'Isométrico 30°', desc: '11 × 17 · 1" = 1\'-0" · cuadrícula isométrica y un bloque en L.', paper: { sheet: '11x17', orient: 'land', scale: 'a1', gridIn: 0.25, iso: true } }
  ];

  /** Zona libre para dibujar (marco sin el cajetín), en el mundo, con la hoja centrada en [0,0]. */
  function drawArea(paperCfg) {
    var sc = scaleById(paperCfg.scale), lay = sheetLayout({ sheet: paperCfg.sheet, orient: paperCfg.orient, origin: [0, 0] }, sc.k);
    var f = lay.frame, t = lay.title;
    var x1 = paperCfg.orient === 'port' ? f.x1 : t.x0, y0 = paperCfg.orient === 'port' ? t.y1 : f.y0;
    return { x0: f.x0, y0: y0, x1: x1, y1: f.y1, cx: (f.x0 + x1) / 2, cy: (y0 + f.y1) / 2, u: lay.u };
  }

  /** Objetos de una plantilla de clase (sin ids). baseObjects: objetos de una plantilla de planta (casa). */
  function buildClass(id, baseObjects) {
    var item = null;
    CLASS_LIST.forEach(function (c) { if (c.id === id) item = c; });
    if (!item) return null;
    var cfg = item.paper, area = drawArea(cfg), u = area.u, FT = 0.3048, objs = [];
    function L(a, b, pen, lead) { objs.push({ type: 'line', layer: 'dibujo', a: a, b: b, pen: pen || 'visible', lead: lead || penById(pen || 'visible').lead }); }
    function Tx(p, text, hIn, lead) { objs.push({ type: 'text', layer: 'dibujo', p: p, text: text, h: hIn * u, lead: lead || 'F' }); }
    function title(x, y, main, sub) {          // título de dibujo con su escala debajo
      Tx([x, y], main, 3 / 16, 'HB');
      L([x, y - 0.08 * u], [x + main.length * 3 / 16 * 0.68 * u, y - 0.08 * u], 'contorno');
      if (sub) Tx([x, y - 0.32 * u], sub, 1 / 8, 'F');
    }
    var scLabel = scaleById(cfg.scale).label.toUpperCase();

    if (id === 'c-lineas') {
      var x0 = area.x0 + 0.5 * u, y = area.y1 - 0.8 * u;
      title(x0, y, 'ALFABETO DE LÍNEAS', 'PRACTICA CADA LÍNEA CON SU MINA · ' + scLabel);
      y -= 1.15 * u;
      PENS.forEach(function (pn) {
        Tx([x0, y - 0.06 * u], pn.name.toUpperCase() + ' (' + pn.lead + ')', 1 / 8, 'F');
        L([x0 + 4.2 * u, y], [area.x1 - 0.6 * u, y], pn.id);
        y -= 0.95 * u;
      });
    } else if (id === 'c-planta' && baseObjects) {
      var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
      baseObjects.forEach(function (o) {
        [o.a, o.b, o.p].forEach(function (q) { if (q) { mnx = Math.min(mnx, q[0]); mny = Math.min(mny, q[1]); mxx = Math.max(mxx, q[0]); mxy = Math.max(mxy, q[1]); } });
      });
      var dx = area.cx - (mnx + mxx) / 2, dy = area.cy + 0.4 * u - (mny + mxy) / 2;
      baseObjects.forEach(function (o) {
        var c = JSON.parse(JSON.stringify(o));
        ['a', 'b', 'p'].forEach(function (k) { if (c[k]) c[k] = [c[k][0] + dx, c[k][1] + dy]; });
        if (c.type === 'wall') c.lead = 'B';
        objs.push(c);
      });
      title(mnx + dx, mny + dy - 1.3 * u, 'PLANTA ARQUITECTÓNICA', 'ESCALA: ' + scLabel);
    } else if (id === 'c-elevacion') {
      var W = 36 * FT, gx = area.cx - W / 2, gy = area.cy - 2.2 * u;
      var plate = 9 * FT, ridge = plate + 9 * FT, ov = 1.5 * FT;
      L([area.x0 + 0.6 * u, gy], [area.x1 - 0.6 * u, gy], 'contorno');                               // línea de tierra
      [plate, ridge].forEach(function (h) { L([area.x0 + 0.6 * u, gy + h], [area.x1 - 0.6 * u, gy + h], 'construccion'); });
      L([gx, gy], [gx, gy + plate]); L([gx + W, gy], [gx + W, gy + plate]);                       // muros
      L([gx - ov, gy + plate - ov / 2], [gx + W / 2, gy + ridge]); L([gx + W / 2, gy + ridge], [gx + W + ov, gy + plate - ov / 2]);   // techo 6/12
      L([gx - ov, gy + plate - ov / 2], [gx + W + ov, gy + plate - ov / 2]);
      function box(x, y0, w, h) { L([x, y0], [x + w, y0]); L([x + w, y0], [x + w, y0 + h]); L([x + w, y0 + h], [x, y0 + h]); L([x, y0 + h], [x, y0]); }
      box(gx + 15 * FT, gy, 3 * FT, 6.667 * FT);                                                     // puerta 3'-0" x 6'-8"
      box(gx + 4 * FT, gy + 3 * FT, 4 * FT, 4 * FT); box(gx + 26 * FT, gy + 3 * FT, 5 * FT, 4 * FT);  // ventanas
      L([gx + 6 * FT, gy + 3 * FT], [gx + 6 * FT, gy + 7 * FT], 'visible', 'H'); L([gx + 28.5 * FT, gy + 3 * FT], [gx + 28.5 * FT, gy + 7 * FT], 'visible', 'H');
      var tx = area.x1 - 2.6 * u;
      Tx([tx, gy + 0.08 * u], 'N.P.T. 0\'-0"', 3 / 32); Tx([tx, gy + plate + 0.08 * u], 'PLACA +9\'-0"', 3 / 32); Tx([tx, gy + ridge + 0.08 * u], 'CUMBRERA +18\'-0"', 3 / 32);
      Tx([gx + W / 2 + 4 * FT, gy + ridge - 2.2 * FT], '6/12', 3 / 32);
      title(gx, gy - 1.0 * u, 'ELEVACIÓN FRONTAL', 'ESCALA: ' + scLabel);
    } else if (id === 'c-orto') {
      // bloque en L: 3' de ancho, 3' de alto (escalón a 1'-6"), 2' de fondo. Tercer ángulo, como en EE. UU.
      var gap = 1.25, fx = area.cx - 3.1 * FT, fy = area.cy - 3.3 * FT;
      var pl = function (pts, pen) { for (var i = 0; i < pts.length; i++) L(pts[i], pts[(i + 1) % pts.length], pen); };
      var P = function (x, y) { return [fx + x * FT, fy + y * FT]; };
      pl([P(0, 0), P(3, 0), P(3, 3), P(1.5, 3), P(1.5, 1.5), P(0, 1.5)]);                        // frente
      var py = 3 + gap;
      pl([P(0, py), P(3, py), P(3, py + 2), P(0, py + 2)]); L(P(1.5, py), P(1.5, py + 2));        // planta
      var sx = 3 + gap;
      pl([P(sx, 0), P(sx + 2, 0), P(sx + 2, 3), P(sx, 3)]); L(P(sx, 1.5), P(sx + 2, 1.5), 'oculta'); // lateral derecha
      [0, 1.5, 3].forEach(function (x) { L(P(x, 3), P(x, py), 'construccion'); });
      [0, 1.5, 3].forEach(function (z) { L(P(3, z), P(sx, z), 'construccion'); });
      [0, 2].forEach(function (y) { L(P(3, py + y), P(sx + y, py + y), 'construccion'); L(P(sx + y, py + y), P(sx + y, 3), 'construccion'); });
      L(P(sx - 0.3, py - 0.3), P(sx + 2.5, py + 2.5), 'construccion', '2H');                     // línea a 45°
      Tx(P(0, -0.5), 'VISTA FRONTAL', 1 / 8); Tx(P(0, py + 2.3), 'PLANTA (VISTA SUPERIOR)', 1 / 8); Tx(P(sx, -0.5), 'VISTA LATERAL DERECHA', 1 / 8);
      title(area.x0 + 0.5 * u, area.y1 - 0.7 * u, 'VISTAS ORTOGONALES', 'ESCALA: ' + scLabel);
    } else if (id === 'c-iso') {
      var c3 = Math.cos(30 * D2R), s3 = 0.5, s = 1 * FT;
      var iso = function (x, y, z) { return [x * c3 - y * c3, x * s3 + y * s3 + z]; };
      // red isométrica con lado s: el origen cae en un nudo
      var o0 = isoSnap([area.cx - 0.6 * u, area.cy - 2.6 * u], s);
      var Q = function (x, y, z) { var q = iso(x * s, y * s, z * s); return [o0[0] + q[0], o0[1] + q[1]]; };
      var faces = [
        [[0, 0, 0], [4, 0, 0], [4, 0, 2], [0, 0, 2]], [[0, 0, 0], [0, 3, 0], [0, 3, 2], [0, 0, 2]],
        [[0, 0, 2], [2, 0, 2], [2, 3, 2], [0, 3, 2]], [[2, 0, 2], [4, 0, 2], [4, 0, 4], [2, 0, 4]],
        [[2, 0, 2], [2, 3, 2], [2, 3, 4], [2, 0, 4]], [[2, 0, 4], [4, 0, 4], [4, 3, 4], [2, 3, 4]]
      ];
      var seen = {};
      faces.forEach(function (f) {
        for (var i = 0; i < 4; i++) {
          var a = f[i], b = f[(i + 1) % 4], k1 = a.join(',') + '|' + b.join(','), k2 = b.join(',') + '|' + a.join(',');
          if (seen[k1] || seen[k2]) continue;
          seen[k1] = true;
          L(Q(a[0], a[1], a[2]), Q(b[0], b[1], b[2]));
        }
      });
      // ejes isométricos de guía
      L(Q(0, 0, 0), Q(6, 0, 0), 'construccion'); L(Q(0, 0, 0), Q(0, 5, 0), 'construccion'); L(Q(0, 0, 0), Q(0, 0, 6), 'construccion');
      Tx(Q(6.2, 0, 0), 'X 30°', 3 / 32); Tx(Q(0, 5.6, 0), '30° Y', 3 / 32); Tx(Q(0.15, 0, 6.1), 'Z 90°', 3 / 32);
      title(area.x0 + 0.5 * u, area.y1 - 0.7 * u, 'DIBUJO ISOMÉTRICO', 'ESCALA: ' + scLabel + ' · LADOS A 30°');
    }
    return { objects: objs, paper: JSON.parse(JSON.stringify(cfg)), item: item };
  }

  var api = {
    IN: IN, SCALES_FT: SCALES_FT, SCALES_M: SCALES_M, SHEETS: SHEETS, KINDS: KINDS, ISO_DIRS: ISO_DIRS,
    MARGIN: MARGIN, TITLE_W: TITLE_W, RULER: RULER, TSQ: TSQ, T3060: T3060, T45: T45,
    scaleById: scaleById, unitOf: unitOf, sheetSize: sheetSize, sheetRect: sheetRect, sheetLayout: sheetLayout,
    isoSnap: isoSnap, constrainDir: constrainDir,
    toWorld: toWorld, toLocal: toLocal, instGeom: instGeom, pointInPoly: pointInPoly, closestOnSeg: closestOnSeg,
    snapToEdges: snapToEdges, edgeDirs: edgeDirs, rulerTicks: rulerTicks, defaultInstruments: defaultInstruments,
    LEADS: LEADS, PENS: PENS, leadById: leadById, penById: penById, CLASS_LIST: CLASS_LIST, drawArea: drawArea, buildClass: buildClass
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CotaDraft = api;
})(this);
