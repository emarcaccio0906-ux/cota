/* Cota — editor de planos 2D con vista 3D, muebles, varios pisos y proyectos.
 * Todo en un solo archivo, sin dependencias. Unidades internas: metros, Y hacia arriba. */
(function () {
  'use strict';

  var U = window.CotaUnits;
  var G = window.CotaGeom;
  var F = window.CotaFurn;
  var TPL = window.CotaTemplates;
  var M3 = window.CotaModel3D;
  var D = window.CotaDraft;

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */
  var SNAP_PX = 14;          // radio de enganche en pantalla
  var PICK_PX = 10;          // radio para elegir objetos
  var MIN_SCALE = 2, MAX_SCALE = 3000;   // píxeles por metro
  var BASE_SCALE = 40;       // el 100% del zoom
  var GRID_STEPS_FT = [1 / 12, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
  var GRID_STEPS_M = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  var IN_M = 0.0254;
  // espaciados que se pueden elegir (en pulgadas o metros); incluye medidas de obra: 16" entre postes, 4' de plancha
  var STEP_PRESETS_FT = [['1"', 1], ['3"', 3], ['4"', 4], ['6"', 6], ['1\'', 12], ['16"', 16], ['2\'', 24], ['4\'', 48], ['5\'', 60], ['10\'', 120]]
    .map(function (a) { return { label: a[0], m: a[1] * IN_M }; });
  var STEP_PRESETS_M = [['1 cm', 0.01], ['5 cm', 0.05], ['10 cm', 0.1], ['25 cm', 0.25], ['50 cm', 0.5], ['1 m', 1], ['2 m', 2], ['5 m', 5]]
    .map(function (a) { return { label: a[0], m: a[1] }; });
  var WALL_PRESETS = [['Interior', 4.5 * IN_M], ['Exterior', 6.5 * IN_M], ['Bloque', 8 * IN_M], ['Muro grueso', 12 * IN_M]];
  var DOOR_PRESETS = { ft: [24, 28, 30, 32, 36, 60].map(function (i) { return i * IN_M; }), m: [0.6, 0.7, 0.8, 0.9, 1.0, 1.6] };
  var WINDOW_PRESETS = { ft: [24, 36, 48, 60, 72].map(function (i) { return i * IN_M; }), m: [0.6, 0.9, 1.2, 1.5, 1.8] };
  var STORE_DOC = 'cota:doc:v1';
  var STORE_PREFS = 'cota:prefs:v1';
  var STORE_INDEX = 'cota:projects:v1';
  var STORE_PROJECT = 'cota:p:';
  var LIMITS = { projects: 3, levels: 2 };      // plan gratis; el modo de pruebas los quita
  var MAX_LEVELS = 12;
  var DRAW_TOOLS = ['line', 'polyline', 'rect', 'circle', 'wall', 'door', 'window', 'dim'];
  var PEN_TYPES = ['line', 'polyline', 'rect', 'circle'];        // objetos que usan tipo de línea y mina
  var TYPE_NAMES = { line: 'Línea', polyline: 'Polilínea', rect: 'Rectángulo', circle: 'Círculo', wall: 'Pared', door: 'Puerta', window: 'Ventana', dim: 'Cota', furn: 'Mueble', room: 'Cuarto', text: 'Texto' };
  // modo clase: hoja de papel, escala de escalímetro, minas y escuadras
  var PAPER_DEFAULT = { sheet: '18x24', orient: 'land', scale: 'a0.25', gridMode: 'paper', gridIn: 0.25, snapDiv: 1,
    gridType: 'sq', gridInY: 0, isoIn: 0, isoAng: 30, realX: 0.3048, realY: 0, isoReal: 0, major: 4,
    gridStyle: 'lines', gridColor: 'azul', gridStrength: 'media', gridAt: 'centro',
    paperLen: true, printGrid: false, student: '', course: '', sheetNo: 'A-1', origin: [0, 0] };
  var GRID_PAPER_FT = [['1/16"', 1 / 16], ['1/8"', 1 / 8], ['1/4"', 1 / 4], ['1/2"', 1 / 2], ['1"', 1], ['1/10" (ingeniería)', 0.1]];
  var GRID_PAPER_M = [['1 mm', 1 / 25.4], ['2 mm', 2 / 25.4], ['5 mm', 5 / 25.4], ['1 cm', 10 / 25.4]];
  var TEXT_SIZES = [['3/32" (notas)', 3 / 32], ['1/8" (normal)', 1 / 8], ['3/16" (subtítulos)', 3 / 16], ['1/4" (títulos)', 1 / 4], ['1/2" (grande)', 1 / 2]];
  var INST_ORDER = ['tsq', 't3060', 't45', 'ruler'];
  var GRID_TYPES = [['En blanco', 'none', 'Hoja lisa, sin cuadrícula'], ['Cuadrada', 'sq', 'Líneas horizontales y verticales'], ['Isométrica', 'iso', 'Líneas a 30° y verticales'], ['Las dos', 'both', 'Cuadrada con la isométrica encima']];
  var uiLevel = 'simple', skipHome = false;
  var profile = { name: '', course: '', school: '' };
  var GRID_COLORS = { azul: [70, 140, 215], gris: [95, 105, 120], verde: [45, 150, 95], sepia: [165, 120, 70], rojo: [210, 80, 70] };
  var GRID_STRENGTH = { suave: [0.09, 0.2], media: [0.17, 0.36], fuerte: [0.3, 0.6] };
  var PAPER_COLORS = {
    canvas: '#fbfaf6', 'grid-minor': 'rgba(70, 140, 215, 0.17)', 'grid-major': 'rgba(70, 140, 215, 0.36)', 'axis-x': 'rgba(200, 50, 50, 0.5)', 'axis-y': 'rgba(30, 140, 70, 0.5)',
    ink: '#2a2e35', sel: '#0a7cc2', accent: '#d9480f', panel: '#ffffff', text: '#1b2536', muted: '#5d6b80', line: '#d3dae4'
  };

  var ICONS = {
    select: '<path d="M6 3l13 7-5.5 1.6L11 17z"/>',
    pan: '<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
    line: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="5" r="1.7"/>',
    polyline: '<path d="M4 18l5-9 5 6 6-10"/>',
    rect: '<rect x="5" y="6.5" width="14" height="11"/>',
    circle: '<circle cx="12" cy="12" r="7"/>',
    wall: '<path d="M3 9h18v6H3z"/><path d="M7 9v6M12 9v6M17 9v6" opacity=".55"/>',
    door: '<path d="M4 20h4M16 20h4"/><path d="M8 20V6"/><path d="M8 6a12 12 0 0 1 8 14" stroke-dasharray="2 2.4"/>',
    window: '<path d="M3 9.5h18v5H3z"/><path d="M3 12h18"/>',
    dim: '<path d="M5 8v10M19 8v10M5 13h14"/><path d="M7.5 11l-2.5 2 2.5 2M16.5 11l2.5 2-2.5 2"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12H8"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    eyeoff: '<path d="M3 3l18 18M9.9 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.1 7.4A15.5 15.5 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.9"/>',
    room: '<rect x="4" y="5" width="16" height="14"/><path d="M8 11h8M8 14.5h5"/>',
    furn: '<path d="M4 17v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M4 17h16M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M6 17v2M18 17v2"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'
  };

  var TOOLS = [
    { id: 'select', key: 'v', label: 'Elegir', name: 'Seleccionar' },
    { id: 'pan', key: 'h', label: 'Mano', name: 'Mover la vista' },
    'sep',
    { id: 'line', key: 'l', label: 'Línea', name: 'Línea' },
    { id: 'polyline', key: 'p', label: 'Polilín.', name: 'Polilínea' },
    { id: 'rect', key: 'r', label: 'Rect.', name: 'Rectángulo' },
    { id: 'circle', key: 'c', label: 'Círculo', name: 'Círculo' },
    'sep',
    { id: 'wall', key: 'w', label: 'Pared', name: 'Pared' },
    { id: 'door', key: 'd', label: 'Puerta', name: 'Puerta' },
    { id: 'window', key: 'n', label: 'Ventana', name: 'Ventana' },
    { id: 'dim', key: 'm', label: 'Cota', name: 'Cota (medida)' },
    'sep',
    { id: 'text', key: 't', label: 'Texto', name: 'Texto y rótulos' },
    { id: 'room', key: 'q', label: 'Cuarto', name: 'Cuarto: nombre y área' },
    { id: 'furn', key: 'u', label: 'Mueble', name: 'Muebles y escaleras' },
    'sep',
    { id: 'fit', key: 'f', label: 'Todo', name: 'Ver todo el dibujo', action: true }
  ];

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */
  var doc = { layers: [], objects: [], nextId: 1, activeLayer: 'dibujo', levels: [{ id: 'p1', name: 'Planta baja' }], level: 'p1', ws: 'libre', paper: clone(PAPER_DEFAULT) };
  var insts = D.defaultInstruments(D.sheetSize(PAPER_DEFAULT));
  var activeInst = 't3060', instOpen = window.innerWidth > 700, exporting = false;
  var pen = { type: 'visible', lead: 'HB' }, textIn = 1 / 8;
  var projects = [], curId = '', pro = false, showAreas = true;
  var furnKind = 'cama-queen', furnRot = 0, furnAlign = true;
  var roomCache = { key: '', mask: null };
  var units = 'ft';
  var theme = 'dark';
  var view = { cx: 0, cy: 0, scale: BASE_SCALE };
  var tool = 'select';
  var draft = null;                 // {tool, pts, start, count}
  var selection = new Set();
  var settings = { wallT: 4.5 * 0.0254, doorW: 0.9144, winW: 1.2192 };
  var gridCfg = { show: true, step: 0, major: 5, snapStep: 0 };   // step 0 = automático; snapStep 0 = igual a la cuadrícula
  var polarInc = 0;                 // grados; 0 = apagado
  var precision = { ft: 16, m: 0 }; // pies: denominador de la fracción; metros: decimales (0 = automático)
  var mouse = { sx: 0, sy: 0, raw: [0, 0], p: [0, 0], snap: { kind: 'free', p: [0, 0] }, over: false, polar: null };
  var snapOn = true, orthoOn = false, spaceDown = false, shiftDown = false, usedTouch = false;
  var history = [], histIdx = -1;
  var colors = {};
  var W = 300, H = 300, DPR = 1;
  var mode = '2d', view3d = null, cam3 = 'orbit';
  var s3 = { wallH: 2.4384, wallColor: 'blanco', floor: 'madera-clara', hour: 14, shadows: true, roof: 'none', doors: 90, cut: 0, level: 'all' };
  var ROOF_OPTS = [['none', 'Sin techo'], ['flat', 'Techo plano'], ['gable', 'A dos aguas']];
  var WALL_OPTS = [['blanco', 'Blanco'], ['crema', 'Crema'], ['concreto', 'Concreto'], ['gris', 'Gris oscuro'], ['ladrillo', 'Ladrillo'], ['pizarra', 'Azul pizarra']];
  var FLOOR_OPTS = [['madera-clara', 'Madera clara'], ['madera-oscura', 'Madera oscura'], ['concreto', 'Concreto pulido'], ['baldosa-blanca', 'Baldosa blanca'], ['baldosa-gris', 'Baldosa gris']];
  var HEIGHT_PRESETS = { ft: [8, 9, 10, 12].map(function (f) { return f * 0.3048; }), m: [2.4, 2.7, 3, 3.6] };

  var ptr = null;                   // puntero activo
  var touches = new Map();
  var gesture = null;
  var raf = 0, saveTimer = 0, toastTimer = 0;
  var boxRect = null;               // {x0,y0,x1,y1} en pantalla

  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), ctx = cv.getContext('2d');
  var cmdInput = $('cmd-input');

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clase() { return doc.ws === 'clase'; }
  function fmt(m) { return U.formatLength(m, units, units === 'ft' ? precision.ft : precision.m); }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svgIcon(name, size) {
    var s = size || 22;
    var d = document.createElement('span');
    d.style.display = 'inline-flex';
    d.innerHTML = '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true">' + ICONS[name] + '</svg>';
    return d.firstChild;
  }

  function idMap() { var m = {}; doc.objects.forEach(function (o) { m[o.id] = o; }); return m; }
  function layerById(id) { for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].id === id) return doc.layers[i]; return null; }
  function layerOf(o) { return layerById(o.layer) || doc.layers[0]; }
  function onLevel(o) { return !o.lv || o.lv === doc.level; }
  function layerShown(o) { return layerOf(o).visible; }                 // visible por capa (en 3D se ven todos los pisos)
  function isVisible(o) { return layerOf(o).visible && onLevel(o); }   // visible y en el piso que se edita
  function isLocked(o) { return layerOf(o).locked; }
  function levelIndex(id) { for (var i = 0; i < doc.levels.length; i++) if (doc.levels[i].id === id) return i; return -1; }
  function levelName(id) { var i = levelIndex(id); return i >= 0 ? doc.levels[i].name : ''; }

  function w2s(p) { return [(p[0] - view.cx) * view.scale + W / 2, H / 2 - (p[1] - view.cy) * view.scale]; }
  function s2w(sx, sy) { return [(sx - W / 2) / view.scale + view.cx, view.cy - (sy - H / 2) / view.scale]; }

  function autoStep() {
    var list = units === 'ft' ? GRID_STEPS_FT.map(function (x) { return x * U.FT; }) : GRID_STEPS_M;
    for (var i = 0; i < list.length; i++) if (list[i] * view.scale >= 14) return list[i];
    return list[list.length - 1];
  }
  /** Espaciado visible de la cuadrícula. Si es fijo y se aleja el zoom, se agrupa para que no se amontone. */
  function gridStep() {
    if (clase()) { var sp = gridSpec(); return (sp.type === 'iso' ? sp.si : sp.sx) * sp.f; }
    if (!gridCfg.step) return autoStep();
    var mult = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (var i = 0; i < mult.length; i++) if (gridCfg.step * mult[i] * view.scale >= 8) return gridCfg.step * mult[i];
    return gridCfg.step * 5000;
  }
  function snapStep() {
    if (clase()) return gridStep() / (doc.paper.snapDiv || 1);
    return gridCfg.snapStep > 0 ? gridCfg.snapStep : gridStep();
  }

  /* ---------- papel y escala (modo clase) ---------- */
  function curScale() {
    var sc = D.scaleById(doc.paper.scale);
    var list = units === 'm' ? D.SCALES_M : D.SCALES_FT;
    if (!sc || list.indexOf(sc) < 0) sc = nearestScale(sc ? sc.k : 1 / 48);
    return sc;
  }
  function nearestScale(k) {
    var list = units === 'm' ? D.SCALES_M : D.SCALES_FT, best = list[0];
    list.forEach(function (x) { if (Math.abs(Math.log(x.k / k)) < Math.abs(Math.log(best.k / k))) best = x; });
    return best;
  }
  function paperU() { return D.unitOf(curScale().k); }                 // metros reales por pulgada de papel
  function paperPx() { return paperU() * view.scale; }                 // píxeles por pulgada de papel
  function sheetLay() { return D.sheetLayout(doc.paper, curScale().k); }
  /** Espacio entre líneas de la cuadrícula en metros reales (horizontal). */
  function paperGridBase() { var sp = gridSpec(); return sp.type === 'iso' ? sp.si : sp.sx; }
  /** Cuadrícula de la hoja en metros reales: sx, sy (cuadrada), si y ang (isométrica), origen y agrupado por zoom (f). */
  function gridSpec() {
    var q = doc.paper, u = paperU(), real = q.gridMode === 'real';
    var sx = real ? q.realX : q.gridIn * u;
    var sy = real ? (q.realY || q.realX) : (q.gridInY || q.gridIn) * u;
    var si = real ? (q.isoReal || q.realX) : (q.isoIn || q.gridIn) * u;
    var off = [0, 0];
    if (q.gridAt === 'marco') { var fr = sheetLay().frame; off = [fr.x0, fr.y0]; }
    var t = q.gridType, ang = q.isoAng || 30;
    var small = Math.min(t === 'iso' ? Infinity : Math.min(sx, sy), (t === 'iso' || t === 'both') ? si * Math.cos(ang * Math.PI / 180) : Infinity);
    var f = 1, grp = q.major > 1 ? q.major : 4, need = q.gridStyle === 'dots' ? 9 : 6;
    while (small * f * view.scale < need && f < 1e7) f *= grp;
    return { type: t, sx: sx, sy: sy, si: si, ang: ang, off: off, f: f };
  }
  /** Punto de la cuadrícula de la hoja más cercano a p (respeta el paso del snap). */
  function paperSnap(p) {
    var sp = gridSpec(), div = doc.paper.snapDiv || 1, best = null;
    var q = [p[0] - sp.off[0], p[1] - sp.off[1]];
    if (sp.type !== 'iso') {
      var gx = sp.sx * sp.f / div, gy = sp.sy * sp.f / div;
      best = [Math.round(q[0] / gx) * gx, Math.round(q[1] / gy) * gy];
    }
    if (sp.type === 'iso' || sp.type === 'both') {
      var ip = D.isoSnap(q, sp.si * sp.f / div, sp.ang);
      if (!best || G.dist(ip, q) < G.dist(best, q)) best = ip;
    }
    return [best[0] + sp.off[0], best[1] + sp.off[1]];
  }
  function isoOn() { return clase() && (doc.paper.gridType === 'iso' || doc.paper.gridType === 'both'); }
  /** Cuánto mide en el papel una medida real. */
  function paperLenStr(m) {
    var onPaper = m * curScale().k;
    if (units === 'm') { var mm = onPaper * 1000; return (mm >= 100 ? (mm / 10).toFixed(1).replace(/\.0$/, '') + ' cm' : mm.toFixed(mm < 10 ? 1 : 0) + ' mm'); }
    return U.formatFtIn(onPaper, 16);
  }
  function lenTag(m) { return fmt(m) + (clase() && doc.paper.paperLen ? '  ·  ' + paperLenStr(m) + ' en papel' : ''); }
  function leadOf(o) {
    if (o.lead) return D.leadById(o.lead);
    if (o.pen) return D.leadById(D.penById(o.pen).lead);
    var def = { wall: 'B', door: 'H', window: 'H', dim: '2H', furn: 'H', text: 'F', room: 'F' }[o.type] || 'HB';
    return D.leadById(def);
  }
  function leadColor(ld) { return 'rgba(36, 40, 48, ' + ld.dark + ')'; }
  function leadPx(ld) { return Math.max(0.6, ld.mm / 25.4 * paperPx()); }
  function penDash(o) {
    var pn = o.pen ? D.penById(o.pen) : null;
    if (!pn || !pn.dash) return [];
    var k = clase() ? paperPx() : 96, d = pn.dash.map(function (x) { return x * k; });
    return d[0] < 3 ? [] : d;
  }

  function layerColor(l, dim) {
    var dark = theme === 'dark';
    var light = dark ? l.ld : l.ll;
    return 'hsl(' + l.hue + ' ' + l.sat + '% ' + light + '%' + (dim ? ' / 0.55' : '') + ')';
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Capas por defecto y dibujo de ejemplo                               */
  /* ------------------------------------------------------------------ */
  function defaultLayers() {
    return [
      { id: 'dibujo', name: 'Dibujo', hue: 195, sat: 85, ld: 66, ll: 36, visible: true, locked: false },
      { id: 'paredes', name: 'Paredes', hue: 215, sat: 16, ld: 84, ll: 24, visible: true, locked: false },
      { id: 'aberturas', name: 'Aberturas', hue: 36, sat: 95, ld: 62, ll: 36, visible: true, locked: false },
      { id: 'cotas', name: 'Cotas', hue: 145, sat: 55, ld: 62, ll: 30, visible: true, locked: false },
      { id: 'muebles', name: 'Muebles', hue: 32, sat: 60, ld: 68, ll: 38, visible: true, locked: false },
      { id: 'cuartos', name: 'Cuartos', hue: 160, sat: 45, ld: 72, ll: 32, visible: true, locked: false }
    ];
  }
  /** Las capas de muebles y cuartos no existían en dibujos viejos: se crean al primer uso. */
  function ensureLayer(id) {
    if (layerById(id)) return;
    defaultLayers().forEach(function (l) { if (l.id === id) doc.layers.push(l); });
  }
  var EXTRA_HUES = [285, 345, 62, 170, 18, 230];

  function buildExample() {
    var f = function (x) { return x * U.FT; };
    var d = { layers: defaultLayers(), objects: [], nextId: 1, activeLayer: 'dibujo', levels: [{ id: 'p1', name: 'Planta baja' }], level: 'p1' };
    function wall(ax, ay, bx, by, t) {
      var o = { id: d.nextId++, type: 'wall', lv: 'p1', layer: 'paredes', a: [f(ax), f(ay)], b: [f(bx), f(by)], t: f(t) };
      d.objects.push(o); return o;
    }
    function opening(type, wl, pos, w, flip) {
      d.objects.push({ id: d.nextId++, type: type, lv: 'p1', layer: 'aberturas', wall: wl.id, pos: f(pos), w: f(w), flip: !!flip });
    }
    var south = wall(0, 0, 36, 0, 0.667), east = wall(36, 0, 36, 24, 0.667);
    var north = wall(36, 24, 0, 24, 0.667), west = wall(0, 24, 0, 0, 0.667);
    var part = wall(22, 0, 22, 24, 0.375), bath = wall(22, 13, 36, 13, 0.375);
    opening('door', south, 8, 3, false);
    opening('door', part, 18.5, 2.667, true);
    opening('door', bath, 4.2, 2.5, true);
    opening('window', north, 10, 4, false);
    opening('window', north, 28.5, 5, false);
    opening('window', east, 6.5, 3.5, false);
    opening('window', west, 12, 4, false);
    d.objects.push({ id: d.nextId++, type: 'dim', lv: 'p1', layer: 'cotas', a: [f(0), f(0)], b: [f(36), f(0)], off: -f(3) });
    d.objects.push({ id: d.nextId++, type: 'dim', lv: 'p1', layer: 'cotas', a: [f(36), f(0)], b: [f(36), f(24)], off: -f(3) });
    d.objects.push({ id: d.nextId++, type: 'dim', lv: 'p1', layer: 'cotas', a: [f(22), f(24)], b: [f(22), f(13)], off: -f(3) });
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* Validación de archivos (importar y recuperar lo guardado)           */
  /* ------------------------------------------------------------------ */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isPt(p) { return Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]); }

  function cleanDoc(raw) {
    if (!raw || !Array.isArray(raw.layers) || !Array.isArray(raw.objects)) return null;
    var layers = raw.layers.filter(function (l) { return l && typeof l.id === 'string'; }).map(function (l) {
      return {
        id: String(l.id).slice(0, 40), name: String(l.name || l.id).slice(0, 60),
        hue: isNum(l.hue) ? l.hue : 200, sat: isNum(l.sat) ? l.sat : 70,
        ld: isNum(l.ld) ? l.ld : 66, ll: isNum(l.ll) ? l.ll : 36,
        visible: l.visible !== false, locked: !!l.locked
      };
    });
    if (!layers.length) return null;
    var layerIds = {};
    layers.forEach(function (l) { layerIds[l.id] = true; });

    var levels = [], lvSeen = {};
    (Array.isArray(raw.levels) ? raw.levels : []).forEach(function (l) {
      if (!l || typeof l.id !== 'string' || lvSeen[l.id] || levels.length >= MAX_LEVELS) return;
      lvSeen[l.id] = true;
      levels.push({ id: String(l.id).slice(0, 20), name: String(l.name || l.id).slice(0, 40) });
    });
    if (!levels.length) { levels = [{ id: 'p1', name: 'Planta baja' }]; lvSeen = { p1: true }; }

    var objects = [], seen = {}, maxId = 0, wallIds = {};
    raw.objects.forEach(function (o) {
      if (!o || !isNum(o.id) || seen[o.id]) return;
      var base = { id: Math.floor(o.id), type: o.type, layer: layerIds[o.layer] ? o.layer : layers[0].id, lv: lvSeen[o.lv] ? o.lv : levels[0].id };
      var ok = false;
      switch (o.type) {
        case 'line': ok = isPt(o.a) && isPt(o.b); if (ok) { base.a = o.a.slice(); base.b = o.b.slice(); } break;
        case 'dim': ok = isPt(o.a) && isPt(o.b) && isNum(o.off); if (ok) { base.a = o.a.slice(); base.b = o.b.slice(); base.off = o.off; } break;
        case 'rect': ok = isPt(o.a) && isPt(o.b); if (ok) { base.a = o.a.slice(); base.b = o.b.slice(); } break;
        case 'circle': ok = isPt(o.c) && isNum(o.r) && o.r > 0; if (ok) { base.c = o.c.slice(); base.r = o.r; } break;
        case 'polyline': ok = Array.isArray(o.pts) && o.pts.length >= 2 && o.pts.every(isPt); if (ok) { base.pts = o.pts.map(function (p) { return p.slice(); }); base.closed = !!o.closed; } break;
        case 'wall': ok = isPt(o.a) && isPt(o.b) && isNum(o.t) && o.t > 0; if (ok) { base.a = o.a.slice(); base.b = o.b.slice(); base.t = o.t; wallIds[base.id] = true; } break;
        case 'door': case 'window':
          ok = isNum(o.wall) && isNum(o.pos) && isNum(o.w) && o.w > 0;
          if (ok) {
            base.wall = o.wall; base.pos = o.pos; base.w = o.w; base.flip = !!o.flip; if (o.roll && o.type === 'door') base.roll = true;
            if (isNum(o.h) && o.h > 0.2 && o.h < 6) base.h = o.h;
            if (o.type === 'window' && isNum(o.sill) && o.sill >= 0 && o.sill < 6) base.sill = o.sill;
          }
          break;
        case 'furn':
          ok = isPt(o.p) && isNum(o.w) && o.w > 0.05 && isNum(o.d) && o.d > 0.05 && typeof o.kind === 'string';
          if (ok) {
            base.kind = String(o.kind).slice(0, 40); base.p = o.p.slice(); base.w = o.w; base.d = o.d; base.ang = isNum(o.ang) ? ((o.ang % 360) + 360) % 360 : 0;
            if (isNum(o.hgt) && o.hgt > 0.005 && o.hgt < 10) base.hgt = o.hgt;
            if (isNum(o.elev) && o.elev >= 0 && o.elev < 10) base.elev = o.elev;
          }
          break;
        case 'room':
          ok = isPt(o.p);
          if (ok) { base.p = o.p.slice(); base.name = String(o.name || 'Cuarto').slice(0, 60); }
          break;
        case 'text':
          ok = isPt(o.p) && isNum(o.h) && o.h > 0 && typeof o.text === 'string' && o.text.length > 0;
          if (ok) { base.p = o.p.slice(); base.h = o.h; base.text = o.text.slice(0, 200); }
          break;
        default: ok = false;
      }
      if (!ok) return;
      if (typeof o.pen === 'string' && D.penById(o.pen)) base.pen = o.pen;
      if (typeof o.lead === 'string' && D.leadById(o.lead)) base.lead = o.lead;
      seen[base.id] = true;
      maxId = Math.max(maxId, base.id);
      objects.push(base);
    });
    objects = objects.filter(function (o) { return (o.type !== 'door' && o.type !== 'window') || wallIds[o.wall]; });
    var active = layerIds[raw.activeLayer] ? raw.activeLayer : layers[0].id;
    return {
      layers: layers, objects: objects, nextId: Math.max(maxId + 1, isNum(raw.nextId) ? Math.floor(raw.nextId) : 1), activeLayer: active,
      levels: levels, level: lvSeen[raw.level] ? raw.level : levels[0].id,
      ws: raw.ws === 'clase' ? 'clase' : 'libre', paper: cleanPaper(raw.paper)
    };
  }
  function cleanPaper(q) {
    var out = clone(PAPER_DEFAULT);
    if (!q || typeof q !== 'object') return out;
    if (D.SHEETS[q.sheet]) out.sheet = q.sheet;
    if (q.orient === 'port') out.orient = 'port';
    if (D.scaleById(q.scale)) out.scale = q.scale;
    if (q.gridMode === 'real') out.gridMode = 'real';
    if (isNum(q.gridIn) && q.gridIn > 0.01 && q.gridIn <= 4) out.gridIn = q.gridIn;
    if (['none', 'sq', 'iso', 'both'].indexOf(q.gridType) >= 0) out.gridType = q.gridType;
    else if (q.iso === true) out.gridType = 'iso';                                   // versión anterior
    ['gridInY', 'isoIn'].forEach(function (k) { if (isNum(q[k]) && (q[k] === 0 || (q[k] > 0.01 && q[k] <= 4))) out[k] = q[k]; });
    ['realX', 'realY', 'isoReal'].forEach(function (k) { if (isNum(q[k]) && (q[k] === 0 || (q[k] > 0.001 && q[k] < 100))) out[k] = q[k]; });
    if (!(out.realX > 0)) out.realX = 0.3048;
    if (q.gridMode === 'real' && !isNum(q.realX) && gridCfg.step > 0) out.realX = gridCfg.step;   // versión anterior
    if (isNum(q.isoAng) && q.isoAng >= 5 && q.isoAng <= 85) out.isoAng = q.isoAng;
    if ([0, 2, 4, 5, 8, 10].indexOf(q.major) >= 0) out.major = q.major;
    if (q.gridStyle === 'dots') out.gridStyle = 'dots';
    if (GRID_COLORS[q.gridColor]) out.gridColor = q.gridColor;
    if (GRID_STRENGTH[q.gridStrength]) out.gridStrength = q.gridStrength;
    if (q.gridAt === 'marco') out.gridAt = 'marco';
    if ([1, 2, 4].indexOf(q.snapDiv) >= 0) out.snapDiv = q.snapDiv;
    out.paperLen = q.paperLen !== false;
    out.printGrid = q.printGrid === true;
    ['student', 'course', 'sheetNo'].forEach(function (k) { if (typeof q[k] === 'string') out[k] = q[k].slice(0, 60); });
    if (isPt(q.origin)) out.origin = q.origin.slice();
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Historial y guardado                                                */
  /* ------------------------------------------------------------------ */
  function snapshot() { return JSON.stringify({ layers: doc.layers, objects: doc.objects, nextId: doc.nextId, activeLayer: doc.activeLayer, levels: doc.levels, level: doc.level, ws: doc.ws, paper: doc.paper }); }

  function commit() {
    history = history.slice(0, histIdx + 1);
    history.push(snapshot());
    if (history.length > 200) history.shift();
    histIdx = history.length - 1;
    autosave();
    uiSync();
    requestRender();
  }

  function applySnapshot(str) {
    var d = JSON.parse(str);
    doc = { layers: d.layers, objects: d.objects, nextId: d.nextId, activeLayer: d.activeLayer, levels: d.levels || [{ id: 'p1', name: 'Planta baja' }], level: d.level || 'p1', ws: doc.ws, paper: doc.paper };
    if (levelIndex(doc.level) < 0) doc.level = doc.levels[0].id;
    var ids = idMap();
    selection = new Set(Array.from(selection).filter(function (id) { return ids[id]; }));
    draft = null;
    autosave();
    uiSync();
    if (mode === '3d') sync3D(false);
    requestRender();
  }
  function undo() { if (draft) { cancelDraft(); return; } if (histIdx > 0) { histIdx--; applySnapshot(history[histIdx]); } }
  function redo() { if (histIdx < history.length - 1) { histIdx++; applySnapshot(history[histIdx]); } }

  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  /** Guarda el proyecto actual en este navegador. */
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!curId) return;
    try {
      localStorage.setItem(STORE_PROJECT + curId, snapshot());
      var e = projectById(curId);
      if (e) { e.updated = Date.now(); e.ws = doc.ws; e.thumb = thumbOf(doc); saveIndex(); }
    } catch (err) { toast('No hay espacio para guardar en este navegador. Descarga el plano con Guardar.'); }
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORE_PREFS, JSON.stringify({
        units: units, theme: theme, snapOn: snapOn, orthoOn: orthoOn, settings: settings, grid: gridCfg, polar: polarInc,
        precision: precision, s3: s3, cur: curId, pro: pro, areas: showAreas, furn: { kind: furnKind, align: furnAlign },
        insts: insts, instOpen: instOpen, pen: pen, textIn: textIn, uiLevel: uiLevel, profile: profile, skipHome: skipHome
      }));
    } catch (e) { /* nada */ }
  }
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(STORE_PREFS) || 'null');
      if (p) {
        if (p.units === 'm' || p.units === 'ft') units = p.units;
        if (p.theme === 'light' || p.theme === 'dark') theme = p.theme;
        if (typeof p.snapOn === 'boolean') snapOn = p.snapOn;
        if (typeof p.orthoOn === 'boolean') orthoOn = p.orthoOn;
        if (p.settings && isNum(p.settings.wallT) && isNum(p.settings.doorW) && isNum(p.settings.winW)) settings = p.settings;
        if (p.grid && typeof p.grid.show === 'boolean' && isNum(p.grid.step) && p.grid.step >= 0 && isNum(p.grid.snapStep) && p.grid.snapStep >= 0 && [0, 2, 4, 5, 8, 10].indexOf(p.grid.major) >= 0) gridCfg = p.grid;
        if ([0, 15, 30, 45, 90].indexOf(p.polar) >= 0) polarInc = p.polar;
        if (p.precision && [1, 2, 4, 8, 16].indexOf(p.precision.ft) >= 0 && [0, 1, 2, 3].indexOf(p.precision.m) >= 0) precision = p.precision;
        var q = p.s3;
        if (q && typeof q.roof === 'boolean') q.roof = q.roof ? 'flat' : 'none';     // versión anterior
        if (q && isNum(q.wallH) && q.wallH >= 1.5 && q.wallH <= 8 && isNum(q.hour) && q.hour >= 6 && q.hour <= 18 &&
            WALL_OPTS.some(function (o) { return o[0] === q.wallColor; }) && FLOOR_OPTS.some(function (o) { return o[0] === q.floor; }) &&
            typeof q.shadows === 'boolean' && ROOF_OPTS.some(function (o) { return o[0] === q.roof; }) && (q.doors === 0 || q.doors === 90) && [0, 1.2192, 0.3].indexOf(q.cut) >= 0) {
          if (!(q.level === 'all' || (isNum(q.level) && q.level >= 0 && q.level < MAX_LEVELS))) q.level = 'all';
          s3 = q;
        }
        if (typeof p.cur === 'string') curId = p.cur;
        if (p.pro === true) pro = true;
        if (typeof p.areas === 'boolean') showAreas = p.areas;
        if (p.furn && F.get(p.furn.kind)) { furnKind = p.furn.kind; if (typeof p.furn.align === 'boolean') furnAlign = p.furn.align; }
        if (p.insts) INST_ORDER.forEach(function (id) {
          var q = p.insts[id], it = insts[id];
          if (!q) return;
          it.on = q.on === true;
          if (id === 'tsq') { if (isNum(q.y)) it.y = q.y; }
          else { if (isPt(q.p)) it.p = q.p.slice(); if (isNum(q.ang)) it.ang = q.ang; it.flip = q.flip === true; }
        });
        if (typeof p.instOpen === 'boolean') instOpen = p.instOpen;
        if (p.pen && D.penById(p.pen.type) && D.leadById(p.pen.lead)) pen = { type: p.pen.type, lead: p.pen.lead };
        if (isNum(p.textIn) && p.textIn > 0.03 && p.textIn < 1) textIn = p.textIn;
        if (p.uiLevel === 'avanzado') uiLevel = 'avanzado';
        if (p.profile && typeof p.profile === 'object') ['name', 'course', 'school'].forEach(function (k) { if (typeof p.profile[k] === 'string') profile[k] = p.profile[k].slice(0, 60); });
        if (p.skipHome === true) skipHome = true;
        return true;
      }
    } catch (e) { /* nada */ }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Tamaño y render                                                     */
  /* ------------------------------------------------------------------ */
  function resize() {
    var r = $('stage').getBoundingClientRect();
    W = Math.max(50, Math.round(r.width));
    H = Math.max(50, Math.round(r.height));
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    if (view3d) view3d.resize(W, H);
    requestRender();
  }

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ['canvas', 'grid-minor', 'grid-major', 'axis-x', 'axis-y', 'ink', 'sel', 'accent', 'panel', 'text', 'muted', 'line'].forEach(function (k) {
      colors[k] = cs.getPropertyValue('--' + k).trim();
    });
  }

  function requestRender() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; render(false); });
  }

  function render(clean) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var paper = clase(), themeColors = colors;
    ctx.fillStyle = paper ? (theme === 'dark' ? '#070c13' : '#cfd6df') : colors.canvas;
    ctx.fillRect(0, 0, W, H);
    if (paper) { drawSheet(); colors = PAPER_COLORS; }
    try { renderBody(clean, paper); } finally { colors = themeColors; }
  }
  function renderBody(clean, paper) {
    if (!paper) { drawGrid(); drawAxes(); }
    else if (!exporting || doc.paper.printGrid) {
      var fr = sheetLay().frame, A = w2s([fr.x0, fr.y1]), B = w2s([fr.x1, fr.y0]);
      ctx.save(); ctx.beginPath(); ctx.rect(A[0], A[1], B[0] - A[0], B[1] - A[1]); ctx.clip();
      drawGrid();
      ctx.restore();
    }

    var map = idMap();
    var byWall = {};
    doc.objects.forEach(function (o) {
      if ((o.type === 'door' || o.type === 'window') && isVisible(o)) (byWall[o.wall] = byWall[o.wall] || []).push(o);
    });
    if (!clean) drawBelow(map);
    doc.layers.forEach(function (l) {
      if (!l.visible) return;
      doc.objects.forEach(function (o) {
        if (o.layer === l.id && onLevel(o)) drawObject(o, map, byWall, null);
      });
    });
    drawRoomLabels(clean);
    if (paper) drawTitleBlock();

    if (!clean) {
      selection.forEach(function (id) {
        var o = map[id];
        if (o && isVisible(o)) drawObject(o, map, byWall, { sel: true });
      });
      if (paper) drawInstruments();
      drawDraft(map);
      drawBox();
      drawSnapMarker();
    }
  }

  function drawGrid() {
    if (!gridCfg.show) return;
    if (clase()) { drawPaperGrid(); return; }
    var step = gridStep(), mj = gridCfg.major;
    var a = s2w(0, H), b = s2w(W, 0);
    var i0 = Math.floor(a[0] / step), i1 = Math.ceil(b[0] / step);
    var j0 = Math.floor(a[1] / step), j1 = Math.ceil(b[1] / step);
    var minor = new Path2D(), major = new Path2D();
    var i, j, s, path;
    for (i = i0; i <= i1; i++) {
      s = Math.round(w2s([i * step, 0])[0]) + 0.5;
      path = (mj > 0 && i % mj === 0) ? major : minor;
      path.moveTo(s, 0); path.lineTo(s, H);
    }
    for (j = j0; j <= j1; j++) {
      s = Math.round(w2s([0, j * step])[1]) + 0.5;
      path = (mj > 0 && j % mj === 0) ? major : minor;
      path.moveTo(0, s); path.lineTo(W, s);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors['grid-minor']; ctx.stroke(minor);
    ctx.strokeStyle = colors['grid-major']; ctx.stroke(major);
  }

  /** Cuadrícula de la hoja: cuadrada (con ancho y alto propios), isométrica a cualquier ángulo, o las dos; en líneas o puntos. */
  function drawPaperGrid() {
    var q = doc.paper, sp = gridSpec();
    if (sp.type === 'none') return;
    var rgb = GRID_COLORS[q.gridColor] || GRID_COLORS.azul, al = GRID_STRENGTH[q.gridStrength] || GRID_STRENGTH.media;
    var mj = q.major > 0 ? q.major : 0, dots = q.gridStyle === 'dots', kd = dots ? 2.4 : 1;
    var colMinor = 'rgba(' + rgb.join(',') + ',' + Math.min(1, al[0] * kd) + ')', colMajor = 'rgba(' + rgb.join(',') + ',' + Math.min(1, al[1] * kd) + ')';
    var A = s2w(0, H), B = s2w(W, 0), ox = sp.off[0], oy = sp.off[1];
    var a = [A[0] - ox, A[1] - oy], b = [B[0] - ox, B[1] - oy];
    var minor = new Path2D(), major = new Path2D();
    function isMaj(n) { return mj > 0 && ((n % mj) + mj) % mj === 0; }
    function seg(path, p, r) { var P = w2s([p[0] + ox, p[1] + oy]), Q = w2s([r[0] + ox, r[1] + oy]); path.moveTo(P[0], P[1]); path.lineTo(Q[0], Q[1]); }
    function dot(path, x, y, big) { var P = w2s([x + ox, y + oy]); path.moveTo(P[0] + (big ? 1.6 : 1), P[1]); path.arc(P[0], P[1], big ? 1.6 : 1, 0, Math.PI * 2); }
    var i, j, c;
    if (sp.type === 'sq' || sp.type === 'both') {
      var gx = sp.sx * sp.f, gy = sp.sy * sp.f;
      var i0 = Math.floor(a[0] / gx), i1 = Math.ceil(b[0] / gx), j0 = Math.floor(a[1] / gy), j1 = Math.ceil(b[1] / gy);
      if (dots) {
        for (i = i0; i <= i1; i++) for (j = j0; j <= j1; j++) { var big = isMaj(i) && isMaj(j); dot(big ? major : minor, i * gx, j * gy, big); }
      } else {
        for (i = i0; i <= i1; i++) seg(isMaj(i) ? major : minor, [i * gx, a[1]], [i * gx, b[1]]);
        for (j = j0; j <= j1; j++) seg(isMaj(j) ? major : minor, [a[0], j * gy], [b[0], j * gy]);
      }
    }
    if (sp.type === 'iso' || sp.type === 'both') {
      var s = sp.si * sp.f, ra = sp.ang * Math.PI / 180, bx = s * Math.cos(ra), rise = s * Math.sin(ra), v = 2 * rise, t = Math.tan(ra);
      var isoMinor = sp.type === 'both' ? new Path2D() : minor, isoMajor = sp.type === 'both' ? new Path2D() : major;
      if (dots) {
        for (i = Math.floor(a[0] / bx); i <= Math.ceil(b[0] / bx); i++) {
          for (j = Math.floor((a[1] - i * rise) / v) - 1; j <= Math.ceil((b[1] - i * rise) / v) + 1; j++) dot(isMaj(i) && isMaj(j) ? isoMajor : isoMinor, i * bx, i * rise + j * v, isMaj(i) && isMaj(j));
        }
      } else {
        for (i = Math.floor(a[0] / bx); i <= Math.ceil(b[0] / bx); i++) seg(isMaj(i) ? isoMajor : isoMinor, [i * bx, a[1]], [i * bx, b[1]]);
        var cs = [a[1] - b[0] * t, b[1] - a[0] * t, a[1] - a[0] * t, b[1] - b[0] * t];
        for (c = Math.floor(Math.min.apply(null, cs) / v); c <= Math.ceil(Math.max.apply(null, cs) / v); c++) seg(isMaj(c) ? isoMajor : isoMinor, [a[0], a[0] * t + c * v], [b[0], b[0] * t + c * v]);
        cs = [a[1] + a[0] * t, b[1] + b[0] * t, a[1] + b[0] * t, b[1] + a[0] * t];
        for (c = Math.floor(Math.min.apply(null, cs) / v); c <= Math.ceil(Math.max.apply(null, cs) / v); c++) seg(isMaj(c) ? isoMajor : isoMinor, [a[0], -a[0] * t + c * v], [b[0], -b[0] * t + c * v]);
      }
      if (sp.type === 'both') {
        // la isométrica encima, un poco más suave para no confundirse con la cuadrada
        ctx.save(); ctx.globalAlpha = 0.75; ctx.lineWidth = 1;
        if (dots) { ctx.fillStyle = colMinor; ctx.fill(isoMinor); ctx.fillStyle = colMajor; ctx.fill(isoMajor); }
        else { ctx.setLineDash([3, 3]); ctx.strokeStyle = colMinor; ctx.stroke(isoMinor); ctx.strokeStyle = colMajor; ctx.stroke(isoMajor); }
        ctx.restore();
      }
    }
    ctx.lineWidth = 1; ctx.setLineDash([]);
    if (dots) { ctx.fillStyle = colMinor; ctx.fill(minor); ctx.fillStyle = colMajor; ctx.fill(major); }
    else { ctx.strokeStyle = colMinor; ctx.stroke(minor); ctx.strokeStyle = colMajor; ctx.stroke(major); }
  }

  /* ---------- hoja, cajetín y escuadras ---------- */
  function rectS(r) { var A = w2s([r.x0, r.y1]), B = w2s([r.x1, r.y0]); return [A[0], A[1], B[0] - A[0], B[1] - A[1]]; }
  function drawSheet() {
    var r = rectS(sheetLay().sheet);
    ctx.save();
    if (!exporting) { ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
    ctx.fillStyle = PAPER_COLORS.canvas;
    ctx.fillRect(r[0], r[1], r[2], r[3]);
    ctx.restore();
  }
  function paperText(text, x, y, sizeIn, opts) {
    var px = sizeIn * paperPx();
    if (px < 3.5) return;
    opts = opts || {};
    ctx.font = (opts.bold ? '600 ' : '') + px + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.base || 'alphabetic';
    ctx.fillStyle = opts.color || leadColor(D.leadById('F'));
    ctx.fillText(text, x, y);
  }
  function drawTitleBlock() {
    var lay = sheetLay(), fr = rectS(lay.frame), tb = rectS(lay.title), pp = paperPx(), q = doc.paper;
    var heavy = D.leadById('2B'), mid = D.leadById('H');
    ctx.save(); ctx.setLineDash([]);
    ctx.strokeStyle = leadColor(heavy); ctx.lineWidth = leadPx(heavy);
    ctx.strokeRect(fr[0], fr[1], fr[2], fr[3]);
    ctx.strokeRect(tb[0], tb[1], tb[2], tb[3]);
    var e = projectById(curId), name = (e ? e.name : 'Plano').toUpperCase();
    var date = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var rows = [
      ['PROYECTO', name, 1 / 8], ['DIBUJÓ', (q.student || profile.name || '').toUpperCase(), 1 / 8], ['CURSO', (q.course || profile.course || '').toUpperCase(), 1 / 8],
      ['FECHA', date, 1 / 8], ['ESCALA', curScale().label.toUpperCase(), 1 / 8], ['LÁMINA', q.sheetNo || 'A-1', 3 / 8]
    ];
    var port = q.orient === 'port';
    ctx.strokeStyle = leadColor(mid); ctx.lineWidth = leadPx(mid);
    var pad = 0.1 * pp;
    if (!port) {
      // franja vertical: filas apiladas desde abajo
      var rh = [0.55, 0.55, 0.55, 0.55, 0.55, 0.9].map(function (h) { return h * pp; });
      var y = tb[1] + tb[3];
      for (var i = rows.length - 1; i >= 0; i--) {
        var r = rows[rows.length - 1 - i], h = rh[rows.length - 1 - i];
        ctx.beginPath(); ctx.moveTo(tb[0], y - h); ctx.lineTo(tb[0] + tb[2], y - h); ctx.stroke();
        paperText(r[0], tb[0] + pad, y - h + 0.16 * pp, 1 / 16, { color: leadColor(D.leadById('2H')) });
        fitText(r[1], tb[0] + pad, y - pad * 0.9, r[2], tb[2] - 2 * pad, true);
        y -= h;
      }
      paperText('COTA', tb[0] + tb[2] / 2, tb[1] + 0.5 * pp, 1 / 4, { align: 'center', bold: true, color: leadColor(D.leadById('B')) });
    } else {
      var cw = tb[2] / rows.length;
      rows.forEach(function (r, i) {
        var x = tb[0] + i * cw;
        if (i) { ctx.beginPath(); ctx.moveTo(x, tb[1]); ctx.lineTo(x, tb[1] + tb[3]); ctx.stroke(); }
        paperText(r[0], x + pad, tb[1] + 0.2 * pp, 1 / 16, { color: leadColor(D.leadById('2H')) });
        fitText(r[1], x + pad, tb[1] + tb[3] - pad, Math.min(r[2], 1 / 4), cw - 2 * pad, true);
      });
    }
    ctx.restore();
  }
  function fitText(text, x, y, sizeIn, maxW, bold) {
    if (!text) return;
    var size = sizeIn, px = size * paperPx();
    if (px < 3.5) return;
    ctx.font = (bold ? '600 ' : '') + px + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
    var w = ctx.measureText(text).width;
    if (w > maxW) size *= maxW / w;
    paperText(text, x, y, size, { bold: bold, color: leadColor(D.leadById('HB')) });
  }

  function instWorld(it) {
    var u = paperU(), o = doc.paper.origin;
    if (it.kind === 'tsq') return { kind: 'tsq', y: o[1] + it.y * u };
    return { kind: it.kind, p: [o[0] + it.p[0] * u, o[1] + it.p[1] * u], ang: it.ang || 0, flip: !!it.flip };
  }
  function instGeomOf(id) { return D.instGeom(instWorld(insts[id]), paperU(), sheetLay().sheet); }
  function shownInsts() { return clase() && mode === '2d' && !exporting ? INST_ORDER.filter(function (id) { return insts[id].on; }) : []; }
  function instEdges() {
    var out = [];
    shownInsts().forEach(function (id) { instGeomOf(id).edges.forEach(function (e) { out.push(e); }); });
    return out;
  }
  function drawInstruments() {
    var u = paperU(), pp = paperPx();
    shownInsts().forEach(function (id) {
      var it = insts[id], g = instGeomOf(id), act = id === activeInst;
      ctx.save(); ctx.setLineDash([]);
      ctx.beginPath();
      [g.outer, g.hole].forEach(function (poly) {
        if (!poly) return;
        poly.forEach(function (q, i) { var S = w2s(q); if (i) ctx.lineTo(S[0], S[1]); else ctx.moveTo(S[0], S[1]); });
        ctx.closePath();
      });
      ctx.fillStyle = id === 'ruler' ? 'rgba(250, 249, 242, 0.93)' : id === 'tsq' ? 'rgba(222, 200, 160, 0.62)' : 'rgba(110, 185, 255, 0.2)';
      ctx.fill('evenodd');
      ctx.lineWidth = act ? 2 : 1.2;
      ctx.strokeStyle = act ? colors.accent : 'rgba(40, 95, 160, 0.75)';
      ctx.stroke();
      // canto de trabajo un poco más marcado
      ctx.lineWidth = act ? 2.4 : 1.6;
      g.edges.forEach(function (e) { var A = w2s(e.a), B = w2s(e.b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); });
      if (id === 'ruler') drawRulerMarks(it, u, pp);
      if (id === 't3060' || id === 't45') {
        var lab = id === 't45' ? '45°' : '30°-60°', c = w2s(D.toWorld(instWorld(it), u, id === 't45' ? [1.6, 1.6] : [1.1, 2.6]));
        if (pp * 0.3 > 5) {
          ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-(it.ang || 0) * Math.PI / 180);
          ctx.font = '600 ' + (0.3 * pp) + 'px system-ui, sans-serif'; ctx.fillStyle = 'rgba(30, 80, 140, 0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(lab, 0, 0); ctx.restore();
        }
      }
      if (g.handle) {
        var H2 = w2s(g.handle);
        ctx.beginPath(); ctx.arc(H2[0], H2[1], 11, 0, Math.PI * 2);
        ctx.fillStyle = act ? colors.accent : 'rgba(40, 95, 160, 0.85)'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(H2[0], H2[1], 5.5, -Math.PI * 0.2, Math.PI * 1.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(H2[0] + 5.5 * Math.cos(-Math.PI * 0.2) + 3, H2[1] + 5.5 * Math.sin(-Math.PI * 0.2) - 1); ctx.lineTo(H2[0] + 5.5 * Math.cos(-Math.PI * 0.2), H2[1] + 5.5 * Math.sin(-Math.PI * 0.2)); ctx.lineTo(H2[0] + 5.5 * Math.cos(-Math.PI * 0.2) + 0.5, H2[1] + 5.5 * Math.sin(-Math.PI * 0.2) - 4); ctx.stroke();
      }
      ctx.restore();
    });
  }
  function drawRulerMarks(it, u, pp) {
    var wi = instWorld(it), sc = curScale(), rt = D.rulerTicks(sc.k, units === 'm');
    var ang = -(it.ang || 0) * Math.PI / 180;
    ctx.strokeStyle = 'rgba(20, 24, 30, 0.85)'; ctx.fillStyle = 'rgba(20, 24, 30, 0.9)'; ctx.lineWidth = 1;
    var fs = 0.17 * pp, showLab = fs >= 6;
    ctx.beginPath();
    rt.ticks.forEach(function (t) {
      var A = w2s(D.toWorld(wi, u, [t.x, 0])), B = w2s(D.toWorld(wi, u, [t.x, t.h]));
      ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
    });
    ctx.stroke();
    if (showLab) {
      ctx.font = fs + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      rt.ticks.forEach(function (t) {
        if (!t.label) return;
        var P = w2s(D.toWorld(wi, u, [t.x, t.h + 0.06]));
        ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(ang); ctx.fillText(t.label, 0, -fs * 0.1); ctx.restore();
      });
      var T = w2s(D.toWorld(wi, u, [D.RULER.len - 1.6, D.RULER.w * 0.7]));
      ctx.save(); ctx.translate(T[0], T[1]); ctx.rotate(ang);
      ctx.font = '600 ' + (fs * 1.25) + 'px system-ui, sans-serif'; ctx.fillText(rt.title, 0, 0);
      ctx.font = (fs * 0.8) + 'px system-ui, sans-serif'; ctx.fillText(units === 'm' ? 'metros' : (sc.id === 'full' ? 'pulgadas' : 'pies'), 0, fs * 1.1);
      ctx.restore();
    }
  }

  function drawAxes() {
    var o = w2s([0, 0]);
    ctx.lineWidth = 1;
    if (o[1] >= 0 && o[1] <= H) { ctx.strokeStyle = colors['axis-x']; ctx.beginPath(); ctx.moveTo(0, Math.round(o[1]) + 0.5); ctx.lineTo(W, Math.round(o[1]) + 0.5); ctx.stroke(); }
    if (o[0] >= 0 && o[0] <= W) { ctx.strokeStyle = colors['axis-y']; ctx.beginPath(); ctx.moveTo(Math.round(o[0]) + 0.5, 0); ctx.lineTo(Math.round(o[0]) + 0.5, H); ctx.stroke(); }
  }

  function quad(a, b, t, extA, extB) {
    var u = G.norm(G.sub(b, a)), n = G.perp(u), h = t / 2;
    var a2 = extA ? G.add(a, G.mul(u, -h)) : a;
    var b2 = extB ? G.add(b, G.mul(u, h)) : b;
    return [G.add(a2, G.mul(n, h)), G.add(b2, G.mul(n, h)), G.add(b2, G.mul(n, -h)), G.add(a2, G.mul(n, -h))];
  }
  function pathPoly(pts, close) {
    ctx.beginPath();
    pts.forEach(function (p, i) { var s = w2s(p); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); });
    if (close) ctx.closePath();
  }

  function drawObject(o, map, byWall, opts) {
    var sel = opts && opts.sel;
    var layer = layerOf(o);
    var col = sel ? colors.sel : layerColor(layer);
    var lw = sel ? 2.6 : 1.6, dash = [];
    if (clase()) {
      var ld = leadOf(o);
      lw = leadPx(ld) + (sel ? 1.4 : 0);
      if (!sel) col = leadColor(ld);
      dash = penDash(o);
    } else if (o.pen) { dash = penDash(o); }
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.lineJoin = 'round'; ctx.lineCap = clase() ? 'butt' : 'round'; ctx.setLineDash(dash);

    switch (o.type) {
      case 'line': pathPoly([o.a, o.b], false); ctx.stroke(); break;
      case 'polyline': pathPoly(o.pts, o.closed); ctx.stroke(); break;
      case 'rect': pathPoly(G.rectCorners(o), true); ctx.stroke(); break;
      case 'circle':
        var c = w2s(o.c);
        ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(0.5, o.r * view.scale), 0, Math.PI * 2); ctx.stroke(); break;
      case 'wall': drawWall(o, byWall[o.id] || [], sel, col); break;
      case 'door': case 'window': drawOpening(o, map, col, sel); break;
      case 'dim': drawDim(o, col, sel); break;
      case 'furn': drawFurn(o, col, sel ? 2.6 : 1.4, true); break;
      case 'room':
        var rp = w2s(o.p);
        ctx.beginPath(); ctx.arc(rp[0], rp[1], sel ? 7 : 3, 0, Math.PI * 2);
        if (sel) ctx.stroke(); else ctx.fill();
        break;
      case 'text': drawText(o, col, sel); break;
      default: break;
    }
    ctx.setLineDash([]);
  }

  function drawText(o, col, sel) {
    var px = o.h * view.scale, P = w2s(o.p);
    if (px < 2.5) { ctx.fillRect(P[0], P[1] - 1, Math.max(2, o.text.length * px * 0.6), 1.5); return; }
    ctx.save(); ctx.setLineDash([]);
    ctx.font = px + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = col; ctx.fillText(o.text, P[0], P[1]);
    if (sel) { var b = G.textBox(o), r = rectS(b); ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6); }
    ctx.restore();
  }

  /* ---------- muebles ---------- */
  /** Símbolo en planta. Se dibuja en coordenadas locales del mueble: x ancho, y fondo (arriba = pared de atrás). */
  function drawFurn(o, col, lw, label, ghost) {
    var sc = view.scale, c = w2s(o.p), hw = o.w / 2, hd = o.d / 2;
    if (Math.max(o.w, o.d) * sc < 3) return;
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.rotate(-(o.ang || 0) * Math.PI / 180);
    ctx.scale(sc, -sc);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw / sc; ctx.setLineDash([]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function box(x, y, w, d) { ctx.beginPath(); ctx.rect(x - w / 2, y - d / 2, w, d); ctx.stroke(); }
    function ell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.001, rx), Math.max(0.001, ry), 0, 0, Math.PI * 2); ctx.stroke(); }
    function ln(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    if (ghost) { ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.rect(-hw, -hd, o.w, o.d); ctx.fill(); ctx.globalAlpha = 1; }
    var itm = F.get(o.kind);
    if (itm && itm.round) ell(0, 0, hw, hd); else box(0, 0, o.w, o.d);
    var k = o.kind, thin = 0.7;
    ctx.lineWidth = lw * thin / sc;
    switch (k) {
      case 'cama-queen': case 'cama-king': case 'cama-sencilla':
        if (k === 'cama-sencilla') box(0, hd - 0.3, o.w - 0.2, 0.4);
        else { box(-o.w / 4, hd - 0.3, o.w / 2 - 0.1, 0.4); box(o.w / 4, hd - 0.3, o.w / 2 - 0.1, 0.4); }
        ln(-hw, hd - 0.75, hw, hd - 0.75); break;
      case 'closet': ln(-hw, -hd, hw, hd); ln(-hw, hd, hw, -hd); break;
      case 'comoda': ln(0, -hd, 0, hd); box(0, 0, o.w - 0.1, o.d - 0.1); break;
      case 'sofa': case 'sofa2': case 'sillon':
        ln(-hw, hd - 0.2, hw, hd - 0.2); ln(-hw + 0.2, -hd, -hw + 0.2, hd - 0.2); ln(hw - 0.2, -hd, hw - 0.2, hd - 0.2); break;
      case 'mesa-centro': case 'mesa-comedor': box(0, 0, o.w - 0.12, o.d - 0.12); break;
      case 'mesa-trabajo': box(0, 0, o.w - 0.1, o.d - 0.1); break;
      case 'escritorio': ln(hw - 0.45, -hd, hw - 0.45, hd); break;
      case 'silla': ln(-hw, hd - 0.06, hw, hd - 0.06); break;
      case 'tv': ln(-o.w * 0.36, 0.04, o.w * 0.36, 0.04); break;
      case 'nevera': ln(-hw, -hd + 0.14, hw, -hd + 0.14); break;
      case 'estufa': [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { ell(q[0] * o.w * 0.22, q[1] * o.d * 0.2, 0.09, 0.09); }); break;
      case 'fregadero': box(0, -0.02, o.w * 0.62, o.d * 0.58); ell(0, hd - 0.07, 0.025, 0.025); break;
      case 'gabinete': box(0, 0, o.w - 0.12, o.d - 0.12); break;
      case 'lavadora': ell(0, 0, Math.min(hw, hd) * 0.64, Math.min(hw, hd) * 0.64); break;
      case 'inodoro': box(0, hd - 0.1, o.w * 0.95, 0.2); ell(0, -0.06, o.w * 0.45, o.d * 0.3); break;
      case 'lavamanos': ell(0, 0, o.w * 0.38, o.d * 0.32); break;
      case 'ducha': ln(-hw, -hd, hw, hd); ell(0, 0, 0.05, 0.05); break;
      case 'banera': box(0, 0, o.w - 0.16, o.d - 0.16); ell(-hw + 0.22, 0, 0.04, 0.04); break;
      case 'carro': box(0, -o.d * 0.04, o.w - 0.3, o.d * 0.44); ln(-hw + 0.05, o.d * 0.28, hw - 0.05, o.d * 0.28);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { box(q[0] * (hw + 0.0), q[1] * o.d * 0.31, 0.2, 0.62); }); break;
      case 'estante': box(0, 0, o.w - 0.1, o.d - 0.1); break;
      case 'mesa-noche': box(0, 0, o.w - 0.06, o.d - 0.06); ell(0, 0, Math.min(hw, hd) * 0.42, Math.min(hw, hd) * 0.42); break;
      case 'cama-full': box(-o.w / 4, hd - 0.3, o.w / 2 - 0.1, 0.4); box(o.w / 4, hd - 0.3, o.w / 2 - 0.1, 0.4); ln(-hw, hd - 0.75, hw, hd - 0.75); break;
      case 'litera': box(0, hd - 0.3, o.w - 0.2, 0.4); ln(-hw, -hd, hw, hd); ln(-hw, hd - 0.75, hw, hd - 0.75); break;
      case 'cuna': box(0, 0, o.w - 0.08, o.d - 0.08); break;
      case 'tocador': ln(-o.w * 0.3, hd - 0.03, o.w * 0.3, hd - 0.03); box(0, 0, o.w - 0.1, o.d - 0.1); break;
      case 'banco-cama': case 'banco': ln(-hw + 0.08, -hd, -hw + 0.08, hd); ln(hw - 0.08, -hd, hw - 0.08, hd); break;
      case 'cuadro': case 'cuadro-chico': case 'espejo': case 'tv-pared':
        ctx.lineWidth = lw * 1.4 / sc; ln(-hw, -hd, hw, -hd); break;
      case 'repisa': ln(-hw, 0, hw, 0); break;
      case 'cortina': for (var cx = -hw + 0.1; cx < hw; cx += 0.2) { ctx.beginPath(); ctx.arc(cx, 0, 0.1, Math.PI, 0, false); ctx.stroke(); } break;
      case 'alfombra': box(0, 0, o.w - 0.16, o.d - 0.16); for (var fx = -hw + 0.1; fx < hw; fx += 0.15) { ln(fx, -hd, fx, -hd - 0.06); ln(fx, hd, fx, hd + 0.06); } break;
      case 'alfombra-redonda': ell(0, 0, hw - 0.1, hd - 0.1); break;
      case 'planta': for (var pa = 0; pa < 6; pa++) { var an = pa * Math.PI / 3; ctx.beginPath(); ctx.ellipse(Math.cos(an) * hw * 0.45, Math.sin(an) * hd * 0.45, hw * 0.42, hd * 0.18, an, 0, Math.PI * 2); ctx.stroke(); } break;
      case 'lampara-pie': ell(0, 0, hw * 0.4, hd * 0.4); ln(-hw * 0.7, 0, hw * 0.7, 0); ln(0, -hd * 0.7, 0, hd * 0.7); break;
      case 'ventilador': ell(0, 0, 0.1, 0.1); ln(-hw, 0, hw, 0); ln(0, -hd, 0, hd); break;
      case 'sofa-l': {
        var ar = 0.92;
        ctx.beginPath(); ctx.moveTo(-hw, hd); ctx.lineTo(hw, hd); ctx.lineTo(hw, hd - ar); ctx.lineTo(-hw + ar, hd - ar); ctx.lineTo(-hw + ar, -hd); ctx.lineTo(-hw, -hd); ctx.closePath(); ctx.stroke();
        ln(-hw + 0.2, hd - 0.2, hw, hd - 0.2); ln(-hw + 0.2, hd - 0.2, -hw + 0.2, -hd); break;
      }
      case 'librero': for (var lb = 1; lb < 3; lb++) ln(-hw + lb * o.w / 3, -hd, -hw + lb * o.w / 3, hd); ln(-hw, hd - 0.02, hw, hd - 0.02); break;
      case 'mesa-auxiliar': box(0, 0, o.w - 0.08, o.d - 0.08); break;
      case 'puff': ell(0, 0, hw * 0.75, hd * 0.75); break;
      case 'mesa-redonda': ell(0, 0, hw * 0.86, hd * 0.86); break;
      case 'taburete': ell(0, 0, hw * 0.6, hd * 0.6); break;
      case 'isla': box(0, 0, o.w - 0.1, o.d - 0.1); break;
      case 'lavavajillas': ln(-hw, -hd + 0.08, hw, -hd + 0.08); ln(-hw, -hd, hw, hd); break;
      case 'lavamanos-doble': ell(-o.w / 4, -0.02, o.w * 0.14, o.d * 0.25); ell(o.w / 4, -0.02, o.w * 0.14, o.d * 0.25); break;
      case 'silla-oficina': ell(0, -0.02, hw * 0.8, hd * 0.7); ln(-hw * 0.75, hd - 0.06, hw * 0.75, hd - 0.06); break;
      case 'archivador': for (var ai = 1; ai < 4; ai++) ln(-hw, -hd + ai * o.d / 4, hw, -hd + ai * o.d / 4); break;
      case 'moto': ell(0, -o.d * 0.35, 0.06, 0.3); ell(0, o.d * 0.35, 0.06, 0.3); box(0, 0, o.w * 0.5, o.d * 0.6); ln(-hw, o.d * 0.3, hw, o.d * 0.3); break;
      case 'parrilla': box(0, 0, o.w - 0.1, o.d - 0.1); for (var gi = 1; gi < 6; gi++) ln(-hw + 0.05 + gi * (o.w - 0.1) / 6, -hd + 0.05, -hw + 0.05 + gi * (o.w - 0.1) / 6, hd - 0.05); break;
      case 'escalera': {
        var n = Math.max(3, Math.round(o.d / 0.28));
        for (var i = 1; i < n; i++) ln(-hw, -hd + i * o.d / n, hw, -hd + i * o.d / n);
        ctx.lineWidth = lw / sc;
        ln(0, -hd + 0.18, 0, hd - 0.22); ln(0, hd - 0.22, -0.12, hd - 0.46); ln(0, hd - 0.22, 0.12, hd - 0.46);
        break;
      }
      default: break;
    }
    ctx.restore();
    if (label) {
      var item = F.get(o.kind), text = o.kind === 'escalera' ? 'Sube' : (item ? item.name : '');
      var ar = (o.ang || 0) * Math.PI / 180, ca = Math.abs(Math.cos(ar)), sa = Math.abs(Math.sin(ar));
      var bw = (o.w * ca + o.d * sa) * sc, bh = (o.w * sa + o.d * ca) * sc;
      if (text && bh >= 16) {
        ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (ctx.measureText(text).width <= bw - 8) {
          ctx.lineWidth = 3; ctx.strokeStyle = colors.canvas; ctx.fillStyle = colors.muted;
          ctx.strokeText(text, c[0], c[1]); ctx.fillText(text, c[0], c[1]);
        }
      }
    }
  }

  /** Lo que hay en el piso de abajo se ve tenue como referencia; los huecos de escalera se marcan. */
  function drawBelow(map) {
    var idx = levelIndex(doc.level);
    if (idx < 1) return;
    var below = doc.levels[idx - 1].id;
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = colors.muted; ctx.strokeStyle = colors.muted;
    doc.objects.forEach(function (o) {
      if (o.lv !== below || o.type !== 'wall' || !layerShown(o)) return;
      var info = G.wallInfo(o);
      if (info.L < 1e-9) return;
      pathPoly(quad(o.a, o.b, o.t, true, true), true); ctx.fill();
    });
    ctx.restore();
    doc.objects.forEach(function (o) {
      if (o.lv !== below || o.type !== 'furn' || o.kind !== 'escalera' || !layerShown(o)) return;
      ctx.save();
      ctx.setLineDash([6, 4]);
      drawFurn(o, colors.muted, 1.2, false);
      var c = w2s(o.p);
      ctx.setLineDash([]); ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.muted; ctx.fillText('Baja', c[0], c[1]);
      ctx.restore();
    });
  }

  /* ---------- cuartos ---------- */
  /** Cuartos cerrados del piso que se edita. Se recalcula solo cuando cambian las paredes. */
  function levelRooms() {
    var walls = doc.objects.filter(function (o) { return o.type === 'wall' && isVisible(o); });
    if (!walls.length) { roomCache = { key: '', mask: null }; return null; }
    var key = doc.level + '|' + walls.map(function (w) { return w.a[0].toFixed(4) + ',' + w.a[1].toFixed(4) + ',' + w.b[0].toFixed(4) + ',' + w.b[1].toFixed(4) + ',' + w.t.toFixed(4); }).join(';');
    if (key !== roomCache.key && !(ptr && ptr.mode === 'move' && roomCache.mask)) {
      roomCache = { key: key, mask: M3.floorMask(walls, {}) };
    }
    return roomCache.mask && roomCache.mask.ok ? roomCache.mask : null;
  }

  function drawLabel(lines, sx, sy) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    var lh = 15, y0 = sy - (lines.length - 1) * lh / 2;
    lines.forEach(function (ln, i) {
      ctx.font = ln.bold ? '600 12.5px system-ui, sans-serif' : '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.lineWidth = 4; ctx.strokeStyle = colors.canvas;
      ctx.strokeText(ln.text, sx, y0 + i * lh);
      ctx.fillStyle = ln.bold ? colors.text : colors.muted;
      ctx.fillText(ln.text, sx, y0 + i * lh);
    });
  }

  function drawRoomLabels() {
    if (!showAreas && !doc.objects.some(function (o) { return o.type === 'room' && isVisible(o); })) return;
    var mk = levelRooms();
    var named = doc.objects.filter(function (o) { return o.type === 'room' && isVisible(o); });
    var taken = {};
    named.forEach(function (o) {
      var r = mk ? M3.roomAt(mk, o.p[0], o.p[1]) : null;
      if (r) taken[r.id] = true;
      var s = w2s(o.p);
      if (s[0] < -80 || s[0] > W + 80 || s[1] < -40 || s[1] > H + 40) return;
      var lines = [{ text: o.name, bold: true }];
      if (r && showAreas) lines.push({ text: U.formatArea(r.area, units) });
      drawLabel(lines, s[0], s[1] + 12);
    });
    if (!showAreas || !mk) return;
    mk.rooms.forEach(function (r) {
      if (taken[r.id] || Math.sqrt(r.area) * view.scale < 46) return;
      var pt = M3.roomAt(mk, r.cx, r.cy) === r ? [r.cx, r.cy] : [r.x, r.y];
      var s = w2s(pt);
      if (s[0] < -80 || s[0] > W + 80 || s[1] < -40 || s[1] > H + 40) return;
      drawLabel([{ text: U.formatArea(r.area, units) }], s[0], s[1]);
    });
  }

  function drawWall(w, openings, sel, col) {
    var info = G.wallInfo(w);
    if (info.L < 1e-9) return;
    G.solidRanges(w, openings).forEach(function (r) {
      var a = G.add(info.a, G.mul(info.u, r[0])), b = G.add(info.a, G.mul(info.u, r[1]));
      var q = quad(a, b, w.t, r[0] <= 1e-9, r[1] >= info.L - 1e-9);
      pathPoly(q, true);
      if (sel) { ctx.lineWidth = 2.2; ctx.stroke(); } else { ctx.fill(); }
    });
  }

  function drawOpening(o, map, col, sel) {
    var wall = map[o.wall];
    if (!wall) return;
    var g = G.openingGeom(o, wall);
    var h = g.t / 2, n = G.perp(g.u);
    ctx.lineWidth = sel ? 2.4 : 1.5;
    // jambas
    [g.p0, g.p1].forEach(function (p) {
      pathPoly([G.add(p, G.mul(n, h)), G.add(p, G.mul(n, -h))], false); ctx.stroke();
    });
    if (o.type === 'window') {
      [h, 0, -h].forEach(function (k, i) {
        ctx.lineWidth = i === 1 ? (sel ? 1.6 : 1) : (sel ? 2.4 : 1.5);
        pathPoly([G.add(g.p0, G.mul(n, k)), G.add(g.p1, G.mul(n, k))], false); ctx.stroke();
      });
      return;
    }
    if (o.roll) {                       // portón enrollable: línea punteada, sin arco de giro
      ctx.save(); ctx.setLineDash([9, 5]); ctx.lineWidth = sel ? 2.4 : 1.6;
      pathPoly([g.p0, g.p1], false); ctx.stroke();
      ctx.restore();
      return;
    }
    // puerta: hoja abierta 90° y arco de giro
    var leafEnd = G.add(g.p0, G.mul(g.n, o.w));
    ctx.lineWidth = sel ? 2.8 : 2;
    pathPoly([g.p0, leafEnd], false); ctx.stroke();
    var S = w2s(g.p0), S1 = w2s(leafEnd), S2 = w2s(g.p1);
    var a1 = Math.atan2(S2[1] - S[1], S2[0] - S[0]);
    var a2 = Math.atan2(S1[1] - S[1], S1[0] - S[0]);
    var diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    ctx.lineWidth = sel ? 1.8 : 1;
    ctx.beginPath(); ctx.arc(S[0], S[1], o.w * view.scale, a1, a2, diff < 0); ctx.stroke();
  }

  function drawTag(text, sx, sy, accent) {
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    var w = ctx.measureText(text).width + 14, h = 22;
    var x = Math.min(Math.max(6, sx + 16), W - w - 6), y = Math.min(Math.max(6, sy + 16), H - h - 6);
    ctx.fillStyle = colors.panel; ctx.strokeStyle = accent ? colors.accent : colors.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(x + 0.5, y + 0.5, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.text; ctx.fillText(text, x + 7, y + h / 2 + 0.5);
  }

  function drawDim(d, col, sel) {
    var g = G.dimGeom(d);
    if (g.length < 1e-9) return;
    var A = w2s(d.a), B = w2s(d.b), A2 = w2s(g.a2), B2 = w2s(g.b2);
    var ux = B2[0] - A2[0], uy = B2[1] - A2[1], ul = Math.hypot(ux, uy) || 1;
    ux /= ul; uy /= ul;
    var sgn = d.off >= 0 ? 1 : -1;
    var over = 6 * sgn;
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeStyle = col;
    // líneas de extensión
    [[A, A2], [B, B2]].forEach(function (pair) {
      var vx = pair[1][0] - pair[0][0], vy = pair[1][1] - pair[0][1], vl = Math.hypot(vx, vy) || 1;
      ctx.beginPath();
      ctx.moveTo(pair[0][0] + vx / vl * 4, pair[0][1] + vy / vl * 4);
      ctx.lineTo(pair[1][0] + vx / vl * Math.abs(over), pair[1][1] + vy / vl * Math.abs(over));
      ctx.stroke();
    });
    // línea de cota y marcas a 45°
    ctx.beginPath(); ctx.moveTo(A2[0], A2[1]); ctx.lineTo(B2[0], B2[1]); ctx.stroke();
    var tx = (ux - uy) * 0.7071 * 6, ty = (uy + ux) * 0.7071 * 6;
    ctx.lineWidth = sel ? 2.2 : 1.4;
    [A2, B2].forEach(function (p) { ctx.beginPath(); ctx.moveTo(p[0] - tx, p[1] - ty); ctx.lineTo(p[0] + tx, p[1] + ty); ctx.stroke(); });
    // texto
    if (ul < 24) return;
    var ang = Math.atan2(B2[1] - A2[1], B2[0] - A2[0]);
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    ctx.save();
    ctx.translate((A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2);
    ctx.rotate(ang);
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4; ctx.strokeStyle = colors.canvas; ctx.lineJoin = 'round';
    var label = fmt(g.length);
    ctx.strokeText(label, 0, -4);
    ctx.fillStyle = sel ? colors.sel : col;
    ctx.fillText(label, 0, -4);
    ctx.restore();
  }

  function drawDraft(map) {
    var p = mouse.p;
    ctx.setLineDash([]);
    if (tool === 'furn') {
      if (!mouse.over && !ptr) return;
      var fp = furnPreview();
      if (fp) {
        drawFurn(fp, colors.accent, 1.8, true, true);
        if (fp.aligned) { var fs = w2s(fp.p); drawTag('Pegado a la pared', fs[0], fs[1], true); }
      }
      return;
    }
    if (tool === 'door' || tool === 'window') {
      if (!mouse.over && !ptr) return;
      var pl = openingPlacement();
      if (pl) {
        var temp = { type: tool, wall: pl.wall.id, pos: pl.pos, w: tool === 'door' ? settings.doorW : settings.winW, flip: pl.flip, layer: 'aberturas' };
        drawOpening(temp, map, colors.accent, true);
      }
      return;
    }
    if (!draft) return;
    var pts = draft.pts, last = pts[pts.length - 1], S, S2;
    ctx.strokeStyle = colors.accent; ctx.fillStyle = colors.accent; ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    function dot(q) { var s = w2s(q); ctx.beginPath(); ctx.arc(s[0], s[1], 3.5, 0, Math.PI * 2); ctx.fill(); }

    if (draft.tool === 'line' || draft.tool === 'wall' || draft.tool === 'polyline') {
      if (draft.tool === 'polyline' && pts.length > 1) { pathPoly(pts, false); ctx.stroke(); }
      var dirLen = G.dist(last, p);
      if (draft.tool === 'wall') {
        if (dirLen > 1e-9) {
          pathPoly(quad(last, p, settings.wallT, true, true), true);
          ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1.2; ctx.stroke();
        }
      } else {
        ctx.setLineDash([6, 5]); pathPoly([last, p], false); ctx.stroke(); ctx.setLineDash([]);
      }
      if (mouse.polar !== null) {
        var g0 = w2s(last), pr = mouse.polar * Math.PI / 180;
        ctx.save(); ctx.globalAlpha = 0.45; ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g0[0] - Math.cos(pr) * 4000, g0[1] + Math.sin(pr) * 4000);
        ctx.lineTo(g0[0] + Math.cos(pr) * 4000, g0[1] - Math.sin(pr) * 4000);
        ctx.stroke(); ctx.restore();
      }
      pts.forEach(dot);
      if (dirLen > 1e-9) {
        var ang = Math.atan2(p[1] - last[1], p[0] - last[0]) * 180 / Math.PI;
        if (ang < 0) ang += 360;
        S = w2s(p);
        drawTag(lenTag(dirLen) + '  ∠ ' + (Math.round(ang * 10) / 10) + '°' + (mouse.polar !== null ? (mouse.polarSrc ? '  ' + mouse.polarSrc : '  polar') : ''), S[0], S[1], true);
      }
    } else if (draft.tool === 'rect') {
      var rc = G.rectCorners({ a: last, b: p });
      pathPoly(rc, true); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      dot(last);
      S = w2s(p);
      drawTag(fmt(Math.abs(p[0] - last[0])) + ' × ' + fmt(Math.abs(p[1] - last[1])), S[0], S[1], true);
    } else if (draft.tool === 'circle') {
      var r = G.dist(last, p);
      S = w2s(last);
      ctx.beginPath(); ctx.arc(S[0], S[1], Math.max(0.5, r * view.scale), 0, Math.PI * 2); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      pathPoly([last, p], false); ctx.stroke(); dot(last);
      S2 = w2s(p);
      drawTag('R ' + lenTag(r), S2[0], S2[1], true);
    } else if (draft.tool === 'dim') {
      if (pts.length === 1) {
        ctx.setLineDash([6, 5]); pathPoly([last, p], false); ctx.stroke(); ctx.setLineDash([]); dot(last);
        S = w2s(p); drawTag(lenTag(G.dist(last, p)), S[0], S[1], true);
      } else {
        var a = pts[0], b = pts[1];
        var n = G.perp(G.norm(G.sub(b, a)));
        var off = G.dot(G.sub(p, a), n);
        drawDim({ a: a, b: b, off: off, type: 'dim', layer: 'cotas' }, colors.accent, false);
      }
    }
  }

  function drawBox() {
    if (!boxRect) return;
    var x = Math.min(boxRect.x0, boxRect.x1), y = Math.min(boxRect.y0, boxRect.y1);
    var w = Math.abs(boxRect.x1 - boxRect.x0), h = Math.abs(boxRect.y1 - boxRect.y0);
    var crossing = boxRect.x1 < boxRect.x0;
    ctx.save();
    ctx.fillStyle = colors.sel; ctx.globalAlpha = 0.1; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.sel; ctx.lineWidth = 1; ctx.setLineDash(crossing ? [5, 4] : []);
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.restore();
  }

  function drawSnapMarker() {
    if (!(mouse.over || ptr) || ptr && (ptr.mode === 'pan' || ptr.mode === 'box')) return;
    if (tool === 'select' || tool === 'pan' || tool === 'door' || tool === 'window' || tool === 'furn' || tool === 'room' || tool === 'text') return;
    if (!snapOn && !draft) return;
    var s = w2s(mouse.p), k = mouse.snap.kind;
    ctx.strokeStyle = colors.accent; ctx.fillStyle = colors.accent; ctx.lineWidth = 1.8; ctx.setLineDash([]);
    if (k === 'end') { ctx.strokeRect(s[0] - 6, s[1] - 6, 12, 12); }
    else if (k === 'edge') { ctx.beginPath(); ctx.moveTo(s[0], s[1] - 7); ctx.lineTo(s[0] + 7, s[1]); ctx.lineTo(s[0], s[1] + 7); ctx.lineTo(s[0] - 7, s[1]); ctx.closePath(); ctx.stroke(); }
    else if (k === 'mid') { ctx.beginPath(); ctx.moveTo(s[0], s[1] - 7); ctx.lineTo(s[0] + 7, s[1] + 5); ctx.lineTo(s[0] - 7, s[1] + 5); ctx.closePath(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(s[0] - 5, s[1]); ctx.lineTo(s[0] + 5, s[1]); ctx.moveTo(s[0], s[1] - 5); ctx.lineTo(s[0], s[1] + 5); ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  /* ------------------------------------------------------------------ */
  /* Cursor, enganche y selección                                        */
  /* ------------------------------------------------------------------ */
  function lastDraftPoint() {
    if (!draft || !draft.pts.length) return null;
    return draft.pts[draft.pts.length - 1];
  }

  function snapTargets() {
    var skipSel = ptr && ptr.mode === 'move';
    return doc.objects.filter(function (o) {
      return isVisible(o) && !(skipSel && selection.has(o.id));
    });
  }

  function updateCursor(sx, sy, shift) {
    mouse.sx = sx; mouse.sy = sy;
    mouse.raw = s2w(sx, sy);
    var s, iso = isoOn(), isoD = D.isoDirs(doc.paper.isoAng);
    if (snapOn) s = G.findSnap(mouse.raw, snapTargets(), { tol: SNAP_PX / view.scale, grid: snapStep(), useGrid: !clase() });
    else s = { p: mouse.raw.slice(), kind: 'free' };
    if (snapOn && clase() && s.kind === 'free') s = { p: paperSnap(mouse.raw), kind: 'grid' };
    var drawTool = DRAW_TOOLS.indexOf(tool) >= 0 && tool !== 'door' && tool !== 'window';
    // canto de una escuadra: el punto se pega al borde, como el lápiz contra la regla
    if (drawTool && s.kind !== 'end' && s.kind !== 'mid') {
      var es = D.snapToEdges(mouse.raw, instEdges(), SNAP_PX / view.scale);
      if (es) s = { p: es.p, kind: 'edge' };
    }
    var p = s.p;
    var last = lastDraftPoint();
    var ortho = orthoOn !== !!shift;
    var lineTool = tool === 'line' || tool === 'wall' || tool === 'polyline';
    mouse.polar = null; mouse.polarSrc = '';
    var guideDirs = (iso ? isoD.slice() : []).concat(D.edgeDirs(instEdges()));
    var cd = null;
    if (!ortho && last && lineTool && s.kind !== 'end' && s.kind !== 'mid' && guideDirs.length) cd = D.constrainDir(last, mouse.raw, guideDirs, 4);
    if (s.kind === 'edge') {
      /* ya está sobre el canto */
    } else if (ortho && last && lineTool && s.kind !== 'end' && s.kind !== 'mid') {
      p = iso && doc.paper.gridType === 'iso' ? D.constrainDir(last, p, isoD, null).p : G.orthoPoint(last, p);
    } else if (cd) {
      var stp = snapOn ? snapStep() : 0, dl = stp > 0 ? Math.round(cd.len / stp) * stp : cd.len, ra = cd.ang * Math.PI / 180;
      p = [last[0] + Math.cos(ra) * dl, last[1] + Math.sin(ra) * dl];
      mouse.polar = cd.ang; mouse.polarSrc = iso && isoD.some(function (a) { return Math.abs((cd.ang % 180) - a) < 0.01; }) ? 'isométrico' : 'escuadra';
    } else if (polarInc > 0 && last && lineTool && s.kind !== 'end' && s.kind !== 'mid') {
      // ángulo polar: se engancha cuando el cursor está a menos de 6° de un múltiplo del ángulo elegido
      var v = G.sub(mouse.raw, last), L = G.len(v);
      if (L > 1e-9) {
        var inc = polarInc * Math.PI / 180, ang = Math.atan2(v[1], v[0]);
        var a2 = Math.round(ang / inc) * inc;
        if (Math.abs(ang - a2) <= 6 * Math.PI / 180) {
          var st = snapOn ? snapStep() : 0;
          var d = st > 0 ? Math.max(st, Math.round(L / st) * st) : L;
          p = [last[0] + Math.cos(a2) * d, last[1] + Math.sin(a2) * d];
          mouse.polar = ((a2 * 180 / Math.PI) % 360 + 360) % 360;
        }
      }
    }
    mouse.p = p; mouse.snap = s;
    updateReadout();
  }

  function pickAt(sx, sy) {
    var p = s2w(sx, sy), tol = PICK_PX / view.scale, map = idMap(), best = null, bestD = Infinity;
    for (var i = doc.objects.length - 1; i >= 0; i--) {
      var o = doc.objects[i];
      if (!isVisible(o) || isLocked(o)) continue;
      var d = G.distToObject(p, o, map);
      if (o.type === 'door' || o.type === 'window' || o.type === 'dim') d -= 1e-7;
      if (d <= tol && d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Crear y editar objetos                                              */
  /* ------------------------------------------------------------------ */
  function layerFor(type) {
    switch (type) {
      case 'wall': return 'paredes';
      case 'door': case 'window': return 'aberturas';
      case 'dim': return 'cotas';
      case 'furn': return 'muebles';
      case 'room': return 'cuartos';
      default: return doc.activeLayer;
    }
  }
  function layerOk(id) {
    var l = layerById(id);
    if (!l) { toast('Esa capa ya no existe.'); return false; }
    if (l.locked) { toast('La capa "' + l.name + '" está bloqueada.'); return false; }
    if (!l.visible) { toast('La capa "' + l.name + '" está oculta.'); return false; }
    return true;
  }

  function createObj(type, props) {
    var o = { id: doc.nextId++, type: type, layer: layerFor(type), lv: doc.level };
    Object.keys(props).forEach(function (k) { o[k] = props[k]; });
    if (clase() && PEN_TYPES.indexOf(type) >= 0) { o.pen = pen.type; o.lead = pen.lead; }
    doc.objects.push(o);
    commit();
    return o;
  }

  function addPoint(p) {
    var needLayer = layerFor(tool);
    if (!layerOk(needLayer)) return;
    if (!draft) {
      draft = { tool: tool, pts: [p], start: p.slice(), count: 0 };
      uiSync(); requestRender();
      return;
    }
    var last = lastDraftPoint();
    if (G.dist(p, last) < 1e-9) { finishDraft(); return; }

    switch (draft.tool) {
      case 'line':
      case 'wall': {
        var closing = draft.count >= 2 && G.dist(p, draft.start) < 1e-9;
        if (draft.tool === 'line') createObj('line', { a: last.slice(), b: p.slice() });
        else createObj('wall', { a: last.slice(), b: p.slice(), t: settings.wallT });
        draft.count++;
        if (closing) { draft = null; } else { draft.pts = [p]; }
        break;
      }
      case 'polyline':
        if (draft.pts.length >= 3 && G.dist(p, draft.pts[0]) < 1e-9) {
          createObj('polyline', { pts: draft.pts.map(function (q) { return q.slice(); }), closed: true });
          draft = null;
        } else { draft.pts.push(p); }
        break;
      case 'rect':
        if (Math.abs(p[0] - last[0]) < 1e-9 || Math.abs(p[1] - last[1]) < 1e-9) { toast('El rectángulo necesita ancho y alto.'); return; }
        createObj('rect', { a: last.slice(), b: p.slice() });
        draft = null;
        break;
      case 'circle':
        createObj('circle', { c: last.slice(), r: G.dist(last, p) });
        draft = null;
        break;
      case 'dim':
        if (draft.pts.length === 1) { draft.pts.push(p); }
        else {
          var a = draft.pts[0], b = draft.pts[1];
          var off = G.dot(G.sub(p, a), G.perp(G.norm(G.sub(b, a))));
          if (Math.abs(off) < 1e-6) off = 0.3;
          createObj('dim', { a: a.slice(), b: b.slice(), off: off });
          draft = null;
        }
        break;
      default: break;
    }
    uiSync(); requestRender();
  }

  function finishDraft() {
    if (!draft) return;
    if (draft.tool === 'polyline' && draft.pts.length >= 2) {
      createObj('polyline', { pts: draft.pts.map(function (q) { return q.slice(); }), closed: false });
    }
    draft = null;
    uiSync(); requestRender();
  }
  function cancelDraft() { draft = null; uiSync(); requestRender(); }

  function openingPlacement() {
    var walls = doc.objects.filter(function (o) { return o.type === 'wall' && isVisible(o); });
    var width = tool === 'door' ? settings.doorW : settings.winW;
    var pl = G.placeOnWall(mouse.raw, walls, width, 18 / view.scale);
    if (!pl) return null;
    var lo = pl.pos - width / 2, hi = pl.pos + width / 2;
    var clash = doc.objects.some(function (o) {
      return (o.type === 'door' || o.type === 'window') && o.wall === pl.wall.id && lo < o.pos + o.w / 2 - 1e-9 && hi > o.pos - o.w / 2 + 1e-9;
    });
    pl.clash = clash;
    return clash ? null : pl;
  }

  function placeOpening() {
    if (!layerOk('aberturas')) return;
    var pl = openingPlacement();
    if (!pl) { toast('Acerca el cursor a una pared libre.'); return; }
    createObj(tool, { wall: pl.wall.id, pos: pl.pos, w: tool === 'door' ? settings.doorW : settings.winW, flip: pl.flip });
  }

  function furnPreview() {
    var item = F.get(furnKind);
    if (!item) return null;
    var o = { type: 'furn', kind: furnKind, p: mouse.p.slice(), w: item.w, d: item.d, ang: furnRot, aligned: false };
    if (furnAlign && item.wall && furnRot === 0 && snapOn) {
      var walls = doc.objects.filter(function (q) { return q.type === 'wall' && isVisible(q); });
      var a = F.alignToWall(mouse.raw, item.w, item.d, walls, 0.45);
      if (a) { o.p = a.p; o.ang = a.ang; o.aligned = true; }
    }
    return o;
  }

  function placeFurn() {
    ensureLayer('muebles');
    if (!layerOk('muebles')) return;
    var f = furnPreview();
    if (!f) return;
    var o = createObj('furn', { kind: f.kind, p: f.p, w: f.w, d: f.d, ang: f.ang });
    if (f.kind === 'escalera' && levelIndex(doc.level) >= doc.levels.length - 1) toast('La escalera sube al piso de arriba. Añade un piso con + Piso.');
    return o;
  }

  function placeRoom() {
    ensureLayer('cuartos');
    if (!layerOk('cuartos')) return;
    var mk = levelRooms();
    var r = mk ? M3.roomAt(mk, mouse.raw[0], mouse.raw[1]) : null;
    if (!r) { toast('Toca dentro de un cuarto cerrado por paredes.'); return; }
    var here = doc.objects.filter(function (o) { return o.type === 'room' && isVisible(o); });
    var existing = here.filter(function (o) { return M3.roomAt(mk, o.p[0], o.p[1]) === r; })[0];
    if (existing) { setTool('select'); selection.add(existing.id); uiSync(); requestRender(); toast('Ese cuarto ya tiene nombre. Cámbialo en Propiedades.'); return; }
    var at = mouse.raw.slice(), def = 'Cuarto ' + (here.length + 1);
    ask('Nombre del cuarto', U.formatArea(r.area, units), { input: true, value: def, ok: 'Poner nombre' }).then(function (name) {
      if (name === null) return;
      createObj('room', { p: at, name: name || def });
    });
  }

  function placeText() {
    var at = mouse.p.slice();
    if (!layerOk(doc.activeLayer)) return;
    ask('Texto', clase() ? 'Se escribe en letra de plano. Altura: ' + U.formatFtIn(textIn * IN_M, 32) + ' en el papel.' : '', { input: true, ok: 'Poner' }).then(function (txt) {
      if (!txt) return;
      var h = clase() ? textIn * paperU() : 12 / view.scale;
      var props = { p: at, text: txt.slice(0, 200), h: h };
      if (clase()) props.lead = textIn >= 3 / 16 ? 'HB' : 'F';
      createObj('text', props);
    });
  }
  function placeAt() {
    if (tool === 'text') { placeText(); return; }
    if (tool === 'furn') placeFurn();
    else if (tool === 'room') placeRoom();
    else if (tool === 'door' || tool === 'window') placeOpening();
    else if (DRAW_TOOLS.indexOf(tool) >= 0) addPoint(mouse.p.slice());
  }

  /* acciones sobre la selección */
  function selectedObjects() { var m = idMap(); return Array.from(selection).map(function (id) { return m[id]; }).filter(Boolean); }

  function deleteSelection() {
    if (!selection.size) return;
    var gone = {};
    selection.forEach(function (id) { gone[id] = true; });
    doc.objects.forEach(function (o) { if (gone[o.id] && o.type === 'wall') gone['w' + o.id] = true; });
    doc.objects = doc.objects.filter(function (o) {
      if (gone[o.id]) return false;
      if ((o.type === 'door' || o.type === 'window') && gone['w' + o.wall]) return false;
      return true;
    });
    selection.clear();
    commit();
  }

  function duplicateSelection() {
    var src = selectedObjects().filter(function (o) { return o.type !== 'door' && o.type !== 'window'; });
    if (!src.length) { toast('Elige algo para duplicar.'); return; }
    var off = 0.3048, newSel = new Set(), idMapOld = {};
    src.forEach(function (o) {
      var c = clone(o); c.id = doc.nextId++;
      G.translateObj(c, off, -off);
      idMapOld[o.id] = c.id;
      doc.objects.push(c); newSel.add(c.id);
    });
    doc.objects.slice().forEach(function (o) {
      if ((o.type === 'door' || o.type === 'window') && idMapOld[o.wall]) {
        var c = clone(o); c.id = doc.nextId++; c.wall = idMapOld[o.wall];
        doc.objects.push(c);
      }
    });
    selection = newSel;
    commit();
  }

  function selectionCenter(list) {
    var map = idMap(), minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    list.forEach(function (o) {
      var b = G.bboxOf(o, map); if (!b) return;
      minx = Math.min(minx, b.minx); miny = Math.min(miny, b.miny); maxx = Math.max(maxx, b.maxx); maxy = Math.max(maxy, b.maxy);
    });
    return [(minx + maxx) / 2, (miny + maxy) / 2];
  }

  function rotateSelection() {
    var list = selectedObjects().filter(function (o) { return o.type !== 'door' && o.type !== 'window'; });
    if (!list.length) { toast('Elige algo para girar.'); return; }
    var c = selectionCenter(list);
    list.forEach(function (o) { G.rotateObj(o, c, Math.PI / 2); });
    commit();
  }

  /* ------------------------------------------------------------------ */
  /* Vista                                                               */
  /* ------------------------------------------------------------------ */
  function zoomAt(sx, sy, factor) {
    var before = s2w(sx, sy);
    view.scale = G.clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    view.cx = before[0] - (sx - W / 2) / view.scale;
    view.cy = before[1] + (sy - H / 2) / view.scale;
    updateReadout(); requestRender();
  }

  function fitView() {
    if (clase() && mode === '2d') {
      var r = sheetLay().sheet, bar = $('draftbar'), side = W > 700 && !bar.hidden ? bar.offsetWidth + 16 : 0, Wf = W - side;
      view.scale = G.clamp(Math.min(Wf / ((r.x1 - r.x0) * 1.06), H / ((r.y1 - r.y0) * 1.08)), MIN_SCALE, MAX_SCALE);
      view.cx = (r.x0 + r.x1) / 2 + side / 2 / view.scale; view.cy = (r.y0 + r.y1) / 2;
      updateReadout(); requestRender();
      return;
    }
    var map = idMap(), minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    doc.objects.forEach(function (o) {
      if (!isVisible(o)) return;
      var b = G.bboxOf(o, map); if (!b) return;
      minx = Math.min(minx, b.minx); miny = Math.min(miny, b.miny); maxx = Math.max(maxx, b.maxx); maxy = Math.max(maxy, b.maxy);
    });
    if (!isFinite(minx)) { view = { cx: 0, cy: 0, scale: BASE_SCALE }; }
    else {
      var w = Math.max(maxx - minx, 0.5), h = Math.max(maxy - miny, 0.5);
      var pad = 0.18;
      view.scale = G.clamp(Math.min(W / (w * (1 + pad * 2)), H / (h * (1 + pad * 2))), MIN_SCALE, 400);
      view.cx = (minx + maxx) / 2; view.cy = (miny + maxy) / 2;
    }
    updateReadout(); requestRender();
  }

  /* ------------------------------------------------------------------ */
  /* Punteros: mouse, lápiz y dedos                                      */
  /* ------------------------------------------------------------------ */
  function pointerXY(e) {
    var r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function beginGesture() {
    var pts = Array.from(touches.values());
    var a = pts[0], b = pts[1];
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    gesture = { dist: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), scale0: view.scale, world: s2w(mid[0], mid[1]) };
    if (ptr && ptr.mode === 'move' && ptr.moved) { applySnapshot(history[histIdx]); }
    ptr = null; boxRect = null;
    cv.classList.remove('panning');
  }
  function updateGesture() {
    var pts = Array.from(touches.values());
    if (pts.length < 2 || !gesture) return;
    var a = pts[0], b = pts[1];
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var d = Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1]));
    view.scale = G.clamp(gesture.scale0 * d / gesture.dist, MIN_SCALE, MAX_SCALE);
    view.cx = gesture.world[0] - (mid[0] - W / 2) / view.scale;
    view.cy = gesture.world[1] + (mid[1] - H / 2) / view.scale;
    updateReadout(); requestRender();
  }

  cv.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button === 2) return;
    var xy = pointerXY(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    if (e.pointerType === 'touch') { usedTouch = true; touches.set(e.pointerId, xy); }
    if (touches.size === 2) { beginGesture(); return; }
    if (touches.size > 2 || gesture) return;
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();

    mouse.over = true;
    updateCursor(xy[0], xy[1], e.shiftKey);
    ptr = { id: e.pointerId, type: e.pointerType, sx0: xy[0], sy0: xy[1], moved: false, mode: null };

    if (tool === 'pan' || e.button === 1 || spaceDown) {
      ptr.mode = 'pan'; ptr.view0 = { cx: view.cx, cy: view.cy };
      cv.classList.add('panning');
      e.preventDefault();
      return;
    }
    var ih = instHit(xy[0], xy[1]);
    if (ih) {
      ptr.mode = ih.rotate ? 'instRot' : 'inst'; ptr.inst = ih.id; ptr.w0 = s2w(xy[0], xy[1]); ptr.orig = clone(insts[ih.id]);
      if (activeInst !== ih.id) { activeInst = ih.id; renderDraftBar(); }
      e.preventDefault(); requestRender();
      return;
    }
    if (tool === 'select') { selectDown(e); }
    else { ptr.mode = 'tool'; }
    requestRender();
  });

  function selectDown(e) {
    var hit = pickAt(ptr.sx0, ptr.sy0);
    var additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (hit) {
      if (selection.has(hit.id) && additive) { selection.delete(hit.id); ptr.mode = null; uiSync(); return; }
      if (!selection.has(hit.id)) { if (!additive) selection.clear(); selection.add(hit.id); }
      ptr.mode = 'move'; ptr.base = mouse.p.slice(); ptr.orig = null;
    } else {
      if (!additive) selection.clear();
      ptr.mode = 'box'; ptr.additive = additive;
      boxRect = { x0: ptr.sx0, y0: ptr.sy0, x1: ptr.sx0, y1: ptr.sy0 };
    }
    uiSync();
  }

  cv.addEventListener('pointermove', function (e) {
    var xy = pointerXY(e);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, xy);
    if (gesture) { updateGesture(); return; }
    mouse.over = true;
    shiftDown = e.shiftKey;
    if (!ptr || ptr.id !== e.pointerId) { updateCursor(xy[0], xy[1], e.shiftKey); requestRender(); return; }

    if (Math.hypot(xy[0] - ptr.sx0, xy[1] - ptr.sy0) > 4) ptr.moved = true;
    if (ptr.mode === 'inst' || ptr.mode === 'instRot') { dragInst(s2w(xy[0], xy[1]), e.shiftKey); requestRender(); return; }
    if (ptr.mode === 'pan') {
      view.cx = ptr.view0.cx - (xy[0] - ptr.sx0) / view.scale;
      view.cy = ptr.view0.cy + (xy[1] - ptr.sy0) / view.scale;
      updateReadout(); requestRender();
      return;
    }
    updateCursor(xy[0], xy[1], e.shiftKey);
    if (ptr.mode === 'box') { boxRect.x1 = xy[0]; boxRect.y1 = xy[1]; }
    else if (ptr.mode === 'move' && ptr.moved) { dragMove(); }
    requestRender();
  });

  /** ¿Tocaron una escuadra? Cerca del canto de trabajo con una herramienta de dibujo se dibuja, no se agarra. */
  function instHit(sx, sy) {
    var list = shownInsts().slice().reverse(), w = s2w(sx, sy);
    var drawTool = DRAW_TOOLS.indexOf(tool) >= 0 && tool !== 'door' && tool !== 'window';
    for (var i = 0; i < list.length; i++) {
      var g = instGeomOf(list[i]);
      if (g.handle) { var H2 = w2s(g.handle); if (Math.hypot(H2[0] - sx, H2[1] - sy) <= 16) return { id: list[i], rotate: true }; }
      if (!D.pointInPoly(w, g.outer)) continue;
      // con lápiz en mano: el canto y el hueco del triángulo son para dibujar
      if (drawTool && (D.snapToEdges(w, g.edges, (SNAP_PX + 4) / view.scale) || (g.hole && D.pointInPoly(w, g.hole)))) return null;
      return { id: list[i], rotate: false };
    }
    return null;
  }
  function dragInst(w, free) {
    var it = insts[ptr.inst], o = ptr.orig, u = paperU();
    var dx = (w[0] - ptr.w0[0]) / u, dy = (w[1] - ptr.w0[1]) / u;
    if (ptr.mode === 'inst') {
      if (it.kind === 'tsq') { it.y = o.y + dy; return; }
      it.p = [o.p[0] + dx, o.p[1] + dy];
      // la escuadra se apoya sola sobre la regla T, como en la mesa
      var t = insts.tsq;
      if (t.on && Math.abs(((it.ang || 0) % 360)) < 1e-6 && Math.abs(it.p[1] - t.y) * paperPx() < 12) it.p[1] = t.y;
      return;
    }
    var piv = instWorld(it).p;
    var a0 = Math.atan2(ptr.w0[1] - piv[1], ptr.w0[0] - piv[0]), a1 = Math.atan2(w[1] - piv[1], w[0] - piv[0]);
    var ang = o.ang + (a1 - a0) * 180 / Math.PI;
    if (!free) ang = Math.round(ang / 15) * 15;
    it.ang = ((ang % 360) + 360) % 360;
  }

  function dragMove() {
    var movable = selectedObjects().filter(function (o) { return o.type !== 'door' && o.type !== 'window'; });
    if (!movable.length) {
      if (!ptr.warned) { ptr.warned = true; toast('Las puertas y ventanas se mueven con su pared.'); }
      return;
    }
    if (!ptr.orig) { ptr.orig = {}; movable.forEach(function (o) { ptr.orig[o.id] = clone(o); }); }
    var dx = mouse.p[0] - ptr.base[0], dy = mouse.p[1] - ptr.base[1];
    doc.objects = doc.objects.map(function (o) {
      if (!ptr.orig[o.id]) return o;
      var c = clone(ptr.orig[o.id]);
      G.translateObj(c, dx, dy);
      return c;
    });
  }

  function endPointer(e, cancelled) {
    var xy = pointerXY(e);
    if (e.pointerType === 'touch') touches.delete(e.pointerId);
    if (gesture) { if (touches.size < 2) gesture = null; ptr = null; return; }
    if (!ptr || ptr.id !== e.pointerId) return;
    var p = ptr; ptr = null;
    cv.classList.remove('panning');
    if (p.mode === 'inst' || p.mode === 'instRot') {
      if (cancelled) insts[p.inst] = p.orig;
      savePrefs(); requestRender();
      return;
    }
    if (cancelled) { boxRect = null; if (p.mode === 'move' && p.orig) applySnapshot(history[histIdx]); requestRender(); return; }

    updateCursor(xy[0], xy[1], e.shiftKey);
    if (p.mode === 'tool') { placeAt(); }
    else if (p.mode === 'move') { if (p.moved && p.orig) commit(); }
    else if (p.mode === 'box') {
      var box = boxRect; boxRect = null;
      if (box && (Math.abs(box.x1 - box.x0) > 4 || Math.abs(box.y1 - box.y0) > 4)) boxSelect(box, p.additive);
    }
    uiSync(); requestRender();
  }
  cv.addEventListener('pointerup', function (e) { endPointer(e, false); });
  cv.addEventListener('pointercancel', function (e) { endPointer(e, true); });
  cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { mouse.over = false; requestRender(); } });

  function boxSelect(box, additive) {
    var a = s2w(Math.min(box.x0, box.x1), Math.max(box.y0, box.y1));
    var b = s2w(Math.max(box.x0, box.x1), Math.min(box.y0, box.y1));
    var crossing = box.x1 < box.x0, map = idMap();
    if (!additive) selection.clear();
    doc.objects.forEach(function (o) {
      if (!isVisible(o) || isLocked(o)) return;
      var bb = G.bboxOf(o, map); if (!bb) return;
      var inside = bb.minx >= a[0] && bb.maxx <= b[0] && bb.miny >= a[1] && bb.maxy <= b[1];
      var touchBox = bb.maxx >= a[0] && bb.minx <= b[0] && bb.maxy >= a[1] && bb.miny <= b[1];
      if (crossing ? touchBox : inside) selection.add(o.id);
    });
  }

  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var xy = pointerXY(e);
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(xy[0], xy[1], Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });

  cv.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    if (draft) finishDraft();
  });

  /* ------------------------------------------------------------------ */
  /* Teclado y entrada de medidas                                        */
  /* ------------------------------------------------------------------ */
  function needsInput() { return tool !== 'select' && tool !== 'pan' && tool !== 'dim' && tool !== 'furn' && tool !== 'room' && tool !== 'text'; }

  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (e.key === 'Shift') { shiftDown = true; updateCursor(mouse.sx, mouse.sy, true); requestRender(); }
    if (typing) {
      if (e.key === 'Escape') {
        if (e.target === cmdInput) { cmdInput.value = ''; if (draft) cancelDraft(); }
        e.target.blur();
      }
      return;
    }
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (mod && k === 'a') { e.preventDefault(); doc.objects.forEach(function (o) { if (isVisible(o) && !isLocked(o)) selection.add(o.id); }); uiSync(); requestRender(); return; }
    if (mod) return;

    if (mode === '3d') {
      if (view3d && view3d.key(e, true)) { e.preventDefault(); return; }
      if (e.key === 'f' || e.key === 'F') { if (view3d) view3d.fit(); }
      else if (e.key === '1') setCam('orbit');
      else if (e.key === '2') setCam('top');
      else if (e.key === '3') setCam('walk');
      return;
    }

    if (e.key === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.classList.add('pan'); } return; }
    if (e.key === 'Escape') {
      if (draft) cancelDraft();
      else if (selection.size) { selection.clear(); uiSync(); requestRender(); }
      else if (tool !== 'select') setTool('select');
      return;
    }
    if (e.key === 'Enter') { if (draft) { e.preventDefault(); finishDraft(); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (selection.size) {
        var st = e.shiftKey ? (units === 'ft' ? IN_M : 0.01) : (snapOn ? snapStep() : (units === 'ft' ? 6 * IN_M : 0.1));
        var mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
        if (nudge(mv[0], mv[1])) { e.preventDefault(); return; }
      }
    }
    if (e.key === 'F3') { e.preventDefault(); toggleSnap(); return; }
    if (e.key === 'F7') { e.preventDefault(); toggleGrid(); return; }
    if (e.key === 'F8') { e.preventDefault(); toggleOrtho(); return; }

    if (tool === 'furn' && k === 'r') { e.preventDefault(); rotateFurnTool(); return; }
    if (needsInput() && /^[0-9.'"<,\-]$/.test(e.key)) { cmdInput.focus(); return; }   // el carácter cae en la casilla
    var t = TOOLS.filter(function (x) { return x !== 'sep' && x.key === k; })[0];
    if (t) { e.preventDefault(); setTool(t.id); }
  });
  window.addEventListener('keyup', function (e) {
    if (view3d && mode === '3d') view3d.key(e, false);
    if (e.key === ' ') { spaceDown = false; cv.classList.remove('pan'); }
    if (e.key === 'Shift') { shiftDown = false; updateCursor(mouse.sx, mouse.sy, false); requestRender(); }
  });

  function parsePoint(text) {
    var parts = text.split(',');
    if (parts.length !== 2) return null;
    var x = U.parseLength(parts[0], units), y = U.parseLength(parts[1], units);
    return (isNaN(x) || isNaN(y)) ? null : [x, y];
  }

  function bad(msg) { toast(msg || 'No entendí esa medida. Prueba con 12\'6", 3.5m o 150cm.'); }

  function runInput(text) {
    var t = text.trim();
    if (!t) { if (draft) finishDraft(); return; }

    if (tool === 'door' || tool === 'window') {
      var wv = U.parseLength(t, units);
      if (isNaN(wv) || wv <= 0.05) return bad();
      if (tool === 'door') settings.doorW = wv; else settings.winW = wv;
      savePrefs(); uiSync(); toast('Ancho: ' + fmt(wv)); requestRender();
      return;
    }
    if (tool === 'select' || tool === 'pan' || tool === 'dim' || tool === 'furn' || tool === 'room') { toast('Elige una herramienta de dibujo para escribir medidas.'); return; }

    var last = lastDraftPoint();
    if (!draft) {
      var pt = parsePoint(t);
      if (!pt) return bad('Para empezar escribe el punto como x,y (ej. 0,0) o toca el lienzo.');
      addPoint(pt);
      return;
    }

    if (tool === 'line' || tool === 'wall' || tool === 'polyline') {
      var len, dir;
      if (t.indexOf('<') >= 0) {
        var bits = t.split('<');
        len = U.parseLength(bits[0], units);
        var deg = parseFloat(bits[1]);
        if (isNaN(len) || isNaN(deg)) return bad();
        dir = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
      } else {
        len = U.parseLength(t, units);
        var v = G.sub(mouse.p, last);
        dir = G.len(v) < 1e-9 ? [1, 0] : G.norm(v);
      }
      if (isNaN(len) || len <= 0) return bad();
      addPoint(G.add(last, G.mul(dir, len)));
    } else if (tool === 'rect') {
      var sz = t.split(',');
      var w = U.parseLength(sz[0], units), h = sz.length > 1 ? U.parseLength(sz[1], units) : w;
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return bad('Escribe ancho,alto (ej. 12\',10\') o un solo número para un cuadrado.');
      var sx = mouse.p[0] >= last[0] ? 1 : -1, sy = mouse.p[1] >= last[1] ? 1 : -1;
      addPoint([last[0] + sx * w, last[1] + sy * h]);
    } else if (tool === 'circle') {
      var r = U.parseLength(t, units);
      if (isNaN(r) || r <= 0) return bad();
      addPoint([last[0] + r, last[1]]);
    }
  }

  $('cmd').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = cmdInput.value;
    cmdInput.value = '';
    runInput(v);
    if (draft) cmdInput.focus(); else cmdInput.blur();
  });

  /* ------------------------------------------------------------------ */
  /* Interfaz                                                            */
  /* ------------------------------------------------------------------ */
  function setTool(id) {
    if (id === 'fit') { fitView(); return; }
    cancelDraftSilently();
    tool = id;
    if (id !== 'select') selection.clear();
    cv.classList.toggle('select', id === 'select');
    cv.classList.toggle('pan', id === 'pan');
    uiSync(); requestRender();
  }
  function cancelDraftSilently() { draft = null; }

  function buildTools() {
    var nav = $('tools');
    TOOLS.forEach(function (t) {
      if (t === 'sep') { nav.appendChild(el('div', { class: 'tool-sep' })); return; }
      var b = el('button', { class: 'tool-btn', type: 'button', 'data-tool': t.id, title: t.name + (t.key ? ' (' + t.key.toUpperCase() + ')' : ''), 'aria-label': t.name, 'aria-pressed': 'false' });
      b.appendChild(svgIcon(t.id, 22));
      b.appendChild(el('span', { text: t.label }));
      b.addEventListener('click', function () { setTool(t.id); });
      nav.appendChild(b);
    });
    $('btn-undo').appendChild(svgIcon('undo', 20));
    $('btn-redo').appendChild(svgIcon('redo', 20));
    $('btn-panel').appendChild(svgIcon('panel', 20));
    document.querySelector('.proj-ico').appendChild(svgIcon('folder', 20));
  }

  function hintText() {
    var s = draft ? draft.pts.length : 0;
    switch (tool) {
      case 'select': return 'Elige un objeto · arrástralo para moverlo';
      case 'pan': return 'Arrastra para mover la vista';
      case 'line': return s ? 'Línea · siguiente punto o escribe el largo' : 'Línea · toca el punto inicial';
      case 'polyline': return s ? 'Polilínea · siguiente punto · Enter termina' : 'Polilínea · toca el punto inicial';
      case 'rect': return s ? 'Rectángulo · otra esquina o escribe ancho,alto' : 'Rectángulo · toca la primera esquina';
      case 'circle': return s ? 'Círculo · toca el radio o escríbelo' : 'Círculo · toca el centro';
      case 'wall': return s ? 'Pared · siguiente punto o escribe el largo' : 'Pared · toca el punto inicial';
      case 'door': return 'Puerta · toca una pared · escribe el ancho';
      case 'window': return 'Ventana · toca una pared · escribe el ancho';
      case 'furn': return 'Mueble · toca para ponerlo · R lo gira';
      case 'room': return 'Cuarto · toca dentro de un cuarto cerrado para ponerle nombre';
      case 'text': return 'Texto · toca donde va la esquina de abajo y escribe';
      case 'dim': return s === 0 ? 'Cota · toca el primer punto' : s === 1 ? 'Cota · toca el segundo punto' : 'Cota · toca para ubicar la línea';
      default: return '';
    }
  }

  function updateReadout() {
    $('coords').textContent = U.formatCoord(mouse.p[0], units) + '  ' + U.formatCoord(mouse.p[1], units);
    $('zoom').textContent = Math.round(view.scale / BASE_SCALE * 100) + '%';
  }

  function refreshOptions() {
    var box = $('options');
    box.textContent = '';
    var showed = false;
    function presetSelect(list, onSet) {
      var sel = el('select', { 'aria-label': 'Medidas comunes' });
      sel.appendChild(el('option', { value: '', text: 'Comunes' }));
      list.forEach(function (it) { sel.appendChild(el('option', { value: String(it[1]), text: it[0] })); });
      sel.addEventListener('change', function () {
        var m = parseFloat(sel.value);
        if (m > 0) { onSet(m); savePrefs(); uiSync(); requestRender(); }
      });
      return sel;
    }
    function field(label, value, onSet, presets) {
      var inp = el('input', { type: 'text', value: value, inputmode: 'text', 'aria-label': label });
      inp.addEventListener('change', function () {
        var m = U.parseLength(inp.value, units);
        if (isNaN(m) || m <= 0.005) { toast('Medida no válida.'); inp.value = value; return; }
        onSet(m); savePrefs(); uiSync(); requestRender();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      box.appendChild(el('label', { class: 'opt' }, [el('span', { class: 'opt-name', text: label }), inp, presets ? presetSelect(presets, onSet) : null]));
      showed = true;
    }
    if (tool === 'wall') field('Espesor', fmt(settings.wallT), function (m) { settings.wallT = m; },
      WALL_PRESETS.map(function (w) { return [w[0] + ' · ' + fmt(w[1]), w[1]]; }));
    if (tool === 'door') field('Ancho de puerta', fmt(settings.doorW), function (m) { settings.doorW = m; },
      DOOR_PRESETS[units].map(function (m) { return [fmt(m), m]; }));
    if (tool === 'window') field('Ancho de ventana', fmt(settings.winW), function (m) { settings.winW = m; },
      WINDOW_PRESETS[units].map(function (m) { return [fmt(m), m]; }));
    if (tool === 'furn') {
      var fsel = el('select', { 'aria-label': 'Mueble' });
      F.cats().forEach(function (cat) {
        var g = el('optgroup', { label: cat });
        F.CATALOG.filter(function (c) { return c.cat === cat; }).forEach(function (c) {
          var op = el('option', { value: c.id, text: c.name }); if (c.id === furnKind) op.selected = true; g.appendChild(op);
        });
        fsel.appendChild(g);
      });
      fsel.addEventListener('change', function () { furnKind = fsel.value; savePrefs(); refreshOptions(); requestRender(); });
      var it = F.get(furnKind);
      var rot = el('button', { class: 'chip-btn', type: 'button', text: furnRot ? 'Girado ' + furnRot + '°' : 'Girar 90°', title: 'Girar (R)' });
      rot.addEventListener('click', rotateFurnTool);
      var al = el('input', { type: 'checkbox', 'aria-label': 'Pegar a la pared' }); al.checked = furnAlign;
      al.addEventListener('change', function () { furnAlign = al.checked; savePrefs(); requestRender(); });
      box.appendChild(el('div', { class: 'opt' }, [
        el('span', { class: 'opt-name', text: 'Mueble' }), fsel,
        el('span', { class: 'opt-dim', text: it ? fmt(it.w) + ' × ' + fmt(it.d) : '' }),
        rot,
        el('label', { class: 'opt-check' }, [al, document.createTextNode(' Pegar a pared')])
      ]));
      showed = true;
    }
    if (clase() && PEN_TYPES.indexOf(tool) >= 0) {
      box.appendChild(el('div', { class: 'opt pencil' }, [el('span', { class: 'opt-name', text: 'Línea' }), penSelect(pen.type, function (v) { pen.type = v; pen.lead = D.penById(v).lead; savePrefs(); refreshOptions(); }),
        el('span', { class: 'opt-name', text: 'Mina' }), leadSelect(pen.lead, function (v) { pen.lead = v; savePrefs(); refreshOptions(); }), leadSwatch(pen)]));
      showed = true;
    }
    if (tool === 'text') {
      var ts = el('select', { 'aria-label': 'Altura de letra' });
      TEXT_SIZES.forEach(function (t) { var op = el('option', { value: String(t[1]), text: t[0] }); if (Math.abs(t[1] - textIn) < 1e-9) op.selected = true; ts.appendChild(op); });
      ts.addEventListener('change', function () { textIn = parseFloat(ts.value); savePrefs(); });
      box.appendChild(el('label', { class: 'opt' }, [el('span', { class: 'opt-name', text: 'Letra' }), ts]));
      showed = true;
    }
    if (tool === 'line' || tool === 'polyline' || tool === 'rect' || tool === 'circle' || tool === 'text') {
      var sel = el('select', { 'aria-label': 'Capa activa' });
      doc.layers.forEach(function (l) { var o = el('option', { value: l.id, text: l.name }); if (l.id === doc.activeLayer) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { doc.activeLayer = sel.value; uiSync(); autosave(); });
      var wrap = el('label', { class: 'opt' }, [el('span', { class: 'opt-name', text: 'Capa' }), sel]);
      wrap.querySelector('select').style.cssText = 'height:32px;border-radius:7px;border:1px solid var(--line);background:var(--panel-2);color:var(--text);padding:0 6px;';
      box.appendChild(wrap);
      showed = true;
    }
    box.hidden = !showed || mode !== '2d';
  }

  function renderLayers() {
    var ul = $('layers');
    ul.textContent = '';
    doc.layers.forEach(function (l) {
      var li = el('li', { class: 'layer' + (l.id === doc.activeLayer ? ' active' : '') });
      var sw = el('span', { class: 'sw' }); sw.style.background = layerColor(l);
      var name = el('input', { type: 'text', value: l.name, 'aria-label': 'Nombre de la capa', maxlength: '40' });
      name.addEventListener('focus', function () { if (doc.activeLayer !== l.id) { doc.activeLayer = l.id; refreshOptions(); highlightActiveLayer(); autosave(); } });
      name.addEventListener('change', function () { l.name = name.value.trim() || l.name; name.value = l.name; commit(); });
      name.addEventListener('keydown', function (e) { if (e.key === 'Enter') name.blur(); });
      var eye = el('button', { class: 'lbtn' + (l.visible ? '' : ' off'), type: 'button', title: l.visible ? 'Ocultar capa' : 'Mostrar capa', 'aria-label': 'Mostrar u ocultar capa', 'aria-pressed': String(!l.visible) });
      eye.appendChild(svgIcon(l.visible ? 'eye' : 'eyeoff', 18));
      eye.addEventListener('click', function () { l.visible = !l.visible; dropHiddenFromSelection(); commit(); });
      var lock = el('button', { class: 'lbtn' + (l.locked ? '' : ' off'), type: 'button', title: l.locked ? 'Desbloquear capa' : 'Bloquear capa', 'aria-label': 'Bloquear o desbloquear capa', 'aria-pressed': String(l.locked) });
      lock.appendChild(svgIcon(l.locked ? 'lock' : 'unlock', 18));
      lock.addEventListener('click', function () { l.locked = !l.locked; dropHiddenFromSelection(); commit(); });
      li.addEventListener('click', function (e) { if (e.target === li || e.target === sw) { doc.activeLayer = l.id; uiSync(); autosave(); } });
      li.appendChild(sw); li.appendChild(name); li.appendChild(eye); li.appendChild(lock);
      ul.appendChild(li);
    });
  }
  function highlightActiveLayer() {
    var items = $('layers').children;
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('active', doc.layers[i].id === doc.activeLayer);
  }
  function dropHiddenFromSelection() {
    var map = idMap();
    selection = new Set(Array.from(selection).filter(function (id) { var o = map[id]; return o && isVisible(o) && !isLocked(o); }));
  }

  $('layer-add').addEventListener('click', function () {
    var n = doc.layers.length + 1, hue = EXTRA_HUES[(doc.layers.length - 4 + EXTRA_HUES.length * 4) % EXTRA_HUES.length];
    var id = 'capa' + Date.now().toString(36);
    doc.layers.push({ id: id, name: 'Capa ' + n, hue: hue, sat: 75, ld: 66, ll: 36, visible: true, locked: false });
    doc.activeLayer = id;
    commit();
  });

  function propRow(label, content) {
    return el('div', { class: 'prop-row' }, [el('label', { text: label }), content]);
  }
  function valSpan(text) { return el('span', { class: 'val', text: text }); }
  function editField(value, onSet) {
    var inp = el('input', { type: 'text', value: value });
    inp.addEventListener('change', function () {
      var m = U.parseLength(inp.value, units);
      if (isNaN(m) || m <= 0.005) { toast('Medida no válida.'); inp.value = value; return; }
      onSet(m); commit();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    return inp;
  }

  function penSelect(value, onSet) {
    var sel = el('select', { 'aria-label': 'Tipo de línea' });
    D.PENS.forEach(function (pn) { var op = el('option', { value: pn.id, text: pn.name, title: pn.desc }); if (pn.id === value) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { onSet(sel.value); });
    return sel;
  }
  function leadSelect(value, onSet) {
    var sel = el('select', { 'aria-label': 'Mina del lápiz' });
    D.LEADS.forEach(function (ld) { var op = el('option', { value: ld.id, text: ld.id + ' · ' + ld.mm + ' mm', title: ld.desc }); if (ld.id === value) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { onSet(sel.value); });
    return sel;
  }
  /** Muestra de cómo queda la línea (grosor, tono y raya). */
  function leadSwatch(o) {
    var c = el('canvas', { width: '120', height: '20', class: 'swatch', 'aria-hidden': 'true' });
    var g = c.getContext('2d'), ld = D.leadById(o.lead), pn = D.penById(o.type || o.pen);
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 120, 20);
    g.strokeStyle = leadColor(ld); g.lineWidth = Math.max(1, ld.mm * 3.2);
    if (pn && pn.dash) g.setLineDash(pn.dash.map(function (x) { return x * 48; }));
    g.beginPath(); g.moveTo(6, 10); g.lineTo(114, 10); g.stroke();
    c.title = (pn ? pn.desc + ' · ' : '') + ld.desc;
    return c;
  }

  function cfgChanged() {
    savePrefs(); uiSync();
    updateCursor(mouse.sx, mouse.sy, shiftDown);
    requestRender();
  }
  function selectEl(options, value, onChange, label) {
    var sel = el('select', { 'aria-label': label });
    options.forEach(function (o) {
      var op = el('option', { value: String(o[1]), text: o[0] });
      if (Math.abs(o[1] - value) < 1e-9) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { onChange(parseFloat(sel.value)); });
    return sel;
  }
  function stepSelect(value, defaultLabel, label, onSet) {
    var presets = units === 'ft' ? STEP_PRESETS_FT : STEP_PRESETS_M;
    var opts = [[defaultLabel, 0]].concat(presets.map(function (p) { return [p.label, p.m]; }));
    var known = opts.some(function (o) { return Math.abs(o[1] - value) < 1e-9; });
    if (!known && value > 0) opts.push([fmt(value) + ' (otro)', value]);
    return selectEl(opts, value, onSet, label);
  }

  function renderGridCfg() {
    var box = $('gridcfg'), adv = uiLevel === 'avanzado';
    box.textContent = '';
    box.appendChild(levelSwitch());
    box.appendChild(propRow('Espaciado', stepSelect(gridCfg.step, 'Automático', 'Espaciado de la cuadrícula', function (v) { gridCfg.step = v; cfgChanged(); })));
    var other = el('input', { type: 'text', placeholder: units === 'ft' ? 'Otro: 8" o 2\'6"' : 'Otro: 25cm o 0.4', 'aria-label': 'Otro espaciado' });
    other.addEventListener('change', function () {
      var m = U.parseLength(other.value, units);
      other.value = '';
      if (isNaN(m) || m < 0.002) { toast('Medida no válida.'); return; }
      gridCfg.step = m; cfgChanged();
    });
    other.addEventListener('keydown', function (e) { if (e.key === 'Enter') other.blur(); });
    if (adv) box.appendChild(propRow('Otro', other));
    box.appendChild(propRow('Áreas', checkRow(showAreas, function (v) { showAreas = v; savePrefs(); requestRender(); renderProps(); }, 'Mostrar el área de cada cuarto')));
    if (!adv) return;
    box.appendChild(propRow('Líneas gruesas', selectEl([['Sin líneas gruesas', 0], ['Cada 2', 2], ['Cada 4', 4], ['Cada 5', 5], ['Cada 8', 8], ['Cada 10', 10]], gridCfg.major, function (v) { gridCfg.major = v; cfgChanged(); }, 'Líneas gruesas')));
    box.appendChild(propRow('Paso del snap', stepSelect(gridCfg.snapStep, 'Igual a la cuadrícula', 'Paso del snap', function (v) { gridCfg.snapStep = v; cfgChanged(); })));
    box.appendChild(propRow('Ángulo polar', selectEl([['Apagado', 0], ['15°', 15], ['30°', 30], ['45°', 45], ['90°', 90]], polarInc, function (v) { polarInc = v; cfgChanged(); }, 'Ángulo polar')));
    var precOpts = units === 'ft'
      ? [['1"', 1], ['1/2"', 2], ['1/4"', 4], ['1/8"', 8], ['1/16"', 16]]
      : [['Automática', 0], ['0.1 m', 1], ['0.01 m (cm)', 2], ['0.001 m (mm)', 3]];
    box.appendChild(propRow('Precisión', selectEl(precOpts, units === 'ft' ? precision.ft : precision.m, function (v) {
      if (units === 'ft') precision.ft = v; else precision.m = v;
      cfgChanged();
    }, 'Precisión de las medidas')));
  }

  /* ---------- panel: papel, escala y cuadrícula (modo clase) ---------- */
  function paperChanged() { autosave(); cfgChanged(); }
  function btn(text, fn, cls) { var b = el('button', { class: 'chip-btn' + (cls ? ' ' + cls : ''), type: 'button', text: text }); b.addEventListener('click', fn); return b; }
  function renderPaperCfg() {
    var box = $('papercfg');
    box.textContent = '';
    if (!clase()) return;
    var q = doc.paper, sc = curScale(), adv = uiLevel === 'avanzado';
    box.appendChild(levelSwitch());

    function sel(label, opts, value, onSet) {
      var e = el('select', { 'aria-label': label });
      opts.forEach(function (o) {
        if (o.group) { var g = el('optgroup', { label: o.group }); o.items.forEach(function (it) { var op = el('option', { value: String(it[1]), text: it[0] }); if (String(it[1]) === String(value)) op.selected = true; g.appendChild(op); }); e.appendChild(g); return; }
        var op = el('option', { value: String(o[1]), text: o[0] }); if (String(o[1]) === String(value)) op.selected = true; e.appendChild(op);
      });
      e.addEventListener('change', function () { onSet(e.value); });
      return e;
    }
    function head(t) { box.appendChild(el('div', { class: 'sub-head', text: t })); }

    head('Hoja');
    box.appendChild(propRow('Tamaño', sel('Tamaño de la hoja', Object.keys(D.SHEETS).map(function (k) { return [D.SHEETS[k].name, k]; }), q.sheet,
      function (v) { q.sheet = v; resetInstsIfOff(); paperChanged(); fitView(); })));
    box.appendChild(propRow('Orientación', sel('Orientación', [['Horizontal', 'land'], ['Vertical', 'port']], q.orient,
      function (v) { q.orient = v; resetInstsIfOff(); paperChanged(); fitView(); })));
    box.appendChild(propRow('Medidas', sel('Sistema de medidas', [['Imperial (pies y pulgadas)', 'ft'], ['Métrico (metros)', 'm']], units, setUnits)));
    box.appendChild(propRow('Escala', sel('Escala', (units === 'm' ? D.SCALES_M : D.SCALES_FT).map(function (x) { return [x.label, x.id]; }), sc.id, function (v) {
      var keep = view.scale / paperU(); q.scale = v; view.scale = G.clamp(keep * paperU(), MIN_SCALE, MAX_SCALE); paperChanged();
    })));
    var sheetReal = D.sheetSize(q);
    box.appendChild(el('div', { class: 'hint', text: (sc.use ? sc.use + '. ' : '') + 'La hoja entera mide ' + fmt(sheetReal.w * paperU()) + ' × ' + fmt(sheetReal.h * paperU()) + ' reales.' }));

    head('Cuadrícula');
    box.appendChild(el('div', { class: 'grid-pick' }, GRID_TYPES.map(function (g) {
      var b = el('button', { type: 'button', class: 'grid-opt', 'aria-pressed': String(q.gridType === g[1]), title: g[2] }, [gridIcon(g[1]), el('span', { text: g[0] })]);
      b.addEventListener('click', function () { q.gridType = g[1]; paperChanged(); });
      return b;
    })));
    if (q.gridType !== 'none') {
      var real = q.gridMode === 'real';
      if (adv) box.appendChild(propRow('Medir en', sel('Medir la cuadrícula en', [['El papel (como la hoja cuadriculada)', 'paper'], ['La obra (medida real)', 'real']], q.gridMode, function (v) { q.gridMode = v; paperChanged(); })));
      var sq = q.gridType !== 'iso', iso = q.gridType !== 'sq';
      if (sq) {
        box.appendChild(propRow(adv ? 'Ancho del cuadro' : 'Cuadro', gridSizeField(real ? q.realX : q.gridIn, real, function (v) { if (real) q.realX = v; else q.gridIn = v; paperChanged(); })));
        if (adv) {
          var same = real ? !q.realY : !q.gridInY;
          box.appendChild(propRow('Alto del cuadro', same ? btn('Igual al ancho · cambiar', function () { if (real) q.realY = q.realX; else q.gridInY = q.gridIn; paperChanged(); })
            : el('div', { class: 'field-pair' }, [gridSizeField(real ? q.realY : q.gridInY, real, function (v) { if (real) q.realY = v; else q.gridInY = v; paperChanged(); }),
              btn('=', function () { if (real) q.realY = 0; else q.gridInY = 0; paperChanged(); })])));
        }
      }
      if (iso) {
        if (!sq || adv) {
          var isoSame = real ? !q.isoReal : !q.isoIn;
          box.appendChild(propRow('Lado isométrico', (sq && isoSame) ? btn('Igual al cuadro · cambiar', function () { if (real) q.isoReal = q.realX; else q.isoIn = q.gridIn; paperChanged(); })
            : gridSizeField(real ? (q.isoReal || q.realX) : (q.isoIn || q.gridIn), real, function (v) { if (real) { if (sq) q.isoReal = v; else q.realX = v; } else { if (sq) q.isoIn = v; else q.gridIn = v; } paperChanged(); })));
        }
        var angOpts = [['30° (isométrica)', 30], ['15°', 15], ['45°', 45], ['60°', 60]];
        if (angOpts.every(function (o) { return o[1] !== q.isoAng; })) angOpts.push([q.isoAng + '° (otro)', q.isoAng]);
        if (adv) {
          var angIn = el('input', { type: 'text', placeholder: 'Otro: 20', 'aria-label': 'Otro ángulo' });
          angIn.addEventListener('change', function () { var v = parseFloat(angIn.value); if (!(v >= 5 && v <= 85)) { toast('Escribe un ángulo entre 5° y 85°.'); angIn.value = ''; return; } q.isoAng = v; paperChanged(); });
          angIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') angIn.blur(); });
          box.appendChild(propRow('Ángulo', el('div', { class: 'field-pair' }, [sel('Ángulo de la red', angOpts, q.isoAng, function (v) { q.isoAng = parseFloat(v); paperChanged(); }), angIn])));
        }
      }
      var base = paperGridBase();
      box.appendChild(el('div', { class: 'hint', text: '1 cuadro = ' + fmt(base) + ' real = ' + paperLenStr(base) + ' en el papel.' }));
      box.appendChild(propRow('Color', el('div', { class: 'swatches' }, Object.keys(GRID_COLORS).map(function (k) {
        var b = el('button', { type: 'button', class: 'sw', title: k, 'aria-label': 'Color ' + k, 'aria-pressed': String(q.gridColor === k) });
        b.style.background = 'rgb(' + GRID_COLORS[k].join(',') + ')';
        b.addEventListener('click', function () { q.gridColor = k; paperChanged(); });
        return b;
      }))));
      box.appendChild(propRow('Intensidad', sel('Intensidad', [['Suave', 'suave'], ['Media', 'media'], ['Fuerte', 'fuerte']], q.gridStrength, function (v) { q.gridStrength = v; paperChanged(); })));
      if (adv) {
        box.appendChild(propRow('Estilo', sel('Estilo de la cuadrícula', [['Líneas', 'lines'], ['Puntos', 'dots']], q.gridStyle, function (v) { q.gridStyle = v; paperChanged(); })));
        box.appendChild(propRow('Líneas gruesas', sel('Líneas gruesas', [['Sin líneas gruesas', 0], ['Cada 2', 2], ['Cada 4', 4], ['Cada 5', 5], ['Cada 8', 8], ['Cada 10', 10]], q.major, function (v) { q.major = parseInt(v, 10); paperChanged(); })));
        box.appendChild(propRow('Empieza en', sel('Dónde empieza la cuadrícula', [['El centro de la hoja', 'centro'], ['La esquina del marco', 'marco']], q.gridAt, function (v) { q.gridAt = v; paperChanged(); })));
      }
    }
    if (adv) {
      var b0 = paperGridBase();
      box.appendChild(propRow('Snap', sel('Paso del snap', [['Cada cuadro · ' + fmt(b0), 1], ['Medio cuadro · ' + fmt(b0 / 2), 2], ['Cuarto de cuadro · ' + fmt(b0 / 4), 4]], q.snapDiv, function (v) { q.snapDiv = parseInt(v, 10); paperChanged(); })));
      box.appendChild(propRow('Ángulo polar', selectEl([['Apagado', 0], ['15°', 15], ['30°', 30], ['45°', 45], ['90°', 90]], polarInc, function (v) { polarInc = v; cfgChanged(); }, 'Ángulo polar')));
      var precOpts = units === 'ft'
        ? [['1"', 1], ['1/2"', 2], ['1/4"', 4], ['1/8"', 8], ['1/16"', 16]]
        : [['Automática', 0], ['0.1 m', 1], ['0.01 m (cm)', 2], ['0.001 m (mm)', 3]];
      box.appendChild(propRow('Precisión', selectEl(precOpts, units === 'ft' ? precision.ft : precision.m, function (v) {
        if (units === 'ft') precision.ft = v; else precision.m = v;
        cfgChanged();
      }, 'Precisión de las medidas')));
      box.appendChild(propRow('Medida en papel', checkRow(q.paperLen, function (v) { q.paperLen = v; paperChanged(); }, 'Mostrar cuánto mide la línea en el papel')));
    }

    head('Cajetín');
    var fields = adv ? [['student', profile.name || 'Tu nombre', 'Dibujó'], ['course', profile.course || 'Curso o profesor', 'Curso'], ['sheetNo', 'A-1', 'Lámina']] : [['sheetNo', 'A-1', 'Lámina']];
    fields.forEach(function (f) {
      var inp = el('input', { type: 'text', value: q[f[0]] || '', maxlength: '60', placeholder: f[1], 'aria-label': f[2] });
      inp.addEventListener('change', function () { q[f[0]] = inp.value.trim(); autosave(); requestRender(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
      box.appendChild(propRow(f[2], inp));
    });
    if (!adv) box.appendChild(el('div', { class: 'hint', text: 'Tu nombre y curso salen de Mi cuenta.' }));
    box.appendChild(el('div', { class: 'btn-row' }, [
      btn('Ver la hoja', fitView), btn('Tamaño real', realSize), btn('Centrar en el dibujo', centerSheet),
      btn('PNG de la hoja', exportSheetPNG), btn('Imprimir a escala', printSheet)
    ]));
    if (adv) box.appendChild(propRow('Cuadrícula al imprimir', checkRow(q.printGrid, function (v) { q.printGrid = v; autosave(); }, 'Imprimir la cuadrícula')));
  }

  /** Simple / Avanzado: cuántas opciones se ven en el panel. */
  function levelSwitch() {
    var wrap = el('div', { class: 'seg level-seg', role: 'group', 'aria-label': 'Opciones' });
    [['simple', 'Simple'], ['avanzado', 'Avanzado']].forEach(function (o) {
      var b = el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(uiLevel === o[0]), text: o[1] });
      b.addEventListener('click', function () { uiLevel = o[0]; savePrefs(); uiSync(); });
      wrap.appendChild(b);
    });
    return wrap;
  }
  /** Tamaño de cuadro: medidas comunes o la que escribas. En papel guarda pulgadas de papel; en obra, metros. */
  function gridSizeField(value, real, onSet) {
    var presets = real ? (units === 'ft' ? STEP_PRESETS_FT : STEP_PRESETS_M).map(function (x) { return [x.label, x.m]; })
      : (units === 'm' ? GRID_PAPER_M : GRID_PAPER_FT);
    var known = presets.some(function (p) { return Math.abs(p[1] - value) < 1e-9; });
    var label = function (v) { return real ? fmt(v) : (units === 'm' ? (Math.round(v * 25.4 * 10) / 10) + ' mm' : U.formatFtIn(v * IN_M, 64)); };
    var e = el('select', { 'aria-label': 'Tamaño del cuadro' });
    presets.concat(known ? [] : [[label(value) + ' (tuyo)', value]]).forEach(function (p) {
      var op = el('option', { value: String(p[1]), text: p[0] }); if (Math.abs(p[1] - value) < 1e-9) op.selected = true; e.appendChild(op);
    });
    e.addEventListener('change', function () { onSet(parseFloat(e.value)); });
    var inp = el('input', { type: 'text', placeholder: real ? (units === 'ft' ? '9"' : '30cm') : (units === 'ft' ? '3/16' : '4mm'), title: 'Escribe otra medida', 'aria-label': 'Otro tamaño de cuadro' });
    inp.addEventListener('change', function () {
      var txt = inp.value.trim(), m; inp.value = '';
      // en papel un número suelto son pulgadas (o milímetros en métrico)
      if (!real && /^\d+(\.\d+)?$/.test(txt)) m = parseFloat(txt) * (units === 'ft' ? IN_M : 0.001);
      else if (!real && /^\d+\/\d+$/.test(txt)) m = U.parseLength(txt + '"', 'ft');
      else m = U.parseLength(txt, units);
      if (isNaN(m) || m <= 0) { toast('Medida no válida.'); return; }
      var v = real ? m : m / IN_M;
      if (!real && (v < 0.03 || v > 4)) { toast('En el papel, entre 1/32" y 4".'); return; }
      onSet(v);
    });
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') inp.blur(); });
    return el('div', { class: 'field-pair grid-size' }, [e, inp]);
  }
  function gridIcon(t) {
    var svg = '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><rect x="2.5" y="2.5" width="23" height="23" rx="2" fill="#fbfaf6" stroke="currentColor" stroke-opacity=".35"/>';
    if (t === 'sq' || t === 'both') svg += '<path d="M9 3v22M14 3v22M19 3v22M3 9h22M3 14h22M3 19h22" stroke="#468cd7" stroke-width="1"/>';
    if (t === 'iso' || t === 'both') svg += '<path d="M3 20l20-11.5M3 14l14-8M9 25l16-9.2M25 20L5 8.5M25 14L11 6M19 25L3 15.8M14 3v22" stroke="#468cd7" stroke-width="1" ' + (t === 'both' ? 'stroke-dasharray="2 2"' : '') + '/>';
    svg += '</svg>';
    var w = el('span', { class: 'gi' }); w.innerHTML = svg; return w;
  }

  function resetInstsIfOff() {
    var fresh = D.defaultInstruments(D.sheetSize(doc.paper));
    INST_ORDER.forEach(function (id) { if (!insts[id].on) insts[id] = fresh[id]; });
    if (insts.tsq.on) { var h = D.sheetSize(doc.paper).h; insts.tsq.y = G.clamp(insts.tsq.y, -h / 2 + 1.5, h / 2 - 0.5); }
    savePrefs();
  }
  function realSize() {
    view.scale = G.clamp(96 / paperU(), MIN_SCALE, MAX_SCALE);
    updateReadout(); requestRender();
    toast('Tamaño real: 1 pulgada de papel ≈ 1 pulgada en pantalla (depende de tu pantalla).');
  }
  function centerSheet() {
    var map = idMap(), mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    doc.objects.forEach(function (o) { if (!isVisible(o)) return; var b = G.bboxOf(o, map); if (!b) return; mnx = Math.min(mnx, b.minx); mny = Math.min(mny, b.miny); mxx = Math.max(mxx, b.maxx); mxy = Math.max(mxy, b.maxy); });
    if (!isFinite(mnx)) { doc.paper.origin = [0, 0]; }
    else {
      var lay = sheetLay(), r = lay.sheet, fr = lay.frame, tt = lay.title;
      // el centro de la zona libre (sin cajetín) queda en el centro del dibujo
      var ax = doc.paper.orient === 'port' ? (fr.x0 + fr.x1) / 2 : (fr.x0 + tt.x0) / 2, ay = doc.paper.orient === 'port' ? (tt.y1 + fr.y1) / 2 : (fr.y0 + fr.y1) / 2;
      var cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      doc.paper.origin = [(mnx + mxx) / 2 - (ax - cx), (mny + mxy) / 2 - (ay - cy)];
    }
    autosave(); fitView();
  }

  /** Barra de escuadras (lado derecho del lienzo). */
  function renderDraftBar() {
    var bar = $('draftbar');
    bar.textContent = '';
    bar.hidden = !(clase() && mode === '2d');
    if (bar.hidden) return;
    var head = el('button', { class: 'chip-btn db-head', type: 'button', 'aria-expanded': String(instOpen), text: instOpen ? 'Escuadras ▾' : 'Escuadras ▸' });
    head.addEventListener('click', function () { instOpen = !instOpen; savePrefs(); renderDraftBar(); });
    bar.appendChild(head);
    if (!instOpen) return;
    var names = { tsq: 'Regla T', t3060: '30°-60°', t45: '45°', ruler: 'Escalímetro' };
    INST_ORDER.forEach(function (id) {
      var b = el('button', { class: 'chip-btn db-btn', type: 'button', 'aria-pressed': String(insts[id].on), text: names[id] });
      b.addEventListener('click', function () {
        insts[id].on = !insts[id].on;
        if (insts[id].on) { activeInst = id; ensureInstOnSheet(id); }
        savePrefs(); renderDraftBar(); updateCursor(mouse.sx, mouse.sy, shiftDown); requestRender();
      });
      bar.appendChild(b);
    });
    var it = insts[activeInst], canAct = it && it.on && it.kind !== 'tsq';
    bar.appendChild(el('div', { class: 'db-sep' }));
    [['Girar 15°', function () { it.ang = ((it.ang || 0) + 15) % 360; }], ['Girar 90°', function () { it.ang = ((it.ang || 0) + 90) % 360; }],
     ['Voltear', function () { it.flip = !it.flip; }], ['Derecha', function () { it.ang = 0; }]].forEach(function (a) {
      var b = el('button', { class: 'chip-btn db-btn small', type: 'button', text: a[0], title: canAct ? '' : 'Elige una escuadra encendida' });
      b.disabled = !canAct;
      b.addEventListener('click', function () { a[1](); savePrefs(); requestRender(); });
      bar.appendChild(b);
    });
    bar.appendChild(el('div', { class: 'db-sep' }));
    var rs = el('button', { class: 'chip-btn db-btn small', type: 'button', text: 'Tamaño real', title: 'Zoom a tamaño de papel' });
    rs.addEventListener('click', realSize);
    bar.appendChild(rs);
  }
  /** Si la escuadra quedó fuera de la vista, la trae al centro de la pantalla. */
  function ensureInstOnSheet(id) {
    var it = insts[id], u = paperU(), o = doc.paper.origin, c = [(view.cx - o[0]) / u, (view.cy - o[1]) / u];
    var w = instWorld(it), S = it.kind === 'tsq' ? w2s([view.cx, w.y]) : w2s(w.p);
    if (S[0] > -40 && S[0] < W + 40 && S[1] > -40 && S[1] < H + 40) return;
    if (it.kind === 'tsq') it.y = c[1];
    else it.p = [c[0] - 2, c[1] - 2];
  }

  /** Cambia entre clase (papel) y libre (interiores y 3D). */
  function setWs(w) {
    if (doc.ws === w) return;
    doc.ws = w;
    if (w === 'clase') {
      if (!doc.paper) doc.paper = clone(PAPER_DEFAULT);
      if (doc.objects.length && Math.hypot(doc.paper.origin[0], doc.paper.origin[1]) < 1e-9) centerSheet();
      toast('Modo clase: hoja de papel, escala, minas y escuadras.');
    } else toast('Modo libre: diseño, muebles y 3D sin hoja.');
    autosave(); uiSync(); fitView();
  }

  /* ---------- exportar la hoja ---------- */
  function renderSheetCanvas(dpi) {
    var r = sheetLay().sheet;
    var c2 = document.createElement('canvas');
    c2.width = Math.round(r.w * dpi); c2.height = Math.round(r.h * dpi);
    var sv = { ctx: ctx, W: W, H: H, DPR: DPR, view: view, sel: selection };
    ctx = c2.getContext('2d'); W = c2.width; H = c2.height; DPR = 1;
    view = { cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2, scale: dpi / r.u };
    selection = new Set(); exporting = true;
    try { render(true); }
    finally { ctx = sv.ctx; W = sv.W; H = sv.H; DPR = sv.DPR; view = sv.view; selection = sv.sel; exporting = false; requestRender(); }
    return c2;
  }
  function sheetDpi() { var r = D.sheetSize(doc.paper); return r.w * r.h > 600 ? 120 : 150; }
  function exportSheetPNG() {
    var c2 = renderSheetCanvas(sheetDpi());
    c2.toBlob(function (blob) { if (blob) { download(blob, 'lamina-cota.png'); toast('Hoja guardada como lamina-cota.png'); logEvent('png', curName(), curId); } }, 'image/png');
  }
  function printSheet() {
    var r = D.sheetSize(doc.paper), url = renderSheetCanvas(sheetDpi()).toDataURL('image/png');
    var w = window.open('', '_blank');
    if (!w) { toast('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Lámina · Cota</title><style>@page{size:' + r.w + 'in ' + r.h + 'in;margin:0}html,body{margin:0;background:#fff}img{width:' + r.w + 'in;height:' + r.h + 'in;display:block}</style></head><body><img src="' + url + '" alt="Lámina"><script>document.images[0].onload=function(){setTimeout(function(){print()},250)};<\/script></body></html>');
    w.document.close();
    toast('Imprime al 100% (sin "ajustar a la página") para que la escala quede exacta.');
    logEvent('imprimir', curName(), curId);
  }

  function renderProps() {
    var box = $('props');
    box.textContent = '';
    var list = selectedObjects();
    if (!list.length) { box.appendChild(el('div', { class: 'empty', text: 'Elige un objeto para ver y cambiar sus medidas.' })); return; }

    var lsel = el('select', { 'aria-label': 'Capa del objeto' });
    var first = list[0].layer, same = list.every(function (o) { return o.layer === first; });
    if (!same) lsel.appendChild(el('option', { value: '', text: 'Varias', selected: 'selected' }));
    doc.layers.forEach(function (l) { var o = el('option', { value: l.id, text: l.name }); if (same && l.id === first) o.selected = true; lsel.appendChild(o); });
    lsel.addEventListener('change', function () { if (!lsel.value) return; list.forEach(function (o) { o.layer = lsel.value; }); dropHiddenFromSelection(); commit(); });

    if (list.length > 1) {
      box.appendChild(propRow('Elegidos', valSpan(list.length + ' objetos')));
      box.appendChild(propRow('Capa', lsel));
      box.appendChild(moveRow(list));
      return;
    }
    var o = list[0], map = idMap();
    box.appendChild(propRow('Tipo', valSpan(TYPE_NAMES[o.type] || o.type)));
    box.appendChild(propRow('Capa', lsel));
    if (clase() && (PEN_TYPES.indexOf(o.type) >= 0 || o.type === 'text' || o.type === 'wall')) {
      if (PEN_TYPES.indexOf(o.type) >= 0) box.appendChild(propRow('Línea', penSelect(o.pen || 'visible', function (v) { o.pen = v; o.lead = D.penById(v).lead; commit(); })));
      box.appendChild(propRow('Mina', leadSelect(leadOf(o).id, function (v) { o.lead = v; commit(); })));
    }
    if (o.type === 'text') {
      var ti = el('input', { type: 'text', value: o.text, maxlength: '200', 'aria-label': 'Texto' });
      ti.addEventListener('change', function () { if (ti.value.trim()) { o.text = ti.value.trim(); commit(); } });
      ti.addEventListener('keydown', function (e) { if (e.key === 'Enter') ti.blur(); });
      box.appendChild(propRow('Texto', ti));
      if (clase()) box.appendChild(propRow('Altura', valSpan(U.formatFtIn(o.h / paperU() * IN_M, 32) + ' en papel')));
    }
    switch (o.type) {
      case 'line':
        box.appendChild(propRow('Largo', lenField(G.dist(o.a, o.b), function (m) { setLen(o, m); })));
        box.appendChild(propRow('Ángulo', angField(segAng(o.a, o.b), function (a) { setAng(o, a); })));
        box.appendChild(propRow('Inicio', xyField(o.a, function (q) { o.a = q; })));
        box.appendChild(propRow('Fin', xyField(o.b, function (q) { o.b = q; })));
        break;
      case 'polyline':
        box.appendChild(propRow('Largo total', valSpan(fmt(G.polyLength(o.pts, o.closed)))));
        if (o.closed) box.appendChild(propRow('Área', valSpan(U.formatArea(G.polyArea(o.pts), units))));
        box.appendChild(propRow('Puntos', valSpan(String(o.pts.length))));
        box.appendChild(propRow('Primer punto', xyField(o.pts[0], function (q) { var dx = q[0] - o.pts[0][0], dy = q[1] - o.pts[0][1]; G.translateObj(o, dx, dy); })));
        break;
      case 'rect':
        var x0 = Math.min(o.a[0], o.b[0]), y0 = Math.min(o.a[1], o.b[1]);
        box.appendChild(propRow('Ancho', lenField(Math.abs(o.b[0] - o.a[0]), function (m) { o.a = [x0, Math.min(o.a[1], o.b[1])]; o.b = [x0 + m, Math.max(o.a[1], o.b[1])]; })));
        box.appendChild(propRow('Alto', lenField(Math.abs(o.b[1] - o.a[1]), function (m) { var xa = Math.min(o.a[0], o.b[0]), xb = Math.max(o.a[0], o.b[0]); o.a = [xa, y0]; o.b = [xb, y0 + m]; })));
        box.appendChild(propRow('Esquina abajo izq.', xyField([x0, y0], function (q) { G.translateObj(o, q[0] - x0, q[1] - y0); })));
        box.appendChild(propRow('Área', valSpan(U.formatArea(Math.abs((o.b[0] - o.a[0]) * (o.b[1] - o.a[1])), units))));
        break;
      case 'circle':
        box.appendChild(propRow('Radio', lenField(o.r, function (m) { o.r = m; })));
        box.appendChild(propRow('Diámetro', lenField(o.r * 2, function (m) { o.r = m / 2; })));
        box.appendChild(propRow('Centro', xyField(o.c, function (q) { o.c = q; })));
        box.appendChild(propRow('Área', valSpan(U.formatArea(Math.PI * o.r * o.r, units))));
        break;
      case 'wall':
        box.appendChild(propRow('Largo', lenField(G.dist(o.a, o.b), function (m) {
          var u = G.norm(G.sub(o.b, o.a)); stretchWall(o, G.add(o.a, G.mul(u, m)));
        })));
        box.appendChild(propRow('Ángulo', angField(segAng(o.a, o.b), function (a) {
          var L = G.dist(o.a, o.b), r = a * Math.PI / 180; moveWallEnd(o, 'b', [o.a[0] + Math.cos(r) * L, o.a[1] + Math.sin(r) * L]);
        })));
        box.appendChild(propRow('Espesor', lenField(o.t, function (m) { o.t = m; }, { presets: WALL_PRESETS })));
        box.appendChild(propRow('Inicio', xyField(o.a, function (q) { moveWallEnd(o, 'a', q); })));
        box.appendChild(propRow('Fin', xyField(o.b, function (q) { moveWallEnd(o, 'b', q); })));
        box.appendChild(el('div', { class: 'hint', text: 'Las paredes pegadas en las esquinas se mueven junto con esta.' }));
        break;
      case 'door': case 'window':
        var wl = map[o.wall], L = wl ? G.dist(wl.a, wl.b) : 0;
        box.appendChild(propRow('Ancho', lenField(o.w, function (m) {
          if (m > L) { toast('La pared es más corta que esa abertura.'); return false; }
          o.w = m; o.pos = G.clamp(o.pos, m / 2, L - m / 2);
        }, { presets: (o.type === 'door' ? DOOR_PRESETS : WINDOW_PRESETS)[units].map(function (m) { return [fmt(m), m]; }) })));
        box.appendChild(propRow('Desde el inicio', lenField(o.pos - o.w / 2, function (m) {
          if (m + o.w > L + 1e-9) { toast('No cabe: la pared mide ' + fmt(L) + '.'); return false; }
          o.pos = m + o.w / 2;
        }, { zero: true })));
        box.appendChild(propRow('Desde el final', lenField(L - o.pos - o.w / 2, function (m) {
          if (m + o.w > L + 1e-9) { toast('No cabe: la pared mide ' + fmt(L) + '.'); return false; }
          o.pos = L - m - o.w / 2;
        }, { zero: true })));
        var D3 = M3.DEFAULTS;
        box.appendChild(propRow('Alto', lenField(o.h > 0 ? o.h : (o.type === 'door' ? D3.doorH : D3.winH), function (m) { o.h = m; })));
        if (o.type === 'window') box.appendChild(propRow('Antepecho', lenField(o.sill >= 0 ? o.sill : D3.sillH, function (m) { o.sill = m; }, { zero: true })));
        var flip = el('button', { class: 'chip-btn', type: 'button', text: 'Invertir lado' });
        flip.addEventListener('click', function () { o.flip = !o.flip; commit(); });
        box.appendChild(propRow('Apertura', flip));
        if (o.type === 'door') box.appendChild(propRow('Portón', el('label', { class: 'opt-check' }, [
          (function () { var cb = el('input', { type: 'checkbox', 'aria-label': 'Portón enrollable' }); cb.checked = !!o.roll; cb.addEventListener('change', function () { if (cb.checked) o.roll = true; else delete o.roll; commit(); }); return cb; })(),
          document.createTextNode(' Enrollable (garaje)')
        ])));
        break;
      case 'dim':
        box.appendChild(propRow('Medida', valSpan(fmt(G.dist(o.a, o.b)))));
        break;
      case 'furn':
        var item = F.get(o.kind);
        if (item) {
          var ksel = el('select', { 'aria-label': 'Tipo de mueble' });
          F.cats().forEach(function (cat) {
            var g = el('optgroup', { label: cat });
            F.CATALOG.filter(function (c) { return c.cat === cat; }).forEach(function (c) { var op = el('option', { value: c.id, text: c.name }); if (c.id === o.kind) op.selected = true; g.appendChild(op); });
            ksel.appendChild(g);
          });
          ksel.addEventListener('change', function () { var c = F.get(ksel.value); if (!c) return; o.kind = c.id; o.w = c.w; o.d = c.d; delete o.hgt; delete o.elev; commit(); });
          box.appendChild(propRow('Mueble', ksel));
        }
        var hd0 = F.heightOf(o.kind);
        box.appendChild(propRow('Ancho', lenField(o.w, function (m) { o.w = m; })));
        box.appendChild(propRow(o.kind === 'escalera' ? 'Largo' : 'Fondo', lenField(o.d, function (m) { o.d = m; })));
        if (o.kind !== 'escalera') {
          box.appendChild(propRow('Alto', lenField(o.hgt > 0 ? o.hgt : hd0.h, function (m) { o.hgt = m; })));
          box.appendChild(propRow('Desde el piso', lenField(o.elev >= 0 ? o.elev : hd0.elev, function (m) { o.elev = m; }, { zero: true })));
        }
        box.appendChild(propRow('Centro', xyField(o.p, function (q) { o.p = q; })));
        box.appendChild(propRow('Ángulo', angField(o.ang || 0, function (a) { o.ang = ((a % 360) + 360) % 360; })));
        var fr = el('div', { class: 'btn-row' }, [
          btn('Girar 90°', function () { o.ang = ((o.ang || 0) + 90) % 360; commit(); }),
          btn('Pegar a la pared', function () {
            var walls = doc.objects.filter(function (w) { return w.type === 'wall' && isVisible(w); });
            var al = F.alignToWall(o.p, o.w, o.d, walls, 1.5);
            if (!al) { toast('No hay una pared cerca (a menos de ' + fmt(1.5) + ').'); return; }
            o.p = al.p; o.ang = al.ang; commit();
          })
        ]);
        box.appendChild(fr);
        if (o.kind === 'escalera') {
          var li = levelIndex(o.lv), up = doc.levels[li + 1];
          box.appendChild(propRow('Sube a', valSpan(up ? up.name : 'No hay piso arriba')));
        }
        break;
      case 'room':
        var ni = el('input', { type: 'text', value: o.name, maxlength: '60', 'aria-label': 'Nombre del cuarto' });
        ni.addEventListener('change', function () { o.name = ni.value.trim() || o.name; commit(); });
        ni.addEventListener('keydown', function (e) { if (e.key === 'Enter') ni.blur(); });
        box.appendChild(propRow('Nombre', ni));
        var mk = levelRooms(), rr = mk ? M3.roomAt(mk, o.p[0], o.p[1]) : null;
        box.appendChild(propRow('Área', valSpan(rr ? U.formatArea(rr.area, units) : 'Fuera de un cuarto cerrado')));
        box.appendChild(propRow('Posición', xyField(o.p, function (q) { o.p = q; })));
        break;
      case 'text':
        box.appendChild(propRow('Posición', xyField(o.p, function (q) { o.p = q; })));
        break;
      default: break;
    }
    if (o.type !== 'door' && o.type !== 'window') box.appendChild(moveRow([o]));
    box.appendChild(el('div', { class: 'hint', text: 'Flechas del teclado: mover un paso del snap · Shift + flecha: paso fino.' }));
  }

  /* ---------- campos para editar medidas ---------- */
  function segAng(a, b) { return ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) + 360) % 360; }
  function setLen(o, m) { var u = G.norm(G.sub(o.b, o.a)); o.b = G.add(o.a, G.mul(u, m)); }
  function setAng(o, a) { var L = G.dist(o.a, o.b), r = a * Math.PI / 180; o.b = [o.a[0] + Math.cos(r) * L, o.a[1] + Math.sin(r) * L]; }
  /** Medida editable. onSet puede devolver false para rechazar. opts.zero acepta 0; opts.neg acepta negativos; opts.presets [[texto, m]]. */
  function lenField(value, onSet, opts) {
    opts = opts || {};
    var inp = el('input', { type: 'text', value: fmt(value), inputmode: 'text' });
    inp.addEventListener('change', function () {
      var m = U.parseLength(inp.value, units);
      var bad = isNaN(m) || (!opts.neg && m < 0) || (!opts.zero && !opts.neg && m <= 0.002);
      if (bad) { toast('Medida no válida. Prueba con 12\'6", 3.5m o 150cm.'); inp.value = fmt(value); return; }
      if (onSet(m) === false) { inp.value = fmt(value); return; }
      commit();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    if (!opts.presets) return inp;
    var sel = el('select', { 'aria-label': 'Medidas comunes', class: 'mini-sel' });
    sel.appendChild(el('option', { value: '', text: '▾' }));
    opts.presets.forEach(function (p) { sel.appendChild(el('option', { value: String(p[1]), text: typeof p[0] === 'string' && p[0].indexOf('·') < 0 && opts.presets === WALL_PRESETS ? p[0] + ' · ' + fmt(p[1]) : p[0] })); });
    sel.addEventListener('change', function () { var m = parseFloat(sel.value); if (m > 0 && onSet(m) !== false) commit(); });
    return el('div', { class: 'field-pair' }, [inp, sel]);
  }
  function angField(deg, onSet) {
    var inp = el('input', { type: 'text', value: (Math.round(deg * 100) / 100) + '°', 'aria-label': 'Ángulo' });
    inp.addEventListener('change', function () {
      var v = parseFloat(inp.value);
      if (isNaN(v)) { toast('Escribe el ángulo en grados.'); inp.value = (Math.round(deg * 100) / 100) + '°'; return; }
      onSet(v); commit();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    return inp;
  }
  /** Punto editable: X y Y. */
  function xyField(pt, onSet) {
    function one(i) {
      var inp = el('input', { type: 'text', value: fmt(pt[i]), 'aria-label': i ? 'Y' : 'X', placeholder: i ? 'Y' : 'X' });
      inp.addEventListener('change', function () {
        var m = U.parseLength(inp.value, units);
        if (isNaN(m)) { toast('Medida no válida.'); inp.value = fmt(pt[i]); return; }
        var q = pt.slice(); q[i] = m; onSet(q); commit();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
      return el('label', { class: 'xy-in' }, [el('span', { text: i ? 'Y' : 'X' }), inp]);
    }
    return el('div', { class: 'xy' }, [one(0), one(1)]);
  }
  /** Mover exacto lo elegido. */
  function moveRow(list) {
    var dx = el('input', { type: 'text', placeholder: units === 'ft' ? '→ 2\'6"' : '→ 0.5m', 'aria-label': 'Mover en X' });
    var dy = el('input', { type: 'text', placeholder: units === 'ft' ? '↑ -1\'' : '↑ -0.3m', 'aria-label': 'Mover en Y' });
    var go = btn('Mover', function () {
      var mx = dx.value.trim() ? U.parseLength(dx.value, units) : 0, my = dy.value.trim() ? U.parseLength(dy.value, units) : 0;
      if (isNaN(mx) || isNaN(my)) { toast('Medida no válida.'); return; }
      if (!mx && !my) return;
      list.forEach(function (o) { G.translateObj(o, mx, my); });
      commit();
    });
    [dx, dy].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } }); });
    return propRow('Mover', el('div', { class: 'xy' }, [dx, dy, go]));
  }
  /** Mueve un extremo de pared y arrastra los extremos de las paredes que estaban pegados ahí. */
  function moveWallEnd(w, which, q) {
    var old = w[which].slice(), tol = 1e-4;
    doc.objects.forEach(function (o) {
      if (o.type !== 'wall' || o.lv !== w.lv || o === w) return;
      if (G.dist(o.a, old) < tol) o.a = q.slice();
      if (G.dist(o.b, old) < tol) o.b = q.slice();
    });
    w[which] = q.slice();
    // las aberturas se quedan dentro de su pared
    var walls = {};
    doc.objects.forEach(function (o) { if (o.type === 'wall') walls[o.id] = o; });
    doc.objects.forEach(function (o) {
      if (o.type !== 'door' && o.type !== 'window') return;
      var wl = walls[o.wall]; if (!wl) return;
      var L = G.dist(wl.a, wl.b);
      if (o.w > L) o.w = Math.max(0.3, L);
      o.pos = G.clamp(o.pos, o.w / 2, L - o.w / 2);
    });
  }
  /** Cambiar el largo de una pared estira el cuarto: la pared que llega a su extremo se corre entera
   *  y las paredes que salen del otro lado de esa se alargan. Así un cuarto rectangular sigue rectangular. */
  function stretchWall(w, q) {
    var old = w.b.slice(), d = G.sub(q, old), tol = 1e-4, u = G.norm(G.sub(w.b, w.a));
    var moved = {};
    doc.objects.forEach(function (o) {
      if (o.type !== 'wall' || o.lv !== w.lv || o === w) return;
      var atA = G.dist(o.a, old) < tol, atB = G.dist(o.b, old) < tol;
      if (!atA && !atB) return;
      var v = G.norm(G.sub(o.b, o.a));
      if (Math.abs(u[0] * v[1] - u[1] * v[0]) < 0.05) { if (atA) o.a = q.slice(); else o.b = q.slice(); return; }   // sigue la misma línea
      var far = atA ? o.b.slice() : o.a.slice();
      o.a = G.add(o.a, d); o.b = G.add(o.b, d); moved[o.id] = true;
      doc.objects.forEach(function (x) {
        if (x.type !== 'wall' || x.lv !== w.lv || x === w || x === o || moved[x.id]) return;
        if (G.dist(x.a, far) < tol) x.a = G.add(x.a, d);
        if (G.dist(x.b, far) < tol) x.b = G.add(x.b, d);
      });
    });
    moveWallEnd(w, 'b', q);
  }
  /** Flechas: mueve lo elegido un paso; puertas y ventanas corren por su pared. */
  function nudge(dx, dy) {
    var list = selectedObjects().filter(function (o) { return !isLocked(o); });
    if (!list.length) return false;
    var map = idMap();
    list.forEach(function (o) {
      if (o.type === 'door' || o.type === 'window') {
        var wl = map[o.wall]; if (!wl) return;
        var u = G.norm(G.sub(wl.b, wl.a)), L = G.dist(wl.a, wl.b), along = dx * u[0] + dy * u[1];
        if (Math.abs(along) < 1e-9) along = (Math.abs(u[0]) >= Math.abs(u[1]) ? dy * u[1] : dx * u[0]) || (dx + dy);
        o.pos = G.clamp(o.pos + along, o.w / 2, L - o.w / 2);
      } else G.translateObj(o, dx, dy);
    });
    commit();
    return true;
  }

  function uiSync() {
    var btns = $('tools').querySelectorAll('.tool-btn');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-tool') === tool));
    $('btn-undo').disabled = histIdx <= 0 && !draft;
    $('btn-redo').disabled = histIdx >= history.length - 1;
    $('cmd-hint').textContent = hintText();
    $('cmd-hint').title = hintText();
    $('tog-grid').setAttribute('aria-pressed', String(gridCfg.show));
    $('tog-snap').setAttribute('aria-pressed', String(snapOn));
    $('tog-ortho').setAttribute('aria-pressed', String(orthoOn));
    $('u-ft').setAttribute('aria-pressed', String(units === 'ft'));
    $('u-m').setAttribute('aria-pressed', String(units === 'm'));
    var n = selection.size;
    $('selbar').hidden = !(mode === '2d' && tool === 'select' && n > 0);
    $('sel-count').textContent = n + (n === 1 ? ' elegido' : ' elegidos');
    $('touchbar').hidden = !(usedTouch && draft);
    $('btn-theme').textContent = '';
    $('btn-theme').appendChild(svgIcon(theme === 'dark' ? 'sun' : 'moon', 20));
    $('app').classList.toggle('ws-clase', clase());
    $('ws-clase').setAttribute('aria-pressed', String(clase()));
    $('ws-libre').setAttribute('aria-pressed', String(!clase()));
    refreshOptions();
    renderLayers();
    renderGridCfg();
    renderPaperCfg();
    renderDraftBar();
    renderLevels();
    renderProps();
    syncModeUI();
    renderCfg3();
    updateReadout();
  }

  function toggleGrid() { gridCfg.show = !gridCfg.show; savePrefs(); uiSync(); requestRender(); }
  function toggleSnap() { snapOn = !snapOn; savePrefs(); uiSync(); updateCursor(mouse.sx, mouse.sy, shiftDown); requestRender(); }
  function toggleOrtho() { orthoOn = !orthoOn; savePrefs(); uiSync(); updateCursor(mouse.sx, mouse.sy, shiftDown); requestRender(); }

  function setUnits(u) {
    if (clase() && u !== units) {
      var k = curScale().k;
      units = u;
      doc.paper.scale = nearestScale(k).id;
      if (doc.paper.gridMode === 'paper') { var gl = u === 'm' ? GRID_PAPER_M : GRID_PAPER_FT, b = gl[0]; gl.forEach(function (x) { if (Math.abs(x[1] - doc.paper.gridIn) < Math.abs(b[1] - doc.paper.gridIn)) b = x; }); doc.paper.gridIn = b[1]; }
      autosave();
    }
    units = u; savePrefs(); uiSync(); requestRender(); if (mode === '3d') sync3D(false);
  }

  function applyTheme(t) {
    theme = t;
    document.documentElement.setAttribute('data-theme', t);
    readColors();
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', colors.panel || '#0e1520');
    savePrefs();
    uiSync(); requestRender();
  }

  /* ------------------------------------------------------------------ */
  /* Archivos: nuevo, abrir, guardar, PNG                                */
  /* ------------------------------------------------------------------ */
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function loadDoc(clean, opts) {
    if (!$('home').hidden) hideHome();
    doc = clean;
    selection.clear(); draft = null; roomCache = { key: '', mask: null };
    history = [snapshot()]; histIdx = 0;
    if (mode === '3d') { setMode('2d'); }
    uiSync();
    fitView();
    saveNow();
    if (opts && opts.message) toast(opts.message);
  }

  /* ---------- preguntas y avisos ---------- */
  /** Pregunta con aceptar/cancelar; con opts.input pide un texto. Devuelve una promesa: null si cancelan. */
  function ask(title, text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var dlg = $('dlg-ask'), inp = $('ask-input');
      $('ask-title').textContent = title;
      $('ask-text').textContent = text || '';
      $('ask-text').hidden = !text;
      inp.hidden = !opts.input; inp.value = opts.value || '';
      $('ask-ok').textContent = opts.ok || 'Aceptar';
      dlg.returnValue = 'cancel';
      function done() {
        dlg.removeEventListener('close', done);
        inp.removeEventListener('keydown', onKey);
        resolve(dlg.returnValue === 'ok' ? (opts.input ? inp.value.trim() : true) : null);
      }
      function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); dlg.close('ok'); } }
      dlg.addEventListener('close', done);
      inp.addEventListener('keydown', onKey);
      dlg.showModal();
      if (opts.input) { inp.focus(); inp.select(); }
    });
  }

  /** Límite del plan gratis: explica y, si aceptan el modo de pruebas, sigue con la acción. */
  function needPro(text, fn) {
    var d = $('dlg-pro');
    $('pro-text').textContent = text;
    d.returnValue = 'cancel';
    d.addEventListener('close', function once() {
      d.removeEventListener('close', once);
      if (d.returnValue === 'ok') { pro = true; savePrefs(); uiSync(); toast('Modo de pruebas activado: sin límites.'); fn(); }
    });
    d.showModal();
  }

  /* ---------- miniaturas ---------- */
  function drawMini(c2, d, bg) {
    var g = c2.getContext('2d'), w = c2.width, h = c2.height;
    var lv0 = (d.levels && d.levels[0] && d.levels[0].id) || 'p1';
    var objs = d.objects.filter(function (o) { return !o.lv || o.lv === lv0; });
    g.fillStyle = bg || colors.canvas; g.fillRect(0, 0, w, h);
    var walls = objs.filter(function (o) { return o.type === 'wall'; });
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    (walls.length ? walls : objs).forEach(function (o) {
      var b = G.bboxOf(o, null); if (!b) return;
      minx = Math.min(minx, b.minx); miny = Math.min(miny, b.miny); maxx = Math.max(maxx, b.maxx); maxy = Math.max(maxy, b.maxy);
    });
    if (!isFinite(minx)) return;
    var pad = Math.min(w, h) * 0.1, k = Math.min((w - 2 * pad) / Math.max(0.5, maxx - minx), (h - 2 * pad) / Math.max(0.5, maxy - miny));
    var ox = (w - (maxx - minx) * k) / 2, oy = (h - (maxy - miny) * k) / 2;
    function P(p) { return [ox + (p[0] - minx) * k, h - (oy + (p[1] - miny) * k)]; }
    function poly(pts) { g.beginPath(); pts.forEach(function (p, i) { var q = P(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); }
    g.fillStyle = colors.muted; g.globalAlpha = 0.4;
    objs.forEach(function (o) { if (o.type === 'furn') { poly(F.corners(o)); g.fill(); } });
    g.globalAlpha = 1; g.fillStyle = colors.ink;
    walls.forEach(function (o) { if (G.dist(o.a, o.b) > 1e-6) { poly(quad(o.a, o.b, o.t, true, true)); g.fill(); } });
  }
  function thumbOf(d) {
    try {
      var c2 = document.createElement('canvas'); c2.width = 192; c2.height = 132;
      if (d.ws === 'clase' && d.paper) drawMiniSheet(c2, { paper: d.paper, objects: (d.objects || []).filter(function (o) { return !o.lv || o.lv === ((d.levels && d.levels[0] && d.levels[0].id) || 'p1'); }) });
      else drawMini(c2, d);
      return c2.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ---------- proyectos (se guardan en este navegador) ---------- */
  function loadIndex() {
    projects = [];
    try {
      var a = JSON.parse(localStorage.getItem(STORE_INDEX) || '[]');
      if (Array.isArray(a)) projects = a.filter(function (e) { return e && typeof e.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.id); })
        .map(function (e) { return { id: e.id, name: String(e.name || 'Proyecto').slice(0, 60), updated: isNum(e.updated) ? e.updated : Date.now(), created: isNum(e.created) ? e.created : (isNum(e.updated) ? e.updated : Date.now()), ws: e.ws === 'clase' ? 'clase' : 'libre', thumb: typeof e.thumb === 'string' && e.thumb.indexOf('data:image/png') === 0 ? e.thumb : '' }; });
    } catch (e) { projects = []; }
  }
  function saveIndex() { try { localStorage.setItem(STORE_INDEX, JSON.stringify(projects)); } catch (e) { /* nada */ } }
  function projectById(id) { for (var i = 0; i < projects.length; i++) if (projects[i].id === id) return projects[i]; return null; }
  function newProjectId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function uniqueName(base) {
    var name = base, n = 2;
    while (projects.some(function (p) { return p.name === name; })) name = base + ' ' + (n++);
    return name;
  }
  function registerProject(name, clean) {
    var id = newProjectId();
    projects.unshift({ id: id, name: name, updated: Date.now(), created: Date.now(), ws: clean.ws === 'clase' ? 'clase' : 'libre', thumb: thumbOf(clean) });
    saveIndex();
    logEvent('crear', name, id);
    try { localStorage.setItem(STORE_PROJECT + id, JSON.stringify(clean)); } catch (e) { toast('No hay espacio en este navegador para otro proyecto.'); }
    return id;
  }
  function planText() {
    return pro ? 'Modo de pruebas · sin límites' : 'Plan gratis · ' + projects.length + ' de ' + LIMITS.projects + ' proyectos · hasta ' + LIMITS.levels + ' pisos';
  }
  function canAddProject(then) {
    if (pro || projects.length < LIMITS.projects) return true;
    needPro('El plan gratis guarda hasta ' + LIMITS.projects + ' proyectos. Con Cota Pro no hay límite.', then);
    return false;
  }
  function openProject(id) {
    var e = projectById(id);
    if (!e) return;
    saveNow();
    var clean = null;
    try { clean = cleanDoc(JSON.parse(localStorage.getItem(STORE_PROJECT + id) || 'null')); } catch (err) { clean = null; }
    if (!clean) { toast('No se pudo abrir "' + e.name + '".'); return; }
    curId = id; savePrefs();
    loadDoc(clean, { message: 'Abriste "' + e.name + '".' });
    logEvent('abrir', e.name, id);
    document.title = e.name + ' · Cota';
  }
  function startFromTemplate(id) {
    var t = TPL.build(id), item = TPL.LIST.filter(function (x) { return x.id === id; })[0];
    if (!t || !item) return;
    if (!canAddProject(function () { startFromTemplate(id); })) return;
    var clean = cleanDoc({ layers: defaultLayers(), objects: t.objects, nextId: t.nextId, activeLayer: 'dibujo', levels: t.levels, level: t.level, ws: 'libre' });
    saveNow();
    var name = uniqueName(item.name);
    curId = registerProject(name, clean);
    savePrefs();
    loadDoc(clean, { message: id === 'blank' ? 'Proyecto nuevo. Empieza con Pared o Línea.' : 'Plantilla "' + item.name + '" lista. Cámbiala como quieras.' });
    document.title = name + ' · Cota';
  }
  /** Plantillas de clase: hoja, escala y dibujo listo para practicar. */
  function classBuild(id) {
    var base = null;
    if (id === 'c-planta') base = TPL.build('casa').objects.filter(function (o) { return o.type !== 'furn'; });
    return D.buildClass(id, base);
  }
  function startClass(id) {
    var b = classBuild(id);
    if (!b) return;
    if (!canAddProject(function () { startClass(id); })) return;
    // los ids de las aberturas apuntan a sus paredes: se respetan
    var objs = b.objects, n = 1;
    objs.forEach(function (o) { if (isNum(o.id)) n = Math.max(n, o.id + 1); });
    objs.forEach(function (o) { if (!isNum(o.id)) o.id = n++; o.lv = 'p1'; });
    var paper = applyNewGrid(Object.assign(clone(PAPER_DEFAULT), b.paper, { origin: [0, 0] }));
    if (units !== 'ft') { units = 'ft'; toast('Las plantillas de clase usan pies y pulgadas.'); }
    var clean = cleanDoc({ layers: defaultLayers(), objects: objs, nextId: n, activeLayer: 'dibujo', levels: [{ id: 'p1', name: 'Planta baja' }], level: 'p1', ws: 'clase', paper: paper });
    saveNow();
    var name = uniqueName(b.item.name);
    curId = registerProject(name, clean);
    insts = D.defaultInstruments(D.sheetSize(paper));
    savePrefs();
    loadDoc(clean, { message: 'Hoja "' + b.item.name + '" lista. Prende las escuadras a la derecha.' });
    document.title = name + ' · Cota';
  }
  function drawMiniSheet(c2, b) {
    var g = c2.getContext('2d'), w = c2.width, h = c2.height, sz = D.sheetSize(b.paper);
    var k = D.scaleById(b.paper.scale).k, u = D.unitOf(k);
    var sc = Math.min((w - 16) / sz.w, (h - 16) / sz.h), pw = sz.w * sc, ph = sz.h * sc, ox = (w - pw) / 2, oy = (h - ph) / 2;
    g.fillStyle = theme === 'dark' ? '#070c13' : '#cfd6df'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbfaf6'; g.fillRect(ox, oy, pw, ph);
    var org = b.paper.origin || [0, 0];
    function P(q) { return [ox + pw / 2 + (q[0] - org[0]) / u * sc, oy + ph / 2 - (q[1] - org[1]) / u * sc]; }
    g.strokeStyle = 'rgba(70, 140, 215, 0.3)'; g.lineWidth = 0.5;
    var gt = b.paper.gridType || 'sq', gs = Math.max(4, b.paper.gridIn * sc * 4), m0 = D.MARGIN * sc;
    g.save(); g.beginPath(); g.rect(ox + m0, oy + m0, pw - 2 * m0, ph - 2 * m0); g.clip();
    if (gt === 'sq' || gt === 'both') {
      for (var x = ox + m0; x < ox + pw; x += gs) { g.beginPath(); g.moveTo(x, oy); g.lineTo(x, oy + ph); g.stroke(); }
      for (var y = oy + m0; y < oy + ph; y += gs) { g.beginPath(); g.moveTo(ox, y); g.lineTo(ox + pw, y); g.stroke(); }
    }
    if (gt === 'iso' || gt === 'both') {
      var t30 = Math.tan(Math.PI / 6);
      for (var c = -pw; c < ph + pw; c += gs) { g.beginPath(); g.moveTo(ox, oy + c); g.lineTo(ox + pw, oy + c - pw * t30); g.stroke(); g.beginPath(); g.moveTo(ox, oy + c - pw * t30); g.lineTo(ox + pw, oy + c); g.stroke(); }
    }
    g.restore();
    g.strokeStyle = 'rgba(36, 40, 48, 0.9)'; g.lineWidth = 1;
    g.strokeRect(ox + D.MARGIN * sc, oy + D.MARGIN * sc, pw - 2 * D.MARGIN * sc, ph - 2 * D.MARGIN * sc);
    var tx = ox + pw - (D.MARGIN + D.TITLE_W) * sc;
    g.beginPath(); g.moveTo(tx, oy + D.MARGIN * sc); g.lineTo(tx, oy + ph - D.MARGIN * sc); g.stroke();
    b.objects.forEach(function (o) {
      var ld = leadOf(o);
      g.strokeStyle = g.fillStyle = 'rgba(36, 40, 48, ' + ld.dark + ')';
      g.lineWidth = Math.max(0.5, ld.mm * 1.2);
      if (o.type === 'line') { var A = P(o.a), B = P(o.b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
      else if (o.type === 'wall') { var Q = quad(o.a, o.b, o.t, true, true).map(P); g.beginPath(); Q.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); }
      else if (o.type === 'text') { var T = P(o.p), hp = o.h / u * sc; if (hp > 1) g.fillRect(T[0], T[1] - hp * 0.7, o.text.length * hp * 0.6, hp * 0.55); }
    });
  }

  function duplicateProject(id) {
    var e = projectById(id);
    if (!e) return;
    if (!canAddProject(function () { duplicateProject(id); })) return;
    if (id === curId) saveNow();
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_PROJECT + id) || 'null'); } catch (err) { raw = null; }
    var clean = cleanDoc(raw);
    if (!clean) { toast('No se pudo duplicar.'); return; }
    registerProject(uniqueName(e.name + ' (copia)'), clean);
    renderProjects(); if (!$('home').hidden) renderHome();
  }
  function deleteProject(id) {
    var e = projectById(id);
    if (!e) return;
    ask('¿Borrar "' + e.name + '"?', 'Se borra de este navegador y no se puede deshacer. Si lo quieres conservar, usa Guardar primero.', { ok: 'Borrar' }).then(function (yes) {
      if (!yes) return;
      try { localStorage.removeItem(STORE_PROJECT + id); } catch (err) { /* nada */ }
      projects = projects.filter(function (p) { return p.id !== id; });
      saveIndex();
      logEvent('borrar', e.name, id);
      if (id === curId) {
        if (projects.length) { curId = ''; openProject(projects[0].id); }
        else { curId = ''; startFromTemplate('blank'); }
      }
      renderProjects(); if (!$('home').hidden) renderHome();
    });
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
    var d = Math.round(h / 24);
    return d === 1 ? 'ayer' : 'hace ' + d + ' días';
  }
  function renderProjects() {
    $('proj-plan').textContent = planText();
    var ul = $('proj-list');
    ul.textContent = '';
    projects.forEach(function (e) {
      var cur = e.id === curId;
      var li = el('li', { class: 'proj' + (cur ? ' current' : '') });
      var thumb = e.thumb ? el('img', { src: e.thumb, alt: '' }) : el('canvas', { width: '192', height: '132' });
      var name = el('input', { type: 'text', value: e.name, maxlength: '60', 'aria-label': 'Nombre del proyecto' });
      name.addEventListener('change', function () {
        e.name = name.value.trim() || e.name; name.value = e.name; saveIndex();
        if (cur) document.title = e.name + ' · Cota';
      });
      name.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') name.blur(); });
      var meta = el('div', { class: 'meta', text: (cur ? 'Abierto · ' : '') + ago(e.updated) });
      var acts = el('div', { class: 'proj-actions' });
      var open = el('button', { class: 'chip-btn', type: 'button', text: cur ? 'Abierto' : 'Abrir' });
      if (cur) open.disabled = true;
      open.addEventListener('click', function () { $('dlg-proj').close(); openProject(e.id); });
      var dup = el('button', { class: 'chip-btn', type: 'button', text: 'Duplicar' });
      dup.addEventListener('click', function () { duplicateProject(e.id); });
      var del = el('button', { class: 'chip-btn danger', type: 'button', text: 'Borrar' });
      del.addEventListener('click', function () { deleteProject(e.id); });
      acts.appendChild(open); acts.appendChild(dup); acts.appendChild(del);
      li.appendChild(thumb); li.appendChild(el('div', null, [name, meta])); li.appendChild(acts);
      ul.appendChild(li);
    });
  }
  function showProjects() { saveNow(); renderProjects(); $('dlg-proj').showModal(); }
  var newGrid = { type: 'tpl', size: 0.25 };
  /** Cuadrícula que tendrá la hoja nueva: la de la plantilla o la que escojas. */
  function applyNewGrid(paper) {
    if (newGrid.type === 'tpl') return paper;
    paper.gridType = newGrid.type; paper.gridMode = 'paper'; paper.gridIn = newGrid.size; paper.gridInY = 0; paper.isoIn = 0;
    return paper;
  }
  function renderClassTpls() {
    var grid2 = $('tpl-grid-clase'), pick = $('tpl-grid-pick');
    grid2.textContent = ''; pick.textContent = '';
    var tsel = el('select', { 'aria-label': 'Cuadrícula de la hoja nueva' });
    [['La que trae la plantilla', 'tpl']].concat(GRID_TYPES.map(function (g) { return [g[0] === 'En blanco' ? 'Sin cuadrícula (hoja lisa)' : g[0], g[1]]; })).forEach(function (o) {
      var op = el('option', { value: o[1], text: o[0] }); if (o[1] === newGrid.type) op.selected = true; tsel.appendChild(op);
    });
    tsel.addEventListener('change', function () { newGrid.type = tsel.value; renderClassTpls(); });
    var zsel = el('select', { 'aria-label': 'Tamaño del cuadro' });
    GRID_PAPER_FT.forEach(function (o) { var op = el('option', { value: String(o[1]), text: o[0] }); if (Math.abs(o[1] - newGrid.size) < 1e-9) op.selected = true; zsel.appendChild(op); });
    zsel.addEventListener('change', function () { newGrid.size = parseFloat(zsel.value); renderClassTpls(); });
    zsel.disabled = newGrid.type === 'tpl' || newGrid.type === 'none';
    pick.appendChild(el('label', null, [el('span', { text: 'Cuadrícula' }), tsel]));
    pick.appendChild(el('label', null, [el('span', { text: 'Cuadro' }), zsel]));
    D.CLASS_LIST.forEach(function (item) {
      var b0 = classBuild(item.id);
      b0.paper = applyNewGrid(Object.assign(clone(PAPER_DEFAULT), b0.paper));
      var c2 = el('canvas', { width: '320', height: '220' });
      drawMiniSheet(c2, b0);
      var b = el('button', { class: 'tpl', type: 'button' }, [c2, el('b', { text: item.name }), el('span', { text: item.desc })]);
      b.addEventListener('click', function () { $('dlg-new').close(); startClass(item.id); });
      grid2.appendChild(b);
    });
  }
  function showTemplates(section) {
    var grid = $('tpl-grid');
    grid.textContent = '';
    renderClassTpls();
    TPL.LIST.forEach(function (item) {
      var t = TPL.build(item.id);
      var c2 = el('canvas', { width: '320', height: '220' });
      drawMini(c2, { objects: t.objects, levels: t.levels });
      var b = el('button', { class: 'tpl', type: 'button' }, [c2, el('b', { text: item.name }), el('span', { text: item.desc })]);
      b.addEventListener('click', function () { $('dlg-new').close(); startFromTemplate(item.id); });
      grid.appendChild(b);
    });
    $('dlg-new').showModal();
    var target = section === 'libre' ? $('tpl-h-libre') : section === 'clase' ? $('tpl-h-clase') : null;
    if (target) target.scrollIntoView({ block: 'start' });
  }
  $('ws-clase').addEventListener('click', function () { setWs('clase'); });
  $('ws-libre').addEventListener('click', function () { setWs('libre'); });

  /* ---------- historial ---------- */
  var STORE_LOG = 'cota:log:v1';
  var LOG_TEXT = { crear: 'Creaste', abrir: 'Abriste', borrar: 'Borraste', png: 'Guardaste la imagen de', imprimir: 'Imprimiste', archivo: 'Descargaste', respaldo: 'Restauraste un respaldo con' };
  function readLog() {
    try { var a = JSON.parse(localStorage.getItem(STORE_LOG) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && isNum(x.t) && LOG_TEXT[x.type]; }) : []; }
    catch (e) { return []; }
  }
  function logEvent(type, name, id) {
    var a = readLog();
    // abrir varias veces seguidas el mismo proyecto cuenta una sola vez
    if (a.length && a[0].type === type && a[0].id === id && Date.now() - a[0].t < 600000) a.shift();
    a.unshift({ t: Date.now(), type: type, name: String(name || '').slice(0, 60), id: id || '' });
    try { localStorage.setItem(STORE_LOG, JSON.stringify(a.slice(0, 120))); } catch (e) { /* nada */ }
  }
  function curName() { var e = projectById(curId); return e ? e.name : 'Plano'; }

  /* ---------- inicio ---------- */
  function showHome() {
    saveNow();
    renderHome();
    $('home').hidden = false;
    $('app').setAttribute('aria-hidden', 'true');
  }
  function hideHome() { $('home').hidden = true; $('app').removeAttribute('aria-hidden'); resize(); }
  function renderHome() {
    var h = $('home-body');
    h.textContent = '';
    var hi = new Date().getHours(), saludo = hi < 12 ? 'Buenos días' : hi < 19 ? 'Buenas tardes' : 'Buenas noches';
    var cur = projectById(curId);
    h.appendChild(el('div', { class: 'home-head' }, [
      el('div', null, [el('h1', { text: saludo + (profile.name ? ', ' + profile.name.split(' ')[0] : '') }), el('p', { class: 'muted', text: profile.course ? profile.course : 'Planos para clase y diseño de interiores.' })]),
      el('div', { class: 'home-head-btns' }, [btn('Mi cuenta', showAccount), cur ? btn('Seguir con "' + cur.name + '" →', function () { hideHome(); }, 'primary') : null])
    ]));
    function card(title, desc, icon, fn) {
      var b = el('button', { class: 'start-card', type: 'button' }, [el('span', { class: 'sc-ico' }, [icon]), el('b', { text: title }), el('span', { text: desc })]);
      b.addEventListener('click', fn); return b;
    }
    h.appendChild(el('h2', { text: 'Empezar' }));
    h.appendChild(el('div', { class: 'start-grid' }, [
      card('Hoja de clase', 'Papel con cajetín, escala, minas y escuadras', gridIcon('sq'), function () { showTemplates('clase'); }),
      card('Diseño libre', 'Interiores, muebles y vista 3D', svgIcon('furn', 26), function () { showTemplates('libre'); }),
      card('Hoja en blanco', '18 × 24 lisa, tú escoges la cuadrícula', gridIcon('none'), function () { newGrid.type = 'none'; startClass('c-blank'); newGrid.type = 'tpl'; hideHome(); }),
      card('Abrir archivo', 'Un plano .json que guardaste', svgIcon('folder', 26), function () { $('file-open').click(); })
    ]));
    h.appendChild(el('div', { class: 'home-row' }, [el('h2', { text: 'Tus proyectos' }), el('span', { class: 'plan-tag', text: planText() })]));
    var filt = el('div', { class: 'seg', role: 'group', 'aria-label': 'Filtrar proyectos' });
    [['todos', 'Todos'], ['clase', 'Clase'], ['libre', 'Libre']].forEach(function (f) {
      var b = el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(homeFilter === f[0]), text: f[1] });
      b.addEventListener('click', function () { homeFilter = f[0]; renderHome(); });
      filt.appendChild(b);
    });
    h.appendChild(filt);
    var list = projects.filter(function (e) { return homeFilter === 'todos' || e.ws === homeFilter; }).slice().sort(function (a, b) { return b.updated - a.updated; });
    var grid = el('div', { class: 'proj-grid' });
    if (!list.length) grid.appendChild(el('p', { class: 'muted', text: 'Todavía no hay proyectos aquí.' }));
    list.forEach(function (e) {
      var isCur = e.id === curId;
      var thumb = e.thumb ? el('img', { src: e.thumb, alt: '' }) : el('div', { class: 'thumb-empty' });
      var open = el('button', { class: 'pc-open', type: 'button', 'aria-label': 'Abrir ' + e.name }, [thumb]);
      open.addEventListener('click', function () { if (!isCur) openProject(e.id); hideHome(); });
      var acts = el('div', { class: 'pc-acts' }, [
        btn('Abrir', function () { if (!isCur) openProject(e.id); hideHome(); }),
        btn('Duplicar', function () { duplicateProject(e.id); }),
        btn('Borrar', function () { deleteProject(e.id); }, 'danger')
      ]);
      grid.appendChild(el('div', { class: 'proj-card' + (isCur ? ' current' : '') }, [
        open,
        el('div', { class: 'pc-meta' }, [el('b', { text: e.name }), el('span', { class: 'badge ' + e.ws, text: e.ws === 'clase' ? 'Clase' : 'Libre' })]),
        el('div', { class: 'muted small', text: (isCur ? 'Abierto · ' : '') + 'editado ' + ago(e.updated) }),
        acts
      ]));
    });
    h.appendChild(grid);
    h.appendChild(el('h2', { text: 'Historial' }));
    var log = readLog().slice(0, 15), ul = el('ul', { class: 'log' });
    if (!log.length) ul.appendChild(el('li', { class: 'muted', text: 'Aquí verás lo que vas haciendo: proyectos que creas, abres, imprimes...' }));
    log.forEach(function (x) { ul.appendChild(el('li', null, [el('span', { text: LOG_TEXT[x.type] + ' "' + x.name + '"' }), el('span', { class: 'muted small', text: ago(x.t) })])); });
    h.appendChild(ul);
    var sk = el('input', { type: 'checkbox', id: 'home-skip' }); sk.checked = skipHome;
    sk.addEventListener('change', function () { skipHome = sk.checked; savePrefs(); });
    h.appendChild(el('label', { class: 'opt-check home-skip' }, [sk, document.createTextNode(' Al abrir Cota, ir directo a mi último proyecto')]));
  }
  var homeFilter = 'todos';

  /* ---------- mi cuenta ---------- */
  function showAccount() {
    var d = $('dlg-account'), b = $('acc-body');
    b.textContent = '';
    b.appendChild(el('h3', { text: 'Mi cuenta' }));
    b.appendChild(el('p', { class: 'muted', text: 'Tu cuenta vive en este navegador: tus proyectos, tu nombre y tu historial se guardan aquí. La cuenta en la nube (para verla en otro equipo) viene después; mientras tanto, descarga un respaldo y ábrelo donde quieras.' }));
    [['name', 'Nombre', 'Tu nombre (sale en el cajetín)'], ['course', 'Curso', 'Ej. Dibujo arquitectónico I'], ['school', 'Escuela', 'Tu universidad o college']].forEach(function (f) {
      var inp = el('input', { type: 'text', value: profile[f[0]] || '', maxlength: '60', placeholder: f[2], 'aria-label': f[1] });
      inp.addEventListener('change', function () { profile[f[0]] = inp.value.trim(); savePrefs(); requestRender(); if (!$('home').hidden) renderHome(); });
      b.appendChild(propRow(f[1], inp));
    });
    var nc = projects.filter(function (e) { return e.ws === 'clase'; }).length;
    var first = projects.reduce(function (m, e) { return Math.min(m, e.created || e.updated); }, Date.now());
    b.appendChild(el('div', { class: 'acc-stats' }, [
      el('div', null, [el('b', { text: String(projects.length) }), el('span', { text: 'proyectos' })]),
      el('div', null, [el('b', { text: String(nc) }), el('span', { text: 'de clase' })]),
      el('div', null, [el('b', { text: String(projects.length - nc) }), el('span', { text: 'libres' })]),
      el('div', null, [el('b', { text: new Date(first).toLocaleDateString('es', { month: 'short', year: 'numeric' }) }), el('span', { text: 'desde' })])
    ]));
    b.appendChild(propRow('Plan', valSpan(planText())));
    b.appendChild(el('div', { class: 'btn-row' }, [btn('Descargar respaldo', backupAll), btn('Restaurar respaldo', function () { $('file-backup').click(); }), btn('Borrar historial', function () {
      ask('¿Borrar el historial?', 'Tus proyectos no se borran, solo la lista de lo que hiciste.', { ok: 'Borrar' }).then(function (y) { if (y) { try { localStorage.removeItem(STORE_LOG); } catch (e) { /* nada */ } if (!$('home').hidden) renderHome(); toast('Historial borrado.'); } });
    }, 'danger')]));
    var close = el('button', { class: 'pill', type: 'button', text: 'Listo' });
    close.addEventListener('click', function () { d.close(); });
    b.appendChild(el('div', { class: 'dlg-actions' }, [close]));
    d.showModal();
  }
  function backupAll() {
    saveNow();
    var out = { app: 'cota-respaldo', version: 1, fecha: new Date().toISOString(), profile: profile, log: readLog(), projects: [] };
    projects.forEach(function (e) {
      var raw = null; try { raw = JSON.parse(localStorage.getItem(STORE_PROJECT + e.id) || 'null'); } catch (err) { raw = null; }
      if (raw) out.projects.push({ name: e.name, ws: e.ws, created: e.created, updated: e.updated, doc: raw });
    });
    download(new Blob([JSON.stringify(out)], { type: 'application/json' }), 'cota-respaldo-' + new Date().toISOString().slice(0, 10) + '.json');
    toast('Respaldo descargado con ' + out.projects.length + ' proyectos.');
  }
  function restoreBackup(data) {
    if (!data || data.app !== 'cota-respaldo' || !Array.isArray(data.projects)) { toast('Ese archivo no es un respaldo de Cota.'); return; }
    var ok = data.projects.map(function (p) { return { p: p, clean: cleanDoc(p.doc) }; }).filter(function (x) { return x.clean; });
    function go() {
      ok.forEach(function (x) {
        var id = registerProject(uniqueName(String(x.p.name || 'Proyecto').slice(0, 50)), x.clean);
        var e = projectById(id); if (e && isNum(x.p.created)) e.created = x.p.created;
      });
      saveIndex();
      if (data.profile && !profile.name) ['name', 'course', 'school'].forEach(function (k) { if (typeof data.profile[k] === 'string') profile[k] = data.profile[k].slice(0, 60); });
      savePrefs();
      logEvent('respaldo', ok.length + ' proyectos', '');
      toast('Listo: ' + ok.length + ' proyectos restaurados.');
      if (!$('home').hidden) renderHome();
      if ($('dlg-account').open) showAccount();
    }
    if (!pro && projects.length + ok.length > LIMITS.projects) { needPro('El respaldo trae ' + ok.length + ' proyectos y el plan gratis guarda hasta ' + LIMITS.projects + '.', go); return; }
    go();
  }
  $('file-backup').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { var d = null; try { d = JSON.parse(String(r.result)); } catch (err) { d = null; } restoreBackup(d); };
    r.readAsText(f);
  });
  $('btn-home').addEventListener('click', showHome);
  $('home-close').addEventListener('click', hideHome);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('home').hidden && !document.querySelector('dialog[open]')) hideHome(); });

  $('btn-new').addEventListener('click', function () { showTemplates(); });
  $('btn-proj').addEventListener('click', showHome);
  $('tpl-cancel').addEventListener('click', function () { $('dlg-new').close(); });
  $('proj-close').addEventListener('click', function () { $('dlg-proj').close(); });
  $('proj-new').addEventListener('click', function () { $('dlg-proj').close(); showTemplates(); });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNow(); });

  $('btn-save').addEventListener('click', function () {
    var payload = { app: 'cota', version: 3, units: units, layers: doc.layers, objects: doc.objects, nextId: doc.nextId, activeLayer: doc.activeLayer, levels: doc.levels, level: doc.level, ws: doc.ws, paper: doc.paper };
    var e = projectById(curId), base = (e ? e.name : 'plano-cota').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '-') || 'plano-cota';
    download(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }), base + '.json');
    logEvent('archivo', e ? e.name : base, curId);
    toast('Guardado como ' + base + '.json');
  });
  $('btn-open').addEventListener('click', function () { $('file-open').click(); });
  $('file-open').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var clean = null;
      try { clean = cleanDoc(JSON.parse(String(r.result))); } catch (err) { clean = null; }
      if (!clean) { toast('Ese archivo no es un plano de Cota.'); return; }
      function go() {
        saveNow();
        var name = uniqueName(f.name.replace(/\.json$/i, '').slice(0, 50) || 'Plano abierto');
        curId = registerProject(name, clean); savePrefs();
        loadDoc(clean, { message: 'Plano abierto como proyecto nuevo: ' + name });
        document.title = name + ' · Cota';
      }
      if (canAddProject(go)) go();
    };
    r.readAsText(f);
  });
  $('btn-png').addEventListener('click', function () {
    if (mode === '3d' && view3d) { export3D(); return; }
    if (clase()) { exportSheetPNG(); return; }
    render(true);
    cv.toBlob(function (blob) {
      render(false);
      if (blob) { download(blob, 'plano-cota.png'); toast('Imagen guardada como plano-cota.png'); }
    }, 'image/png');
  });

  /* ------------------------------------------------------------------ */
  /* Pisos                                                               */
  /* ------------------------------------------------------------------ */
  function rotateFurnTool() {
    furnRot = (furnRot + 90) % 360;
    refreshOptions(); requestRender();
  }

  function setLevel(id) {
    if (levelIndex(id) < 0 || id === doc.level) return;
    doc.level = id;
    selection.clear(); draft = null; roomCache = { key: '', mask: null };
    autosave(); uiSync(); requestRender();
  }

  function nextLevelId() {
    var n = 1;
    doc.levels.forEach(function (l) { var m = /^p(\d+)$/.exec(l.id); if (m) n = Math.max(n, parseInt(m[1], 10) + 1); });
    return 'p' + n;
  }

  /** Piso nuevo arriba de todos. Con copyWalls trae las paredes y aberturas del piso actual para calcar. */
  function addLevel(copyWalls) {
    if (doc.levels.length >= MAX_LEVELS) { toast('Máximo ' + MAX_LEVELS + ' pisos.'); return; }
    if (!pro && doc.levels.length >= LIMITS.levels) {
      needPro('El plan gratis incluye hasta ' + LIMITS.levels + ' pisos por proyecto. Con Cota Pro no hay límite.', function () { addLevel(copyWalls); });
      return;
    }
    var id = nextLevelId(), src = doc.level;
    doc.levels.push({ id: id, name: 'Piso ' + (doc.levels.length + 1) });
    if (copyWalls) {
      var map = {}, add = [];
      doc.objects.forEach(function (o) {
        if (o.lv !== src || o.type !== 'wall') return;
        var c = clone(o); c.id = doc.nextId++; c.lv = id; map[o.id] = c.id; add.push(c);
      });
      doc.objects.forEach(function (o) {
        if (o.lv !== src || (o.type !== 'door' && o.type !== 'window') || !map[o.wall]) return;
        var c = clone(o); c.id = doc.nextId++; c.lv = id; c.wall = map[o.wall]; add.push(c);
      });
      doc.objects = doc.objects.concat(add);
    }
    doc.level = id; selection.clear(); draft = null; roomCache = { key: '', mask: null };
    commit();
    toast(copyWalls ? 'Piso nuevo con las paredes del de abajo.' : 'Piso nuevo vacío. El de abajo se ve tenue de guía.');
  }

  function deleteLevel() {
    if (doc.levels.length < 2) return;
    var id = doc.level, name = levelName(id);
    var n = doc.objects.filter(function (o) { return o.lv === id; }).length;
    ask('¿Borrar "' + name + '"?', n ? 'Se borran sus ' + n + ' objetos. Puedes deshacer con Ctrl+Z.' : 'Está vacío.', { ok: 'Borrar piso' }).then(function (yes) {
      if (!yes) return;
      var idx = levelIndex(id);
      doc.objects = doc.objects.filter(function (o) { return o.lv !== id; });
      doc.levels.splice(idx, 1);
      doc.level = doc.levels[Math.max(0, idx - 1)].id;
      if (typeof s3.level === 'number' && s3.level >= doc.levels.length) s3.level = 'all';
      selection.clear(); roomCache = { key: '', mask: null };
      commit();
    });
  }

  function renderLevels() {
    var ul = $('levels');
    if (!ul) return;
    ul.textContent = '';
    doc.levels.slice().reverse().forEach(function (l) {
      var active = l.id === doc.level;
      var li = el('li', { class: 'layer' + (active ? ' active' : '') });
      var n = doc.objects.filter(function (o) { return o.lv === l.id && o.type !== 'dim'; }).length;
      var dot = el('span', { class: 'sw' }); dot.style.background = active ? 'var(--accent)' : 'var(--muted)';
      var name = el('input', { type: 'text', value: l.name, maxlength: '30', 'aria-label': 'Nombre del piso' });
      name.addEventListener('focus', function () { if (!active) setLevel(l.id); });
      name.addEventListener('change', function () { l.name = name.value.trim() || l.name; commit(); });
      name.addEventListener('keydown', function (e) { if (e.key === 'Enter') name.blur(); });
      li.addEventListener('click', function (e) { if (e.target === li || e.target === dot) setLevel(l.id); });
      li.appendChild(dot); li.appendChild(name); li.appendChild(el('span', { class: 'lvl-n', text: String(n) }));
      ul.appendChild(li);
    });
    var tools = $('level-tools');
    tools.textContent = '';
    var cp = el('button', { class: 'chip-btn', type: 'button', text: 'Piso nuevo con estas paredes' });
    cp.addEventListener('click', function () { addLevel(true); });
    tools.appendChild(cp);
    if (doc.levels.length > 1) {
      var del = el('button', { class: 'chip-btn danger', type: 'button', text: 'Borrar este piso' });
      del.addEventListener('click', deleteLevel);
      tools.appendChild(del);
    }

    var bar = $('levelbar');
    bar.textContent = '';
    doc.levels.forEach(function (l) {
      var b = el('button', { class: 'lvl-chip', type: 'button', text: l.name, 'aria-pressed': String(l.id === doc.level), title: 'Editar ' + l.name });
      b.addEventListener('click', function () { setLevel(l.id); });
      bar.appendChild(b);
    });
    var plus = el('button', { class: 'lvl-chip', type: 'button', text: '+ Piso', title: 'Añadir un piso arriba' });
    plus.addEventListener('click', function () { addLevel(false); });
    bar.appendChild(plus);
  }
  $('level-add').addEventListener('click', function () { addLevel(false); });

  /* ------------------------------------------------------------------ */
  /* Botones sueltos                                                     */
  /* ------------------------------------------------------------------ */
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('act-del').addEventListener('click', deleteSelection);
  $('act-dup').addEventListener('click', duplicateSelection);
  $('act-rot').addEventListener('click', rotateSelection);
  $('tb-done').addEventListener('click', function () { if (draft) finishDraft(); });
  $('tb-cancel').addEventListener('click', cancelDraft);
  $('tog-grid').addEventListener('click', toggleGrid);
  $('tog-snap').addEventListener('click', toggleSnap);
  $('tog-ortho').addEventListener('click', toggleOrtho);
  $('u-ft').addEventListener('click', function () { setUnits('ft'); });
  $('u-m').addEventListener('click', function () { setUnits('m'); });
  $('btn-theme').addEventListener('click', function () { applyTheme(theme === 'dark' ? 'light' : 'dark'); });
  $('btn-panel').addEventListener('click', function () { $('app').classList.toggle('panel-open'); });
  $('stage').addEventListener('pointerdown', function () { $('app').classList.remove('panel-open'); });

  /* ------------------------------------------------------------------ */
  /* Vista 3D                                                            */
  /* ------------------------------------------------------------------ */
  function visibleObjects() { return doc.objects.filter(layerShown); }
  function settings3() {
    return Object.assign({}, s3, {
      levels: doc.levels.map(function (l) { return l.id; }), levelNames: doc.levels.map(function (l) { return l.name; }),
      lvActive: Math.max(0, levelIndex(doc.level))
    });
  }

  function sync3D(reset) {
    if (!view3d) return;
    view3d.sync(visibleObjects(), settings3(), units, !!reset);
    renderCfg3();
  }

  function export3D() {
    if (!view3d) return;
    view3d.exportBlob(function (blob) {
      if (blob) { download(blob, 'cota-3d.png'); toast('Imagen 3D guardada como cota-3d.png'); }
    });
  }

  function setMode(m) {
    if (m === mode) return;
    if (m === '3d') {
      if (!window.THREE || !window.CotaModel3D || !window.CotaView3D) { toast('No se pudo cargar el motor 3D.'); return; }
      if (!view3d) {
        try { view3d = window.CotaView3D.create($('cv3')); }
        catch (e) { view3d = null; toast('Este navegador no pudo iniciar 3D (WebGL).'); return; }
      }
      draft = null; boxRect = null; ptr = null;
      mode = '3d';
      $('app').classList.add('mode-3d');
      $('app').classList.remove('panel-open');
      cv.hidden = true; $('cv3').hidden = false; $('cam3').hidden = false;
      resize();
      view3d.activate();
      view3d.sync(visibleObjects(), settings3(), units, false);
      cam3 = 'orbit';
      view3d.setCameraMode('orbit', true);
      if (!doc.objects.some(function (o) { return o.type === 'wall'; })) toast('Dibuja paredes en 2D y aparecen aquí en 3D.');
    } else {
      if (view3d) view3d.deactivate();
      mode = '2d';
      $('app').classList.remove('mode-3d');
      cv.hidden = false; $('cv3').hidden = true; $('cam3').hidden = true;
      resize();
    }
    uiSync(); requestRender();
  }

  function setCam(c) {
    if (mode !== '3d' || !view3d) return;
    cam3 = c;
    view3d.setCameraMode(c);
    uiSync();
  }

  var HINTS3 = {
    orbit: 'Arrastra para girar · Shift o clic derecho para mover · rueda o pellizco para acercar',
    top: 'Planta · arrastra para mover · rueda o pellizco para acercar',
    walk: 'Recorrido · toca el piso para caminar · arrastra para mirar · W A S D para moverte'
  };

  function syncModeUI() {
    $('m-2d').setAttribute('aria-pressed', String(mode === '2d'));
    $('m-3d').setAttribute('aria-pressed', String(mode === '3d'));
    ['orbit', 'top', 'walk'].forEach(function (c) { $('c-' + c).setAttribute('aria-pressed', String(cam3 === c)); });
    $('hint3').textContent = HINTS3[cam3] || '';
  }

  function fmtHour(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return ((hh % 12) || 12) + ':' + (mm < 10 ? '0' : '') + mm + (hh >= 12 && hh < 24 ? ' PM' : ' AM');
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function selectStr(options, value, onChange, label) {
    var sel = el('select', { 'aria-label': label });
    options.forEach(function (o) {
      var op = el('option', { value: o[0], text: o[1] });
      if (o[0] === value) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }
  function checkRow(value, onChange, label) {
    var cb = el('input', { type: 'checkbox', 'aria-label': label });
    cb.checked = !!value;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    return cb;
  }

  function cfg3Changed() { savePrefs(); sync3D(false); }

  function renderCfg3() {
    if (mode !== '3d') return;
    var box = $('cfg3');
    box.textContent = '';

    var hInp = el('input', { type: 'text', value: fmt(s3.wallH), 'aria-label': 'Altura de paredes' });
    hInp.addEventListener('change', function () {
      var m = U.parseLength(hInp.value, units);
      if (isNaN(m) || m < 1.5 || m > 8) { toast('La altura va de 5\' a 26\' (1.5 m a 8 m).'); hInp.value = fmt(s3.wallH); return; }
      s3.wallH = m; cfg3Changed();
    });
    hInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') hInp.blur(); });
    var hPre = selectEl([['Elegir', 0]].concat(HEIGHT_PRESETS[units].map(function (m) { return [fmt(m), m]; })), 0, function (v) {
      if (v > 0) { s3.wallH = v; cfg3Changed(); }
    }, 'Alturas comunes');
    box.appendChild(propRow('Altura', el('div', { class: 'dual' }, [hInp, hPre])));

    box.appendChild(propRow('Paredes', selectStr(WALL_OPTS, s3.wallColor, function (v) { s3.wallColor = v; cfg3Changed(); }, 'Color de paredes')));
    box.appendChild(propRow('Piso', selectStr(FLOOR_OPTS, s3.floor, function (v) { s3.floor = v; cfg3Changed(); }, 'Piso')));
    box.appendChild(propRow('Corte', selectEl([['Paredes completas', 0], [units === 'ft' ? 'Corte a 4\'' : 'Corte a 1.2 m', 1.2192], ['Solo bases', 0.3]], s3.cut, function (v) { s3.cut = v; cfg3Changed(); }, 'Corte de paredes')));
    box.appendChild(propRow('Puertas', selectEl([['Abiertas', 90], ['Cerradas', 0]], s3.doors, function (v) { s3.doors = v; cfg3Changed(); }, 'Puertas')));

    var lbl = el('span', { class: 'val', text: fmtHour(s3.hour) });
    var rng = el('input', { type: 'range', min: '6', max: '18', step: '0.25', value: String(s3.hour), 'aria-label': 'Hora del día' });
    rng.addEventListener('input', function () {
      s3.hour = parseFloat(rng.value);
      lbl.textContent = fmtHour(s3.hour);
      if (view3d) view3d.sync(visibleObjects(), settings3(), units, false);
    });
    rng.addEventListener('change', savePrefs);
    box.appendChild(propRow('Hora', el('div', { class: 'dual' }, [rng, lbl])));

    box.appendChild(propRow('Sombras', checkRow(s3.shadows, function (v) { s3.shadows = v; cfg3Changed(); }, 'Sombras')));
    if (doc.levels.length > 1) {
      var lvOpts = [['all', 'Todos los pisos']].concat(doc.levels.map(function (l, i) { return [String(i), 'Hasta ' + l.name]; }));
      box.appendChild(propRow('Ver', selectStr(lvOpts, s3.level === 'all' ? 'all' : String(s3.level), function (v) { s3.level = v === 'all' ? 'all' : parseInt(v, 10); cfg3Changed(); }, 'Pisos que se ven')));
    }
    box.appendChild(propRow('Techo', selectStr(ROOF_OPTS, s3.roof, function (v) { s3.roof = v; cfg3Changed(); }, 'Techo')));

    var info = view3d && view3d.info();
    if (info) {
      var parts = [plural(info.walls, 'pared', 'paredes'), plural(info.doors, 'puerta', 'puertas'), plural(info.windows, 'ventana', 'ventanas')];
      var line = el('div', { class: 'info3' });
      line.appendChild(document.createTextNode(parts.join(' · ')));
      line.appendChild(document.createElement('br'));
      if (info.rooms.length) {
        line.appendChild(document.createTextNode(plural(info.rooms.length, 'cuarto cerrado', 'cuartos cerrados') + ' · '));
        line.appendChild(el('b', { text: U.formatArea(info.area, units) }));
        if (info.levels && info.levels.length > 1) {
          info.levels.forEach(function (lv) {
            line.appendChild(document.createElement('br'));
            line.appendChild(document.createTextNode(lv.name + ': ' + plural(lv.rooms, 'cuarto', 'cuartos') + ' · ' + U.formatArea(lv.area, units)));
          });
        }
      } else if (info.walls) {
        line.appendChild(document.createTextNode('Sin cuartos cerrados: revisa que las paredes se toquen en las esquinas.'));
      } else {
        line.appendChild(document.createTextNode('Todavía no hay paredes.'));
      }
      box.appendChild(line);
    }
  }

  $('m-2d').addEventListener('click', function () { setMode('2d'); });
  $('m-3d').addEventListener('click', function () { setMode('3d'); });
  $('c-orbit').addEventListener('click', function () { setCam('orbit'); });
  $('c-top').addEventListener('click', function () { setCam('top'); });
  $('c-walk').addEventListener('click', function () { setCam('walk'); });
  $('c-fit').addEventListener('click', function () { if (view3d) view3d.fit(); });
  $('c-img').addEventListener('click', export3D);
  window.addEventListener('blur', function () { if (view3d) view3d.releaseKeys(); });

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  function boot() {
    var hadPrefs = loadPrefs();
    if (!hadPrefs && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    readColors();
    buildTools();

    // proyectos: si venimos de la versión de un solo dibujo, ese dibujo pasa a ser el primer proyecto
    loadIndex();
    var loaded = null, fromStore = true;
    if (!projects.length) {
      try { loaded = cleanDoc(JSON.parse(localStorage.getItem(STORE_DOC) || 'null')); } catch (e) { loaded = null; }
      if (!loaded) { loaded = cleanDoc(buildExample()); fromStore = false; }
      curId = registerProject(loaded && fromStore ? 'Mi primer plano' : 'Plano de ejemplo', loaded);
    } else {
      if (!projectById(curId)) curId = projects[0].id;
      try { loaded = cleanDoc(JSON.parse(localStorage.getItem(STORE_PROJECT + curId) || 'null')); } catch (e) { loaded = null; }
      if (!loaded) { loaded = cleanDoc(buildExample()); fromStore = false; }
    }
    doc = loaded;
    var cur = projectById(curId);
    if (cur) document.title = cur.name + ' · Cota';
    savePrefs();
    history = [snapshot()]; histIdx = 0;

    new ResizeObserver(resize).observe($('stage'));
    resize();
    cv.classList.add('select');
    uiSync();
    fitView();
    if (!skipHome) showHome();
    else if (!fromStore) toast('Este es un plano de ejemplo. Dibuja encima o usa Nuevo para empezar con una plantilla.');
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      if (mq.addEventListener) mq.addEventListener('change', function (ev) {
        var saved = null; try { saved = localStorage.getItem(STORE_PREFS); } catch (e) { /* nada */ }
        if (!saved) applyTheme(ev.matches ? 'light' : 'dark');
      });
    }
  }
  boot();

  // para depurar desde la consola del navegador
  window.__instScreen = function (id) { var g = instGeomOf(id); return g.outer.map(w2s); };
  window.Cota = {
    get projects() { return projects; }, get curId() { return curId; }, get pro() { return pro; },
    setLevel: setLevel, addLevel: addLevel, startFromTemplate: startFromTemplate, openProject: openProject, saveNow: saveNow,
    get furnKind() { return furnKind; }, set furnKind(v) { furnKind = v; }, get level() { return doc.level; },
    get doc() { return doc; }, get view() { return view; }, get mode() { return mode; }, get view3d() { return view3d; }, get s3() { return s3; }, setTool: setTool, fitView: fitView, setMode: setMode, setCam: setCam };
})();
