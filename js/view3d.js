/* Cota — vista 3D con Three.js (r128).
 * Recibe los objetos del plano, arma la escena (paredes, aberturas, piso, techo, sol con sombras)
 * y maneja tres cámaras: órbita, planta y recorrido. Solo corre en el navegador. */
(function (root) {
  'use strict';

  var THREE = root.THREE;
  var M = root.CotaModel3D;

  var WALL_COLORS = {
    blanco: 0xf1efe9, crema: 0xe6d9bd, concreto: 0x9a9c9b,
    gris: 0x4b5056, ladrillo: 0xa6523b, pizarra: 0x485a70
  };
  var FLOOR_KINDS = {
    'madera-clara': { rough: 0.55 }, 'madera-oscura': { rough: 0.5 }, concreto: { rough: 0.85 },
    'baldosa-blanca': { rough: 0.3 }, 'baldosa-gris': { rough: 0.35 }
  };
  var EYE = 1.65;
  var FT = 0.3048;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- texturas de piso (se pintan con canvas) ---------------- */
  function paintFloor(g, kind, W, H, ppm) {
    var rnd = mulberry32(7), x, y, i;
    if (kind === 'madera-clara' || kind === 'madera-oscura') {
      var dark = kind === 'madera-oscura';
      var hue = dark ? 22 : 31, sat = dark ? 36 : 42, lig = dark ? 29 : 60;
      var pw = 0.14 * ppm, pl = 1.5 * ppm;
      g.fillStyle = dark ? '#1f140d' : '#5d4a37';
      g.fillRect(0, 0, W, H);
      for (y = 0; y < H; y += pw) {
        x = -rnd() * pl;
        while (x < W) {
          var len = pl * (0.7 + rnd() * 0.6);
          g.fillStyle = 'hsl(' + (hue + (rnd() - 0.5) * 7) + ',' + (sat + (rnd() - 0.5) * 8) + '%,' + (lig + (rnd() - 0.5) * 9) + '%)';
          g.fillRect(x + 0.6, y + 0.6, len - 1.2, pw - 1.2);
          g.globalAlpha = 0.09; g.fillStyle = '#000';
          for (i = 0; i < 5; i++) g.fillRect(x + rnd() * len * 0.2, y + rnd() * pw, len * (0.5 + rnd() * 0.5), Math.max(1, pw * 0.04));
          g.globalAlpha = 1;
          x += len;
        }
      }
    } else if (kind === 'concreto') {
      g.fillStyle = '#8d9093'; g.fillRect(0, 0, W, H);
      for (i = 0; i < 60; i++) {
        var cx = rnd() * W, cy = rnd() * H, r = (0.3 + rnd() * 1.2) * ppm;
        var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        var tone = rnd() > 0.5 ? '255,255,255' : '0,0,0';
        gr.addColorStop(0, 'rgba(' + tone + ',0.07)'); gr.addColorStop(1, 'rgba(' + tone + ',0)');
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      for (i = 0; i < 14000; i++) {
        g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (0.03 + rnd() * 0.07) + ')';
        g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = Math.max(1, ppm * 0.01);
      for (x = 0; x < W; x += 2.4 * ppm) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (y = 0; y < H; y += 2.4 * ppm) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    } else {
      var white = kind === 'baldosa-blanca';
      var ts = 0.6 * ppm, gr2 = Math.max(1.5, ppm * 0.008);
      g.fillStyle = white ? '#9b9d9f' : '#2d3135';
      g.fillRect(0, 0, W, H);
      for (y = 0; y < H; y += ts) {
        for (x = 0; x < W; x += ts) {
          var l = white ? 90 + (rnd() - 0.5) * 3 : 41 + (rnd() - 0.5) * 4;
          g.fillStyle = 'hsl(' + (white ? 40 : 215) + ',' + (white ? 6 : 6) + '%,' + l + '%)';
          g.fillRect(x + gr2 / 2, y + gr2 / 2, ts - gr2, ts - gr2);
        }
      }
    }
  }

  function maskCanvas(mask) {
    var c = document.createElement('canvas');
    c.width = mask.nx; c.height = mask.ny;
    var g = c.getContext('2d');
    var img = g.createImageData(mask.nx, mask.ny), i, j, row, idx;
    for (j = 0; j < mask.ny; j++) {
      row = mask.ny - 1 - j;              // la fila 0 de la imagen es el norte
      for (i = 0; i < mask.nx; i++) {
        if (mask.floor[j * mask.nx + i]) { idx = (row * mask.nx + i) * 4; img.data[idx + 3] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function maskedTexture(mask, mc, painter, anisotropy) {
    var ww = mask.nx * mask.cell, hh = mask.ny * mask.cell;
    var ppm = Math.min(160, 2048 / Math.max(ww, hh));
    var W = Math.max(16, Math.round(ww * ppm)), H = Math.max(16, Math.round(hh * ppm));
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    painter(g, W, H, ppm);
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = false;
    g.drawImage(mc, 0, 0, W, H);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = anisotropy;
    return tex;
  }

  /* ---------------- vista ---------------- */
  function create(canvas) {
    if (!THREE || !M) throw new Error('Falta Three.js');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.05, 3000);
    camera.rotation.order = 'YXZ';
    var hemi = new THREE.HemisphereLight(0xcfe3f7, 0x8a8478, 0.6);
    var sun = new THREE.DirectionalLight(0xfff1dc, 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(hemi, sun, sun.target);
    var group = new THREE.Group();
    scene.add(group);

    var cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e5);
    function mat(color, rough, metal) {
      var m = new THREE.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal || 0 });
      m.clippingPlanes = [cutPlane]; m.clipShadows = true;
      return m;
    }
    var mats = {
      wall: mat(WALL_COLORS.blanco, 0.92),
      trim: mat(0xf5f4f0, 0.6),
      frame: mat(0x2b2f35, 0.45, 0.5),
      leaf: mat(0xb48a60, 0.55),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fc6e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false })
    };
    mats.glass.clippingPlanes = [cutPlane];

    // suelo exterior con cuadrícula de referencia
    var groundMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true;
    scene.add(ground);

    var st = {
      active: false, units: 'ft', objects: [], s: null, model: null, mask: null, info: null,
      mode: 'orbit', raf: 0, anim: null, keys: {}, lastT: 0, floorKey: ''
    };
    var orbit = { target: new THREE.Vector3(), theta: 0.61, phi: 1.0, radius: 20 };
    var walk = { pos: new THREE.Vector3(0, EYE, 0), yaw: 0, pitch: 0 };

    /* ---- escena ---- */
    function disposeGroup() {
      group.children.slice().forEach(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.userData.own) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        group.remove(o);
      });
    }

    function boundsInfo() {
      var b = st.model && st.model.bounds;
      if (!b) return { cx: 0, cz: 0, w: 10, d: 10, r: 8 };
      var w = b.maxx - b.minx, d = b.maxy - b.miny;
      return { cx: (b.minx + b.maxx) / 2, cz: -(b.miny + b.maxy) / 2, w: w, d: d, r: Math.hypot(w, d) / 2 };
    }

    function updateGround() {
      var unit = st.units === 'ft' ? 4 * FT : 1;
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var g = c.getContext('2d');
      g.fillStyle = '#b4bbae'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256);
      var tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1500 / unit, 1500 / unit); tex.anisotropy = aniso;
      if (groundMat.map) groundMat.map.dispose();
      groundMat.map = tex; groundMat.needsUpdate = true;
    }

    function addPart(p) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(p.len, p.h1 - p.h0, p.thick), mats[p.kind]);
      mesh.position.set(p.c[0], (p.h0 + p.h1) / 2, -p.c[1]);
      mesh.rotation.y = p.ang;
      mesh.castShadow = p.kind !== 'glass';
      mesh.receiveShadow = p.kind !== 'glass';
      group.add(mesh);
    }

    function rebuild() {
      disposeGroup();
      var s = st.s;
      st.model = M.build(st.objects, { wallH: s.wallH, doorAngle: s.doors });
      st.model.parts.forEach(addPart);
      st.mask = st.model.walls.length ? M.floorMask(st.model.walls, {}) : null;

      var rooms = st.mask && st.mask.ok ? st.mask.rooms : [];
      st.info = {
        walls: st.model.stats.walls, doors: st.model.stats.doors, windows: st.model.stats.windows,
        rooms: rooms.map(function (r) { return r.area; }),
        area: rooms.reduce(function (a, r) { return a + r.area; }, 0)
      };

      if (st.mask && st.mask.ok) {
        var mk = st.mask, mc = maskCanvas(mk);
        var ww = mk.nx * mk.cell, hh = mk.ny * mk.cell;
        var kind = FLOOR_KINDS[s.floor] ? s.floor : 'madera-clara';
        var floorMat = new THREE.MeshStandardMaterial({
          map: maskedTexture(mk, mc, function (g, W, H, ppm) { paintFloor(g, kind, W, H, ppm); }, aniso),
          alphaTest: 0.5, roughness: FLOOR_KINDS[kind].rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        });
        var floor = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(mk.ox + ww / 2, 0.003, -(mk.oy + hh / 2));
        floor.receiveShadow = true; floor.userData.own = true;
        group.add(floor);

        var ceilMat = new THREE.MeshStandardMaterial({
          map: maskedTexture(mk, mc, function (g, W, H) { g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, W, H); }, aniso),
          alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide
        });
        var ceil = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), ceilMat);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(mk.ox + ww / 2, s.wallH + 0.001, -(mk.oy + hh / 2));
        ceil.castShadow = true; ceil.receiveShadow = true; ceil.userData.own = true; ceil.userData.ceiling = true;
        group.add(ceil);
      }
      applyLook();
      applySun();
      refreshCeiling();
    }

    function refreshCeiling() {
      group.children.forEach(function (o) {
        if (o.userData.ceiling) o.visible = !!st.s.roof || st.mode === 'walk';
      });
    }

    /* ---- apariencia y sol ---- */
    function applyLook() {
      var s = st.s;
      mats.wall.color.setHex(WALL_COLORS[s.wallColor] != null ? WALL_COLORS[s.wallColor] : WALL_COLORS.blanco);
      mats.wall.roughness = s.wallColor === 'concreto' ? 0.97 : 0.9;
      cutPlane.constant = s.cut > 0 ? s.cut : 1e5;
      renderer.shadowMap.enabled = !!s.shadows;
      sun.castShadow = !!s.shadows;
      var key = (s.shadows ? 1 : 0) + '|' + (s.cut > 0 ? 1 : 0);
      if (key !== st.lookKey) {          // solo hay que recompilar los shaders si cambia esto
        st.lookKey = key;
        Object.keys(mats).forEach(function (k) { mats[k].needsUpdate = true; });
        group.traverse(function (o) { if (o.material) o.material.needsUpdate = true; });
      }
    }

    function applySun() {
      var h = clamp(st.s.hour, 6, 18), t = (h - 6) / 12;
      var elev = (6 + 64 * Math.sin(Math.PI * t)) * Math.PI / 180;
      var dir = new THREE.Vector3(Math.cos(Math.PI * t) * Math.cos(elev), Math.sin(elev), Math.sin(Math.PI * t) * Math.cos(elev));
      var b = boundsInfo(), R = Math.max(6, b.r * 1.35);
      var center = new THREE.Vector3(b.cx, 0, b.cz);
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(dir, R * 4 + 30);
      var cam = sun.shadow.camera;
      cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 1; cam.far = R * 10 + 80;
      cam.updateProjectionMatrix();

      var k = smooth((elev * 180 / Math.PI - 6) / 30);
      var sky = new THREE.Color(0xf0b88a).lerp(new THREE.Color(0xbcd9f1), k);
      scene.background = sky;
      scene.fog = new THREE.Fog(sky.getHex(), 120, 520);
      hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.45);
      hemi.intensity = 0.5 + 0.22 * Math.sin(elev);
      sun.color.setRGB(1, 0.76 + 0.2 * k, 0.55 + 0.35 * k);
      sun.intensity = 0.3 + 1.3 * Math.sin(elev);
    }

    /* ---- cámara ---- */
    function applyOrbit() {
      var o = orbit, sp = Math.sin(o.phi);
      camera.position.set(o.target.x + o.radius * sp * Math.sin(o.theta), o.target.y + o.radius * Math.cos(o.phi), o.target.z + o.radius * sp * Math.cos(o.theta));
      camera.lookAt(o.target);
    }
    function applyWalk() {
      camera.position.copy(walk.pos);
      camera.rotation.set(walk.pitch, walk.yaw, 0);
    }
    function applyCamera() { if (st.mode === 'walk') applyWalk(); else applyOrbit(); }

    function fitRadius(top) {
      var b = boundsInfo(), t = Math.tan(camera.fov * Math.PI / 360);
      if (top) return Math.max((b.d / 2) / t, (b.w / 2) / (t * camera.aspect)) * 1.18 + st.s.wallH;
      return Math.max(b.r * 0.95 / t, 4);
    }
    function targetPoint() {
      var b = boundsInfo();
      return new THREE.Vector3(b.cx, st.mode === 'top' ? 0 : st.s.wallH * 0.3, b.cz);
    }

    function tweenOrbit(to, ms) {
      st.anim = {
        t0: performance.now(), dur: ms || 500,
        from: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z, theta: orbit.theta, phi: orbit.phi, radius: orbit.radius },
        to: to
      };
      var d = to.theta - orbit.theta;
      while (d > Math.PI) { to.theta -= 2 * Math.PI; d = to.theta - orbit.theta; }
      while (d < -Math.PI) { to.theta += 2 * Math.PI; d = to.theta - orbit.theta; }
      requestRender();
    }
    function setOrbitNow(to) {
      orbit.target.set(to.x, to.y, to.z); orbit.theta = to.theta; orbit.phi = to.phi; orbit.radius = to.radius;
    }

    function setCameraMode(mode, instant) {
      if (mode !== 'orbit' && mode !== 'top' && mode !== 'walk') return;
      var prev = st.mode;
      st.mode = mode;
      st.anim = null;
      if (mode === 'walk') {
        camera.fov = 70; camera.updateProjectionMatrix();
        var s = st.mask && st.mask.ok ? st.mask.start : [0, 0];
        walk.pos.set(s[0], EYE, -s[1]);
        walk.pitch = 0;
        // mirar hacia el lado con más espacio: el centro del plano si estamos lejos de él, si no, hacia el norte
        var b = boundsInfo(), dx = b.cx - walk.pos.x, dz = b.cz - walk.pos.z;
        walk.yaw = Math.hypot(dx, dz) > 0.8 ? Math.atan2(-dx, -dz) : 0;
        applyWalk();
      } else {
        camera.fov = 45; camera.updateProjectionMatrix();
        var tp = targetPoint();
        var to = {
          x: tp.x, y: tp.y, z: tp.z, radius: fitRadius(mode === 'top'),
          theta: mode === 'top' ? 0 : 0.61, phi: mode === 'top' ? 0.0005 : 1.0
        };
        if (instant || prev === 'walk') { setOrbitNow(to); applyOrbit(); } else tweenOrbit(to, 550);
      }
      refreshCeiling();
      requestRender();
    }

    function fit() {
      if (st.mode === 'walk') { setCameraMode('orbit', true); return; }
      var tp = targetPoint();
      tweenOrbit({ x: tp.x, y: tp.y, z: tp.z, radius: fitRadius(st.mode === 'top'), theta: orbit.theta, phi: orbit.phi }, 450);
    }

    function walkTo(x, z) {
      st.anim = { walk: true, t0: performance.now(), dur: 450, from: walk.pos.clone(), to: new THREE.Vector3(x, EYE, z) };
      requestRender();
    }

    /* ---- bucle ---- */
    function requestRender() { if (st.active && !st.raf) st.raf = requestAnimationFrame(frame); }

    function frame(ts) {
      st.raf = 0;
      var more = false, now = performance.now(), dt = Math.min(0.1, (now - (st.lastT || now)) / 1000);
      st.lastT = now;
      var a = st.anim;
      if (a) {
        var k = clamp((now - a.t0) / a.dur, 0, 1), e = k * k * (3 - 2 * k);
        if (a.walk) walk.pos.lerpVectors(a.from, a.to, e);
        else {
          orbit.target.set(a.from.x + (a.to.x - a.from.x) * e, a.from.y + (a.to.y - a.from.y) * e, a.from.z + (a.to.z - a.from.z) * e);
          orbit.theta = a.from.theta + (a.to.theta - a.from.theta) * e;
          orbit.phi = a.from.phi + (a.to.phi - a.from.phi) * e;
          orbit.radius = a.from.radius + (a.to.radius - a.from.radius) * e;
        }
        if (k >= 1) st.anim = null; else more = true;
      }
      if (st.mode === 'walk') {
        var kx = (st.keys.d ? 1 : 0) - (st.keys.a ? 1 : 0), kz = (st.keys.w ? 1 : 0) - (st.keys.s ? 1 : 0);
        var yawIn = (st.keys.left ? 1 : 0) - (st.keys.right ? 1 : 0);
        if (yawIn) { walk.yaw += yawIn * 1.6 * dt; more = true; }
        if (kx || kz) {
          var sp = (st.keys.shift ? 5 : 2.2) * dt;
          var fx = -Math.sin(walk.yaw), fz = -Math.cos(walk.yaw), rx = Math.cos(walk.yaw), rz = -Math.sin(walk.yaw);
          walk.pos.x += (fx * kz + rx * kx) * sp; walk.pos.z += (fz * kz + rz * kx) * sp;
          st.anim = st.anim && st.anim.walk ? null : st.anim;
          more = true;
        }
      }
      applyCamera();
      renderer.render(scene, camera);
      if (more) requestRender();
    }

    /* ---- entrada: mouse, lápiz y dedos ---- */
    var pts = new Map(), pinch = null;

    function pan(dx, dy) {
      var k = 2 * orbit.radius * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, canvas.clientHeight);
      var rx = Math.cos(orbit.theta), rz = -Math.sin(orbit.theta), fx = -Math.sin(orbit.theta), fz = -Math.cos(orbit.theta);
      orbit.target.x += -rx * dx * k + fx * dy * k;
      orbit.target.z += -rz * dx * k + fz * dy * k;
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (!st.active) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, button: e.button, shift: e.shiftKey });
      st.anim = null;
      if (pts.size === 2) {
        var p = Array.from(pts.values());
        pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2 };
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      var p = pts.get(e.pointerId);
      if (!p || !st.active) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 5) p.moved = true;

      if (pts.size >= 2) {
        var a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        var mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
        if (st.mode !== 'walk') {
          orbit.radius = clamp(orbit.radius * (pinch.d / d), 1, 600);
          pan(mx - pinch.mx, my - pinch.my);
        } else {
          camera.fov = clamp(camera.fov * (pinch.d / d), 35, 95); camera.updateProjectionMatrix();
        }
        pinch.d = d; pinch.mx = mx; pinch.my = my;
      } else if (st.mode === 'walk') {
        walk.yaw += dx * 0.004;
        walk.pitch = clamp(walk.pitch + dy * 0.004, -1.2, 1.2);
      } else if (st.mode === 'top' || p.button === 2 || p.button === 1 || p.shift || e.shiftKey) {
        pan(dx, dy);
      } else {
        orbit.theta -= dx * 0.006;
        orbit.phi = clamp(orbit.phi - dy * 0.006, 0.02, Math.PI / 2 - 0.02);
      }
      requestRender();
    });

    function release(e) {
      var p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (p && st.mode === 'walk' && !p.moved && pts.size === 0 && performance.now() - p.t0 < 350 && e.type === 'pointerup') {
        var r = canvas.getBoundingClientRect();
        var ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        var ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
        var hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
          var b = boundsInfo();
          if (Math.abs(hit.x - b.cx) < b.w / 2 + 15 && Math.abs(hit.z - b.cz) < b.d / 2 + 15) walkTo(hit.x, hit.z);
        }
      }
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', function (e) {
      if (!st.active) return;
      e.preventDefault();
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (st.mode === 'walk') {
        var f = -dy * 0.004;
        walk.pos.x += -Math.sin(walk.yaw) * f; walk.pos.z += -Math.cos(walk.yaw) * f;
      } else orbit.radius = clamp(orbit.radius * Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0014)), 1, 600);
      st.anim = null;
      requestRender();
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function keyName(e) {
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': return 'w';
        case 's': case 'arrowdown': return 's';
        case 'a': return 'a';
        case 'd': return 'd';
        case 'arrowleft': return 'left';
        case 'arrowright': return 'right';
        case 'shift': return 'shift';
        default: return null;
      }
    }

    /* ---- interfaz pública ---- */
    function resize(w, h) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      requestRender();
    }

    function sync(objects, settings, units, resetCamera) {
      var prev = st.s;
      st.objects = objects;
      st.s = Object.assign({}, settings);
      var unitsChanged = units !== st.units;
      st.units = units;
      if (unitsChanged || !groundMat.map) updateGround();
      var sig = JSON.stringify(objects.filter(function (o) { return o.type === 'wall' || o.type === 'door' || o.type === 'window'; }));
      var heavy = resetCamera || !prev || prev.wallH !== st.s.wallH || prev.doors !== st.s.doors || prev.floor !== st.s.floor || !st.model || sig !== st.sig;
      st.sig = sig;
      if (heavy) rebuild();
      else { applyLook(); applySun(); refreshCeiling(); }
      if (resetCamera) setCameraMode(st.mode === 'walk' ? 'walk' : st.mode, true);
      requestRender();
    }

    return {
      sync: sync,
      resize: resize,
      setCameraMode: setCameraMode,
      getMode: function () { return st.mode; },
      fit: fit,
      info: function () { return st.info; },
      releaseKeys: function () { st.keys = {}; },
      activate: function () { st.active = true; st.lastT = 0; requestRender(); },
      deactivate: function () { st.active = false; st.keys = {}; pts.clear(); if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } },
      key: function (e, down) {
        var k = keyName(e);
        if (!k || !st.active) return false;
        if (st.mode !== 'walk' && k !== 'shift') return false;
        st.keys[k] = down;
        if (down) requestRender();
        return k !== 'shift';
      },
      exportBlob: function (cb) {
        renderer.render(scene, camera);
        canvas.toBlob(cb, 'image/png');
      },
      debug: function () { return { mode: st.mode, orbit: orbit, walk: walk, parts: group.children.length }; }
    };
  }

  root.CotaView3D = { create: create, WALL_COLORS: WALL_COLORS, FLOOR_KINDS: FLOOR_KINDS };
})(this);
