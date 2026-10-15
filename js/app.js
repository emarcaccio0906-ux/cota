/* Cota — editor de planos 2D con vista 3D, muebles, varios pisos y proyectos.
 * Todo en un solo archivo, sin dependencias. Unidades internas: metros, Y hacia arriba. */
(function () {
  'use strict';

  var U = window.CotaUnits;
  var G = window.CotaGeom;
  var F = window.CotaFurn;
  var TPL = window.CotaTemplates;
  var M3 = window.CotaModel3D;

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
  var TYPE_NAMES = { line: 'Línea', polyline: 'Polilínea', rect: 'Rectángulo', circle: 'Círculo', wall: 'Pared', door: 'Puerta', window: 'Ventana', dim: 'Cota', furn: 'Mueble', room: 'Cuarto' };

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
    { id: 'room', key: 'q', label: 'Cuarto', name: 'Cuarto: nombre y área' },
    { id: 'furn', key: 'u', label: 'Mueble', name: 'Muebles y escaleras' },
    'sep',
    { id: 'fit', key: 'f', label: 'Todo', name: 'Ver todo el dibujo', action: true }
  ];

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */
  var doc = { layers: [], objects: [], nextId: 1, activeLayer: 'dibujo', levels: [{ id: 'p1', name: 'Planta baja' }], level: 'p1' };
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
    if (!gridCfg.step) return autoStep();
    var mult = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (var i = 0; i < mult.length; i++) if (gridCfg.step * mult[i] * view.scale >= 8) return gridCfg.step * mult[i];
    return gridCfg.step * 5000;
  }
  function snapStep() { return gridCfg.snapStep > 0 ? gridCfg.snapStep : gridStep(); }

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
          if (ok) { base.wall = o.wall; base.pos = o.pos; base.w = o.w; base.flip = !!o.flip; if (o.roll && o.type === 'door') base.roll = true; }
          break;
        case 'furn':
          ok = isPt(o.p) && isNum(o.w) && o.w > 0.05 && isNum(o.d) && o.d > 0.05 && typeof o.kind === 'string';
          if (ok) { base.kind = String(o.kind).slice(0, 40); base.p = o.p.slice(); base.w = o.w; base.d = o.d; base.ang = isNum(o.ang) ? ((o.ang % 360) + 360) % 360 : 0; }
          break;
        case 'room':
          ok = isPt(o.p);
          if (ok) { base.p = o.p.slice(); base.name = String(o.name || 'Cuarto').slice(0, 60); }
          break;
        default: ok = false;
      }
      if (!ok) return;
      seen[base.id] = true;
      maxId = Math.max(maxId, base.id);
      objects.push(base);
    });
    objects = objects.filter(function (o) { return (o.type !== 'door' && o.type !== 'window') || wallIds[o.wall]; });
    var active = layerIds[raw.activeLayer] ? raw.activeLayer : layers[0].id;
    return {
      layers: layers, objects: objects, nextId: Math.max(maxId + 1, isNum(raw.nextId) ? Math.floor(raw.nextId) : 1), activeLayer: active,
      levels: levels, level: lvSeen[raw.level] ? raw.level : levels[0].id
    };
  }

  /* ------------------------------------------------------------------ */
  /* Historial y guardado                                                */
  /* ------------------------------------------------------------------ */
  function snapshot() { return JSON.stringify({ layers: doc.layers, objects: doc.objects, nextId: doc.nextId, activeLayer: doc.activeLayer, levels: doc.levels, level: doc.level }); }

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
    doc = { layers: d.layers, objects: d.objects, nextId: d.nextId, activeLayer: d.activeLayer, levels: d.levels || [{ id: 'p1', name: 'Planta baja' }], level: d.level || 'p1' };
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
      if (e) { e.updated = Date.now(); e.thumb = thumbOf(doc); saveIndex(); }
    } catch (err) { toast('No hay espacio para guardar en este navegador. Descarga el plano con Guardar.'); }
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORE_PREFS, JSON.stringify({
        units: units, theme: theme, snapOn: snapOn, orthoOn: orthoOn, settings: settings, grid: gridCfg, polar: polarInc,
        precision: precision, s3: s3, cur: curId, pro: pro, areas: showAreas, furn: { kind: furnKind, align: furnAlign }
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
        if (p.grid && typeof p.grid.show === 'boolean' && isNum(p.grid.step) && p.grid.step >= 0 && isNum(p.grid.snapStep) && p.grid.snapStep >= 0 && [2, 4, 5, 8, 10].indexOf(p.grid.major) >= 0) gridCfg = p.grid;
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
    ctx.fillStyle = colors.canvas;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawAxes();

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

    if (!clean) {
      selection.forEach(function (id) {
        var o = map[id];
        if (o && isVisible(o)) drawObject(o, map, byWall, { sel: true });
      });
      drawDraft(map);
      drawBox();
      drawSnapMarker();
    }
  }

  function drawGrid() {
    if (!gridCfg.show) return;
    var step = gridStep();
    var a = s2w(0, H), b = s2w(W, 0);
    var i0 = Math.floor(a[0] / step), i1 = Math.ceil(b[0] / step);
    var j0 = Math.floor(a[1] / step), j1 = Math.ceil(b[1] / step);
    var minor = new Path2D(), major = new Path2D();
    var i, j, s, path;
    for (i = i0; i <= i1; i++) {
      s = Math.round(w2s([i * step, 0])[0]) + 0.5;
      path = (i % gridCfg.major === 0) ? major : minor;
      path.moveTo(s, 0); path.lineTo(s, H);
    }
    for (j = j0; j <= j1; j++) {
      s = Math.round(w2s([0, j * step])[1]) + 0.5;
      path = (j % gridCfg.major === 0) ? major : minor;
      path.moveTo(0, s); path.lineTo(W, s);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors['grid-minor']; ctx.stroke(minor);
    ctx.strokeStyle = colors['grid-major']; ctx.stroke(major);
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
    var lw = sel ? 2.6 : 1.6;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);

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
      default: break;
    }
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
    box(0, 0, o.w, o.d);
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
        drawTag(fmt(dirLen) + '  ∠ ' + (Math.round(ang * 10) / 10) + '°' + (mouse.polar !== null ? '  polar' : ''), S[0], S[1], true);
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
      drawTag('R ' + fmt(r), S2[0], S2[1], true);
    } else if (draft.tool === 'dim') {
      if (pts.length === 1) {
        ctx.setLineDash([6, 5]); pathPoly([last, p], false); ctx.stroke(); ctx.setLineDash([]); dot(last);
        S = w2s(p); drawTag(fmt(G.dist(last, p)), S[0], S[1], true);
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
    if (tool === 'select' || tool === 'pan' || tool === 'door' || tool === 'window' || tool === 'furn' || tool === 'room') return;
    if (!snapOn && !draft) return;
    var s = w2s(mouse.p), k = mouse.snap.kind;
    ctx.strokeStyle = colors.accent; ctx.fillStyle = colors.accent; ctx.lineWidth = 1.8; ctx.setLineDash([]);
    if (k === 'end') { ctx.strokeRect(s[0] - 6, s[1] - 6, 12, 12); }
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
    var s;
    if (snapOn) s = G.findSnap(mouse.raw, snapTargets(), { tol: SNAP_PX / view.scale, grid: snapStep(), useGrid: true });
    else s = { p: mouse.raw.slice(), kind: 'free' };
    var p = s.p;
    var last = lastDraftPoint();
    var ortho = orthoOn !== !!shift;
    var lineTool = tool === 'line' || tool === 'wall' || tool === 'polyline';
    mouse.polar = null;
    if (ortho && last && lineTool && s.kind !== 'end' && s.kind !== 'mid') {
      p = G.orthoPoint(last, p);
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

  function placeAt() {
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
  function needsInput() { return tool !== 'select' && tool !== 'pan' && tool !== 'dim' && tool !== 'furn' && tool !== 'room'; }

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
    if (tool === 'line' || tool === 'polyline' || tool === 'rect' || tool === 'circle') {
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
    var box = $('gridcfg');
    box.textContent = '';
    box.appendChild(propRow('Espaciado', stepSelect(gridCfg.step, 'Automático', 'Espaciado de la cuadrícula', function (v) { gridCfg.step = v; cfgChanged(); })));
    var other = el('input', { type: 'text', placeholder: units === 'ft' ? 'Otro: 8" o 2\'6"' : 'Otro: 25cm o 0.4', 'aria-label': 'Otro espaciado' });
    other.addEventListener('change', function () {
      var m = U.parseLength(other.value, units);
      other.value = '';
      if (isNaN(m) || m < 0.002) { toast('Medida no válida.'); return; }
      gridCfg.step = m; cfgChanged();
    });
    other.addEventListener('keydown', function (e) { if (e.key === 'Enter') other.blur(); });
    box.appendChild(propRow('Otro', other));
    box.appendChild(propRow('Líneas gruesas', selectEl([['Cada 2', 2], ['Cada 4', 4], ['Cada 5', 5], ['Cada 8', 8], ['Cada 10', 10]], gridCfg.major, function (v) { gridCfg.major = v; cfgChanged(); }, 'Líneas gruesas')));
    box.appendChild(propRow('Paso del snap', stepSelect(gridCfg.snapStep, 'Igual a la cuadrícula', 'Paso del snap', function (v) { gridCfg.snapStep = v; cfgChanged(); })));
    box.appendChild(propRow('Ángulo polar', selectEl([['Apagado', 0], ['15°', 15], ['30°', 30], ['45°', 45], ['90°', 90]], polarInc, function (v) { polarInc = v; cfgChanged(); }, 'Ángulo polar')));
    box.appendChild(propRow('Áreas', checkRow(showAreas, function (v) { showAreas = v; savePrefs(); requestRender(); renderProps(); }, 'Mostrar el área de cada cuarto')));
    var precOpts = units === 'ft'
      ? [['1"', 1], ['1/2"', 2], ['1/4"', 4], ['1/8"', 8], ['1/16"', 16]]
      : [['Automática', 0], ['0.1 m', 1], ['0.01 m (cm)', 2], ['0.001 m (mm)', 3]];
    box.appendChild(propRow('Precisión', selectEl(precOpts, units === 'ft' ? precision.ft : precision.m, function (v) {
      if (units === 'ft') precision.ft = v; else precision.m = v;
      cfgChanged();
    }, 'Precisión de las medidas')));
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
      return;
    }
    var o = list[0], map = idMap();
    box.appendChild(propRow('Tipo', valSpan(TYPE_NAMES[o.type] || o.type)));
    box.appendChild(propRow('Capa', lsel));
    switch (o.type) {
      case 'line':
        box.appendChild(propRow('Largo', valSpan(fmt(G.dist(o.a, o.b)))));
        box.appendChild(propRow('Ángulo', valSpan((Math.round(((Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]) * 180 / Math.PI) + 360) % 360 * 10) / 10) + '°')));
        break;
      case 'polyline':
        box.appendChild(propRow('Largo total', valSpan(fmt(G.polyLength(o.pts, o.closed)))));
        if (o.closed) box.appendChild(propRow('Área', valSpan(U.formatArea(G.polyArea(o.pts), units))));
        box.appendChild(propRow('Puntos', valSpan(String(o.pts.length))));
        break;
      case 'rect':
        box.appendChild(propRow('Ancho', valSpan(fmt(Math.abs(o.b[0] - o.a[0])))));
        box.appendChild(propRow('Alto', valSpan(fmt(Math.abs(o.b[1] - o.a[1])))));
        box.appendChild(propRow('Área', valSpan(U.formatArea(Math.abs((o.b[0] - o.a[0]) * (o.b[1] - o.a[1])), units))));
        break;
      case 'circle':
        box.appendChild(propRow('Radio', valSpan(fmt(o.r))));
        box.appendChild(propRow('Diámetro', valSpan(fmt(o.r * 2))));
        box.appendChild(propRow('Área', valSpan(U.formatArea(Math.PI * o.r * o.r, units))));
        break;
      case 'wall':
        box.appendChild(propRow('Largo', valSpan(fmt(G.dist(o.a, o.b)))));
        box.appendChild(propRow('Espesor', editField(fmt(o.t), function (m) { o.t = m; })));
        break;
      case 'door': case 'window':
        box.appendChild(propRow('Ancho', editField(fmt(o.w), function (m) {
          var wl = map[o.wall]; var L = wl ? G.dist(wl.a, wl.b) : 0;
          if (m > L) { toast('La pared es más corta que esa abertura.'); return; }
          o.w = m; o.pos = G.clamp(o.pos, m / 2, L - m / 2);
        })));
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
          F.CATALOG.forEach(function (c) { var op = el('option', { value: c.id, text: c.name }); if (c.id === o.kind) op.selected = true; ksel.appendChild(op); });
          ksel.addEventListener('change', function () { var c = F.get(ksel.value); if (!c) return; o.kind = c.id; o.w = c.w; o.d = c.d; commit(); });
          box.appendChild(propRow('Mueble', ksel));
        }
        box.appendChild(propRow('Ancho', editField(fmt(o.w), function (m) { o.w = m; })));
        box.appendChild(propRow(o.kind === 'escalera' ? 'Largo' : 'Fondo', editField(fmt(o.d), function (m) { o.d = m; })));
        var ai = el('input', { type: 'text', value: String(Math.round((o.ang || 0) * 10) / 10) + '°', 'aria-label': 'Ángulo' });
        ai.addEventListener('change', function () {
          var v = parseFloat(ai.value);
          if (isNaN(v)) { toast('Escribe el ángulo en grados.'); ai.value = (o.ang || 0) + '°'; return; }
          o.ang = ((v % 360) + 360) % 360; commit();
        });
        ai.addEventListener('keydown', function (e) { if (e.key === 'Enter') ai.blur(); });
        box.appendChild(propRow('Ángulo', ai));
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
        break;
      default: break;
    }
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
    refreshOptions();
    renderLayers();
    renderGridCfg();
    renderLevels();
    renderProps();
    syncModeUI();
    renderCfg3();
    updateReadout();
  }

  function toggleGrid() { gridCfg.show = !gridCfg.show; savePrefs(); uiSync(); requestRender(); }
  function toggleSnap() { snapOn = !snapOn; savePrefs(); uiSync(); updateCursor(mouse.sx, mouse.sy, shiftDown); requestRender(); }
  function toggleOrtho() { orthoOn = !orthoOn; savePrefs(); uiSync(); updateCursor(mouse.sx, mouse.sy, shiftDown); requestRender(); }

  function setUnits(u) { units = u; savePrefs(); uiSync(); requestRender(); if (mode === '3d') sync3D(false); }

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
      drawMini(c2, d);
      return c2.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ---------- proyectos (se guardan en este navegador) ---------- */
  function loadIndex() {
    projects = [];
    try {
      var a = JSON.parse(localStorage.getItem(STORE_INDEX) || '[]');
      if (Array.isArray(a)) projects = a.filter(function (e) { return e && typeof e.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(e.id); })
        .map(function (e) { return { id: e.id, name: String(e.name || 'Proyecto').slice(0, 60), updated: isNum(e.updated) ? e.updated : Date.now(), thumb: typeof e.thumb === 'string' && e.thumb.indexOf('data:image/png') === 0 ? e.thumb : '' }; });
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
    projects.unshift({ id: id, name: name, updated: Date.now(), thumb: thumbOf(clean) });
    saveIndex();
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
    document.title = e.name + ' · Cota';
  }
  function startFromTemplate(id) {
    var t = TPL.build(id), item = TPL.LIST.filter(function (x) { return x.id === id; })[0];
    if (!t || !item) return;
    if (!canAddProject(function () { startFromTemplate(id); })) return;
    var clean = cleanDoc({ layers: defaultLayers(), objects: t.objects, nextId: t.nextId, activeLayer: 'dibujo', levels: t.levels, level: t.level });
    saveNow();
    var name = uniqueName(item.name);
    curId = registerProject(name, clean);
    savePrefs();
    loadDoc(clean, { message: id === 'blank' ? 'Proyecto nuevo. Empieza con Pared o Línea.' : 'Plantilla "' + item.name + '" lista. Cámbiala como quieras.' });
    document.title = name + ' · Cota';
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
    renderProjects();
  }
  function deleteProject(id) {
    var e = projectById(id);
    if (!e) return;
    ask('¿Borrar "' + e.name + '"?', 'Se borra de este navegador y no se puede deshacer. Si lo quieres conservar, usa Guardar primero.', { ok: 'Borrar' }).then(function (yes) {
      if (!yes) return;
      try { localStorage.removeItem(STORE_PROJECT + id); } catch (err) { /* nada */ }
      projects = projects.filter(function (p) { return p.id !== id; });
      saveIndex();
      if (id === curId) {
        if (projects.length) { curId = ''; openProject(projects[0].id); }
        else { curId = ''; startFromTemplate('blank'); }
      }
      renderProjects();
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
  function showTemplates() {
    var grid = $('tpl-grid');
    grid.textContent = '';
    TPL.LIST.forEach(function (item) {
      var t = TPL.build(item.id);
      var c2 = el('canvas', { width: '320', height: '220' });
      drawMini(c2, { objects: t.objects, levels: t.levels });
      var b = el('button', { class: 'tpl', type: 'button' }, [c2, el('b', { text: item.name }), el('span', { text: item.desc })]);
      b.addEventListener('click', function () { $('dlg-new').close(); startFromTemplate(item.id); });
      grid.appendChild(b);
    });
    $('dlg-new').showModal();
  }

  $('btn-new').addEventListener('click', showTemplates);
  $('btn-proj').addEventListener('click', showProjects);
  $('tpl-cancel').addEventListener('click', function () { $('dlg-new').close(); });
  $('proj-close').addEventListener('click', function () { $('dlg-proj').close(); });
  $('proj-new').addEventListener('click', function () { $('dlg-proj').close(); showTemplates(); });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNow(); });

  $('btn-save').addEventListener('click', function () {
    var payload = { app: 'cota', version: 2, units: units, layers: doc.layers, objects: doc.objects, nextId: doc.nextId, activeLayer: doc.activeLayer, levels: doc.levels, level: doc.level };
    var e = projectById(curId), base = (e ? e.name : 'plano-cota').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '-') || 'plano-cota';
    download(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }), base + '.json');
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
    if (!fromStore) toast('Este es un plano de ejemplo. Dibuja encima o usa Nuevo para empezar con una plantilla.');
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
  window.Cota = {
    get projects() { return projects; }, get curId() { return curId; }, get pro() { return pro; },
    setLevel: setLevel, addLevel: addLevel, startFromTemplate: startFromTemplate, openProject: openProject, saveNow: saveNow,
    get furnKind() { return furnKind; }, set furnKind(v) { furnKind = v; }, get level() { return doc.level; },
    get doc() { return doc; }, get view() { return view; }, get mode() { return mode; }, get view3d() { return view3d; }, get s3() { return s3; }, setTool: setTool, fitView: fitView, setMode: setMode, setCam: setCam };
})();
