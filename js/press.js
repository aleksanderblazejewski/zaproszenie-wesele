/* ==========================================================================
   Prasa drukarska w galerii, sterowana przewijaniem.
   Wjazd sceny rysuje rycinę. Potem trzy takty: kładziemy arkusz, odciągamy
   drąg (odbicie), unosimy odbitkę. Odbitka wywołuje się i ląduje w złotych
   narożnikach pierwszego zdjęcia galerii.
   Rzut ukośny: P(x, y, z) = (x + KX·z, y + KY·z), jak w statycznej rycinie.
   Przewijanie wyznacza cel, a nie tempo: głowica odtwarzania gra takty
   we własnym tempie i zatrzymuje się na spoczynkach między nimi.
   ========================================================================== */

(function () {
  'use strict';

  var press = document.getElementById('press');
  var art = document.getElementById('press-art');
  var polaroid = document.getElementById('polaroid');
  var target = document.querySelector('[data-press-target]');
  if (!press || !art || !polaroid || !target) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var section = press.closest('.gallery');
  var grid = section.querySelector('.gallery-grid');
  var head = press.querySelector('.press-head');
  var scene = document.getElementById('press-scene');
  var gPlaten = document.getElementById('press-platen');
  var gRounce = document.getElementById('press-rounce');
  var gCarriage = document.getElementById('press-carriage');
  var gBar = document.getElementById('press-bar');
  var dev = polaroid.querySelector('.polaroid-dev');
  var pImg = polaroid.querySelector('img');
  var cap = polaroid.querySelector('figcaption');

  var KX = -0.42, KY = 0.26;
  var NS = 'http://www.w3.org/2000/svg';

  section.classList.add('has-press');
  press.classList.add('is-on');

  /* --- pomocnicze ---------------------------------------------------------- */

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function eIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eOut(t) { return 1 - Math.pow(1 - t, 3); }
  function eIn(t) { return t * t * t; }

  function P(x, y, z) { return [x + KX * z, y + KY * z]; }
  function pt(q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
  function poly(list) { return 'M' + list.map(pt).join('L') + 'Z'; }
  function seg2(a, b) { return 'M' + pt(a) + 'L' + pt(b); }

  // zapis tylko przy zmianie: style, zmienne CSS i atrybut d
  function setIf(el, prop, val) {
    var c = el._pc || (el._pc = {});
    if (c[prop] === val) return;
    c[prop] = val;
    if (prop.charAt(0) === '-') el.style.setProperty(prop, val);
    else el.style[prop] = val;
  }
  function dIf(el, val) {
    if (el._d === val) return;
    el._d = val;
    el.setAttribute('d', val);
  }

  function mk(parent, cls) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('class', cls);
    parent.appendChild(el);
    return el;
  }

  // prostopadłościan: góra, prawa (w cieniu) i przód
  function Box(parent) {
    this.top = mk(parent, 'pe pf');
    this.right = mk(parent, 'pe pf');
    this.hatch = mk(parent, 'ph');
    this.front = mk(parent, 'pc pf');
  }
  Box.prototype.set = function (x0, x1, y0, y1, z0, z1, hatch) {
    dIf(this.top, poly([P(x0, y0, z1), P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1)]));
    dIf(this.right, poly([P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)]));
    dIf(this.front, poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]));
    var d = '';
    if (hatch) for (var z = z1 - hatch; z > z0 + 1; z -= hatch) d += seg2(P(x1, y0, z), P(x1, y1, z));
    dIf(this.hatch, d);
  };

  /* --- części ruchome ------------------------------------------------------- */

  // skrzynka śruby + płyta dociskowa (+ błysk odbicia)
  // przedłużenie śruby: chowa się w skrzynce, gdy płyta schodzi (bez górnej krawędzi)
  var spFill = mk(gPlaten, 'pf pn');
  var spFront = mk(gPlaten, 'pc');
  var spSide = mk(gPlaten, 'pe');
  var spThread = mk(gPlaten, 'ph');
  var hose = new Box(gPlaten);
  var platen = new Box(gPlaten);
  var platenHatch = mk(gPlaten, 'ph');
  var flash = mk(gPlaten, 'flash');

  // korba wózka (rounce)
  var rWheel = mk(gRounce, 'pe pf');
  var rSpokes = mk(gRounce, 'pe');
  var rCrank = mk(gRounce, 'pe');

  // wózek z formą, tympan z arkuszem, ramka (frisket)
  var coffin = new Box(gCarriage);
  var type = mk(gCarriage, 'ph');
  var tympan = mk(gCarriage, 'pc pf');
  var tympanIn = mk(gCarriage, 'pe');
  var sheetShadow = mk(gCarriage, 'sheet-shadow');
  var sheet = mk(gCarriage, 'sheet');
  var sheetInk = mk(gCarriage, 'sheet-ink');
  var frisket = mk(gCarriage, 'pe');
  var frisketIn = mk(gCarriage, 'pe');
  var flashEdge = mk(gCarriage, 'flash flash-edge');

  // drąg
  var bar = mk(gBar, 'pc pf');
  var knob = mk(gBar, 'pc pf');

  // arkusz w proporcji odbitki (64 × 84 ≈ 1 : 1,32); d0 przy zawiasie = dół odbitki z podpisem
  var SHEET = { x0: 178, x1: 242, d0: 8, d1: 92 };
  var sheetQuad = null;

  function drawMachine(s) {
    // płyta i skrzynka
    var dp = s.dp;
    var yb = 153 + dp;
    dIf(spFill, 'M202.9 152L212.9 152L217.1 149.4L217.1 ' + (yb - 2.6).toFixed(1) + 'L212.9 ' + yb.toFixed(1) + 'L202.9 ' + yb.toFixed(1) + 'Z');
    dIf(spFront, 'M202.9 152V' + yb.toFixed(1) + 'M212.9 152V' + yb.toFixed(1));
    dIf(spSide, 'M217.1 149.4V' + (yb - 2.6).toFixed(1));
    var spt = '';
    for (var ty = 154.3; ty < 150 + dp; ty += 5) spt += 'M202.9 ' + ty.toFixed(1) + 'L212.9 ' + (ty + 4).toFixed(1);
    dIf(spThread, spt);
    hose.set(200, 220, 150 + dp, 222 + dp, -10, 10, 0);
    platen.set(160, 260, 222 + dp, 236 + dp, -26, 26, 6);
    dIf(platenHatch, seg2(P(166, 229 + dp, 26), P(254, 229 + dp, 26)));
    dIf(flash, seg2(P(160, 236 + dp, 26), P(260, 236 + dp, 26)));

    // korba
    var rc = P(150, 286, 150);
    var rr = 12;
    dIf(rWheel, 'M' + (rc[0] + rr).toFixed(1) + ' ' + rc[1].toFixed(1) +
      'a' + rr + ' ' + rr + ' 0 1 0 ' + (-2 * rr) + ' 0a' + rr + ' ' + rr + ' 0 1 0 ' + (2 * rr) + ' 0Z');
    var sp = '';
    for (var i = 0; i < 4; i++) {
      var ang = s.rounce + i * Math.PI / 4;
      sp += 'M' + (rc[0] + Math.cos(ang) * rr).toFixed(1) + ' ' + (rc[1] + Math.sin(ang) * rr).toFixed(1) +
        'L' + (rc[0] - Math.cos(ang) * rr).toFixed(1) + ' ' + (rc[1] - Math.sin(ang) * rr).toFixed(1);
    }
    dIf(rSpokes, sp);
    var ca = s.rounce * 1;
    var ce = [rc[0] + Math.cos(ca) * (rr + 8), rc[1] + Math.sin(ca) * (rr + 8)];
    dIf(rCrank, seg2(rc, ce) + 'M' + pt(ce) + 'l-6 3');

    // wózek: przesuwa się wzdłuż głębokości o C; pod płytą rysujemy go przed płytą
    var C = s.C;
    var under = C < 70;
    if (under !== drawMachine.under) {
      drawMachine.under = under;
      art.insertBefore(gCarriage, under ? gPlaten : gBar);
    }
    coffin.set(156, 264, 252, 268, -50 + C, 50 + C, 8);
    var t = '';
    for (var r = 0; r < 5; r++) {
      var zz = -38 + C + r * 18;
      t += seg2(P(168, 252, zz), P(206, 252, zz)) + seg2(P(214, 252, zz), P(252, 252, zz));
    }
    dIf(type, t);

    // tympan na zawiasie z przodu wózka; a = kąt uniesienia
    var Hz = 50 + C, Hy = 250;
    var ca2 = Math.cos(s.a), sa2 = Math.sin(s.a);
    function T(x, d, h) {
      return P(x, Hy - (d * sa2 + h * ca2), Hz - d * ca2 + h * sa2);
    }
    dIf(tympan, poly([T(160, 0, 0), T(260, 0, 0), T(260, 100, 0), T(160, 100, 0)]));
    dIf(tympanIn, poly([T(164, 4, 0), T(256, 4, 0), T(256, 96, 0), T(164, 96, 0)]));
    dIf(flashEdge, seg2(T(160, 0, 0), T(260, 0, 0)));

    // arkusz: spada na tympan (h maleje do 0); odbicie = pole jak okno odbitki
    var sh = s.sheetH;
    var x0 = SHEET.x0, x1 = SHEET.x1, d0 = SHEET.d0, d1 = SHEET.d1;
    var ix = 0.045 * (x1 - x0), it = 0.045 * (d1 - d0) / 1.32;
    dIf(sheet, poly([T(x0, d0, sh), T(x1, d0, sh), T(x1, d1, sh), T(x0, d1, sh)]));
    dIf(sheetInk, poly([T(x0 + ix, d0 + s.inkB, sh), T(x1 - ix, d0 + s.inkB, sh), T(x1 - ix, d1 - it, sh), T(x0 + ix, d1 - it, sh)]));
    // cień arkusza na tympanie (h = 0), gęstnieje, gdy arkusz się zbliża
    var o = 1.2;
    dIf(sheetShadow, poly([T(x0, d0, 0), T(x1, d0, 0), T(x1, d1, 0), T(x0, d1, 0)].map(function (q) { return [q[0] + o, q[1] + o]; })));
    setIf(sheetShadow, 'opacity', (s.sheetOp * lerp(0.03, 0.09, 1 - clamp(s.sheetH / 46))).toFixed(3));
    setIf(sheet, 'opacity', s.sheetOp.toFixed(3));
    setIf(sheetInk, 'opacity', (s.sheetOp * s.ink).toFixed(3));
    sheetQuad = { tl: T(x0, d1, sh), tr: T(x1, d1, sh), bl: T(x0, d0, sh) };

    // ramka (frisket) na zawiasie na końcu tympanu; b = kąt otwarcia względem tympanu
    var cb = Math.cos(s.b), sb = Math.sin(s.b);
    function F(x, e) { return T(x, 100 - e * cb, e * sb); }
    dIf(frisket, poly([F(160, 0), F(260, 0), F(260, 100), F(160, 100)]));
    dIf(frisketIn, poly([F(172, 10), F(248, 10), F(248, 90), F(172, 90)]));

    // drąg obraca się wokół osi śruby (x 210, z 0), nigdy przez zero
    var L = 118, th = s.theta;
    var y0 = 166 + dp;
    var p0 = P(214, y0, 0);
    var p1 = P(210 + L * Math.cos(th), y0, L * Math.sin(th));
    var nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0], nl = Math.hypot(nx, ny) || 1;
    nx = nx / nl * 3; ny = ny / nl * 3;
    dIf(bar, 'M' + pt([p0[0] + nx, p0[1] + ny]) + 'L' + pt([p1[0] + nx, p1[1] + ny]) +
      'L' + pt([p1[0] - nx, p1[1] - ny]) + 'L' + pt([p0[0] - nx, p0[1] - ny]) + 'Z');
    dIf(knob, 'M' + (p1[0] + 7).toFixed(1) + ' ' + p1[1].toFixed(1) +
      'a7 7 0 1 0 -14 0a7 7 0 1 0 14 0Z');
  }

  /* --- geometria ekranu --------------------------------------------------- */

  var vb = art.viewBox.baseVal;
  function toScreen(q, r) {
    return [r.left + (q[0] - vb.x) / vb.width * r.width, r.top + (q[1] - vb.y) / vb.height * r.height];
  }

  // macierz CSS obrotu o rot stopni wokół środka (cx, cy) dla prostokąta w × h (origin 0 0)
  function rigid(rot, cx, cy, w, h) {
    var r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, cx - (c * w / 2 - s * h / 2), cy - (s * w / 2 + c * h / 2)];
  }
  function matrix(M) {
    return 'matrix(' + M[0].toFixed(4) + ',' + M[1].toFixed(4) + ',' + M[2].toFixed(4) + ',' +
      M[3].toFixed(4) + ',' + M[4].toFixed(2) + ',' + M[5].toFixed(2) + ')';
  }

  /* --- głowica odtwarzania ------------------------------------------------ */

  // spoczynki to kadry, na których prasa może stać; takty mają własny czas (ms)
  var RESTS = [0, 0.15, 0.36, 0.56, 0.7, 1];
  var BEATS = [
    { a: 0, b: 0.15, fwd: 600, rev: 420 },    // arkusz, ramka
    { a: 0.15, b: 0.36, fwd: 850, rev: 660 }, // tympan, wózek, drąg, docisk
    { a: 0.36, b: 0.56, fwd: 720, rev: 550 }, // zwolnienie, wyjazd, otwarcie
    { a: 0.56, b: 0.7, fwd: 640, rev: 450 },  // uniesienie, wywołanie
    { a: 0.7, b: 1, fwd: 850, rev: 600 }      // lot i osadzenie
  ];
  // postój do przodu na kadrze odbicia i na wywołanej odbitce: [ms, minimum przy kompresji]
  var DWELL = { 2: [280, 140], 4: [220, 110] };
  // takt przesądza 20% jego długości, ale nie więcej niż 3% sceny (~32px) do przodu i 1,5% (~16px) wstecz
  var LATCH_IN = 0.2, LATCH_MAX = 0.03, LATCH_REV = 0.015, IDLE_MS = 220, RAMP_MS = 120, DIR_PX = 16;
  var MAX_LAG = 2900, BEAT_FLOOR = 0.4, JUMP_VH = 1.5;
  // przejazd (nawigacja, długi rzut): ponad 2,5 ekranu w ostatnich 600 ms
  // albo powrót spoza ekranu od dołu z ponad 1,5 ekranu w tym oknie (do przodu wjazd zawsze gra)
  var TRAVEL_MS = 600, TRAVEL_VH = 2.5;

  var ph = { h: -1, goal: 0, vel: 0, dir: 1, back: 0, lastY: 0, lastT: -1e9, offT: -1e9, comp: 1, lag: 1, latch: -1, dwellAt: -1, dwellLeft: 0 };
  var trail = [], trailSum = 0;

  function beatAt(p, dir) {
    for (var i = 0; i < BEATS.length; i++) if (dir > 0 ? p < BEATS[i].b : p <= BEATS[i].b) return i;
    return BEATS.length - 1;
  }
  // postęp w takcie od spoczynku wyjścia i próg przesądzenia
  function beatPos(T, dir) {
    var k = beatAt(T, dir), B = BEATS[k];
    var g = (dir > 0 ? T - B.a : B.b - T) / (B.b - B.a);
    return { k: k, B: B, g: g, gIn: Math.min(LATCH_IN, (dir > 0 ? LATCH_MAX : LATCH_REV) / (B.b - B.a)) };
  }
  // spoczynek, na którym stanęłaby głowica dla tego przewinięcia (po skoku, po wczytaniu)
  function restFor(T, dir) {
    var q = beatPos(T, dir);
    return (q.g >= q.gIn) === (dir > 0) ? q.B.b : q.B.a;
  }
  // zaległość w ms nominalnych od h do celu, z postojami po drodze
  function backlog(h, goal, dir) {
    var ms = 0, lo = Math.min(h, goal), hi = Math.max(h, goal);
    for (var i = 0; i < BEATS.length; i++) {
      var B = BEATS[i], o = Math.min(hi, B.b) - Math.max(lo, B.a);
      if (o > 0) ms += o / (B.b - B.a) * (dir > 0 ? B.fwd : B.rev);
    }
    if (dir > 0) for (var r in DWELL) if (RESTS[r] > h && RESTS[r] < goal) ms += DWELL[r][0];
    return ms;
  }

  function advance(now, dt, m) {
    var T = m.p;
    var dy = m.y - ph.lastY;
    ph.lastY = m.y;
    if (dy) {
      ph.lastT = now;
      // zmiana kierunku dopiero po DIR_PX, żeby drgnięcie palca nie cofało taktu
      if ((dy > 0) !== (ph.dir > 0)) {
        ph.back += dy;
        if (Math.abs(ph.back) > DIR_PX) { ph.dir = -ph.dir; ph.back = 0; ph.comp = ph.lag = 1; ph.latch = -1; ph.dwellLeft = 0; }
      } else ph.back = 0;
      trail.push({ t: now, dy: Math.abs(dy) });
      trailSum += Math.abs(dy);
    }
    while (trail.length && now - trail[0].t > TRAVEL_MS) trailSum -= trail.shift().dy;
    var idle = now - ph.lastT > IDLE_MS;
    if (m.off) ph.offT = now;
    var travel = trailSum > (ph.dir < 0 && now - ph.offT < TRAVEL_MS ? JUMP_VH : TRAVEL_VH) * m.vh;

    // skok, przejazd, wczytanie w środku sceny albo scena poza ekranem: od razu spoczynek, bez odtwarzania
    // (w trakcie przejazdu odbitka nie staje w powietrzu: zostaje na arkuszu albo leży w galerii,
    // po tej stronie, z której dalszy takt pójdzie w kierunku przewijania; po zatrzymaniu zwykły spoczynek)
    if (ph.h < 0 || travel || Math.abs(dy) > JUMP_VH * m.vh || m.off) {
      ph.h = restFor(T, ph.dir);
      if (travel && dy && ph.h === 0.7) ph.h = ph.dir > 0 ? 0.56 : 1;
      ph.goal = ph.h; ph.vel = 0; ph.comp = ph.lag = 1; ph.latch = -1; ph.dwellLeft = 0;
      ph.dwellAt = RESTS.indexOf(ph.h);
      return idle;
    }

    // cel: pierwsze 20% taktu idzie za przewijaniem, potem takt jest przesądzony (z histerezą)
    var dir = ph.dir, q = beatPos(T, dir), k = q.k, B = q.B, g = q.g, gIn = q.gIn;
    if (ph.latch !== k) ph.latch = -1;
    if (g >= gIn) ph.latch = k;
    var goal;
    if (ph.latch === k && g > gIn / 2) goal = dir > 0 ? B.b : B.a;
    else {
      ph.latch = -1;
      goal = T;
      // zatrzymanie przed przesądzeniem: wracamy na spoczynek, z którego takt wyszedł
      if (idle && g > 0 && g < 1) goal = dir > 0 ? B.a : B.b;
    }
    ph.goal = goal;

    if (ph.dwellAt >= 0 && ph.h !== RESTS[ph.dwellAt]) ph.dwellAt = -1;
    if (ph.dwellLeft > 0) { ph.dwellLeft -= dt; return idle; }
    if (!dt || ph.h === goal) { ph.vel = 0; ph.comp = ph.lag = 1; return idle; }

    // tempo: nominalne; przy dużej zaległości jednolicie szybciej, nie mniej niż BEAT_FLOOR
    // (kompresja tylko maleje w trakcie biegu, więc bieg nie wydłuża się w nieskończoność)
    var R = backlog(ph.h, goal, dir);
    var c = R > MAX_LAG ? Math.max(BEAT_FLOOR, MAX_LAG / R) : 1;
    if (c < ph.lag) ph.lag = c;
    // prasa zgaszona wyjściem: niewidoczne takty 1-3 przebiegamy szybciej, do 5×
    if (dir > 0 && m.xo > 0 && ph.h < 0.56) c = Math.min(c, Math.max(0.2, 1 - m.xo));
    if (c < ph.comp) ph.comp = c;
    var s = goal > ph.h ? 1 : -1;
    var hb = BEATS[beatAt(ph.h, s)];
    var v = (hb.b - hb.a) / ((s > 0 ? hb.fwd : hb.rev) * ph.comp);
    var d = goal - ph.h, h0 = ph.h;
    if (Math.abs(d) <= v * dt) {
      // w zasięgu jednej klatki: idziemy 1:1 za celem
      ph.vel = d / dt;
      ph.h = goal;
    } else {
      var acc = v * dt / RAMP_MS, vt = s * v;
      ph.vel = ph.vel < vt ? Math.min(vt, ph.vel + acc) : Math.max(vt, ph.vel - acc);
      if (ph.vel * s <= 0) ph.vel = s * acc;
      ph.h += ph.vel * dt;
      if ((goal - ph.h) * s < 0) ph.h = goal;
    }
    // przejście przez kadr z postojem: stajemy na nim dokładnie
    if (s > 0) {
      for (var r in DWELL) {
        var Rr = RESTS[r];
        if (h0 < Rr && ph.h >= Rr) {
          ph.dwellAt = +r;
          // kadru odbicia nie widać, gdy prasa jest zgaszona wyjściem: bez postoju
          if (goal > Rr && !(+r === 2 && m.xo > 0.5)) { ph.h = Rr; ph.vel = 0; ph.dwellLeft = Math.max(DWELL[r][1], DWELL[r][0] * ph.comp); }
        }
      }
      // widoczne uniesienie i lot wracają do tempa z samej zaległości (MAX_LAG), od spoczynku na arkuszu
      if (ph.comp < ph.lag && h0 < 0.56 && ph.h >= 0.56) {
        ph.comp = ph.lag;
        if (goal > 0.56) { ph.h = 0.56; ph.vel = 0; }
      }
    }
    if (ph.h === goal && ph.dwellLeft <= 0) ph.comp = ph.lag = 1;
    return idle;
  }

  /* --- klatka ---------------------------------------------------------------- */

  var last = 0, raf = 0;
  var capH = 0;
  var lastE = -1;
  var decoded = false;

  // wszystkie odczyty układu na początku klatki, przed zapisami
  function readTarget() {
    var r = press.getBoundingClientRect();
    var vh = window.innerHeight;
    var span = r.height - vh;
    var p = span > 0 ? clamp(-r.top / span) : 0;
    return {
      p: p,
      y: window.pageYOffset,
      e: clamp((vh - r.top) / vh),
      pr: r,
      off: r.bottom < 0 || r.top > vh,
      // wygaszenie prasy przewinięciem za odpięcie sceny (u = część ekranu za jej końcem)
      xo: eIO(seg(clamp((vh - r.bottom) / vh), 0.06, 0.2)),
      sr: scene.getBoundingClientRect(),
      ar: art.getBoundingClientRect(),
      g1: ph.h > 0.6 || p > 0.6 ? target.getBoundingClientRect() : null,
      vw: window.innerWidth,
      vh: vh
    };
  }

  function render(p, m) {
    // 0. rysowanie przy wjeździe sceny, wprost z przewijania (nie z głowicy)
    // postęp wg widocznej części ryciny; wypełnienie, ruchome części i napis na końcu
    // ostatnie 15% kończy się dokładnie w chwili przypięcia (e = 1)
    var ds = clamp((m.vh - m.sr.top) / m.sr.height);
    var eFull = Math.min(0.98, (m.sr.top - m.pr.top + m.sr.height) / m.vh);
    var dr = clamp(0.85 * seg(ds, 0.1, 1) + 0.15 * seg(m.e, eFull, 1));
    setIf(art, '--draw', (1 - seg(dr, 0, 0.75)).toFixed(3));
    setIf(art, '--drawh', (1 - seg(dr, 0.45, 1)).toFixed(3));
    setIf(art, '--fill', seg(dr, 0.35, 0.9).toFixed(3));
    setIf(art, '--move', seg(dr, 0.55, 1).toFixed(3));
    setIf(art, '--text', seg(dr, 0.75, 1).toFixed(3));
    if (!decoded && m.e > 0.4 && pImg.decode) { decoded = true; pImg.decode().catch(function () {}); }

    // wymiary odbitki po uniesieniu; podpis wyznacza dolny margines odbicia na arkuszu
    var vw = m.vw, vh = m.vh;
    var W1 = Math.min(300, vw * 0.62, (vh - 160) * 0.62);
    var H1 = W1 * 1.32;

    // 1. kładziemy arkusz (z lekkim osiadaniem), ramka się zamyka
    var drop = eOut(seg(p, 0, 0.1));
    var sheetH = p < 0.1 ? lerp(46, -1.5, drop) : lerp(-1.5, 0, seg(p, 0.1, 0.11));
    var fClose = eIO(seg(p, 0.07, 0.15));
    // 2. tympan na formę, wózek wjeżdża, odciągnięcie drąga, docisk, odbicie
    var tClose = eIO(seg(p, 0.14, 0.2));
    var rollIn = eIO(seg(p, 0.2, 0.27));
    var pull = eIn(seg(p, 0.27, 0.33));
    var release = eOut(seg(p, 0.39, 0.44));
    var rollOut = eIO(seg(p, 0.43, 0.5));
    var tOpen = eOut(seg(p, 0.49, 0.54));
    var fOpen = eOut(seg(p, 0.51, 0.56));
    var pressAmt = pull - release;
    var stop = Math.sin(seg(p, 0.33, 0.35) * Math.PI);
    var flashAmt = eOut(seg(p, 0.33, 0.335)) * (1 - eIn(seg(p, 0.335, 0.39)));
    var C = 130 - 130 * rollIn + 130 * rollOut;

    drawMachine({
      dp: 14 * pressAmt + 1.2 * stop,
      theta: (18 + 20 * pressAmt + 3 * stop) * Math.PI / 180,
      C: C,
      rounce: -C / 14,
      a: (62 - 62 * tClose + 62 * tOpen) * Math.PI / 180,
      b: (112 - 112 * fClose + 112 * fOpen) * Math.PI / 180,
      sheetH: sheetH,
      sheetOp: seg(p, 0, 0.02) * (p < 0.56 ? 1 : 0),
      ink: eOut(seg(p, 0.333, 0.37)),
      inkB: Math.min(0.4, capH / H1) * (SHEET.d1 - SHEET.d0)
    });
    setIf(art, '--flash', flashAmt.toFixed(3));
    setIf(art, 'transform', stop > 0.001 ? 'translateY(' + (stop * 1.2).toFixed(2) + 'px)' : '');

    // napis pod nagłówkiem ustępuje podpisowi odbitki; prasa gaśnie, zanim pojawi się siatka
    // przewijanie za odpięcie sceny (u = część ekranu za jej końcem) też po kolei:
    // najpierw gaśnie prasa (xo), potem wchodzi siatka (xi), nawet gdy głowica jest w tyle;
    // nigdy obie naraz; podczas przypięcia u = 0
    var u = clamp((m.vh - m.pr.bottom) / m.vh);
    var xo = m.xo;
    var xi = eOut(seg(u, 0.22, 0.4));
    var A = Math.min(1 - eIO(seg(p, 0.6, 0.68)), 1 - xo);
    setIf(head, '--note', (1 - seg(p, 0.6, 0.66)).toFixed(3));
    setIf(head, '--head', Math.min(1 - seg(p, 0.62, 0.7), 1 - xo).toFixed(3));
    setIf(art, '--art', A.toFixed(3));
    var G = Math.max(eOut(seg(p, 0.7, 0.84)), xi);
    setIf(grid, '--grid', G.toFixed(3));
    // niewidoczna siatka nie przyjmuje stuknięć (g1 ma własne --g1-events)
    setIf(grid, '--grid-events', G >= 0.5 ? 'auto' : 'none');

    // 3. unosimy odbitkę: zaczyna dokładnie na rogach arkusza (macierz z trzech rogów)
    var q = sheetQuad, ar = m.ar;
    var TL = toScreen(q.tl, ar), TR = toScreen(q.tr, ar), BL = toScreen(q.bl, ar);
    var lift = eOut(seg(p, 0.56, 0.66));
    var fly = eIO(seg(p, 0.72, 0.93));
    var seat = seg(p, 0.93, 0.985);
    var ucx = vw / 2, ucy = ar.top + ar.height * 0.52;
    var w = W1, h = H1, M, sh;

    if (fly <= 0) {
      var M0 = [(TR[0] - TL[0]) / W1, (TR[1] - TL[1]) / W1, (BL[0] - TL[0]) / H1, (BL[1] - TL[1]) / H1, TL[0], TL[1]];
      var M1 = rigid(-3, ucx, ucy, W1, H1);
      M = [];
      for (var i = 0; i < 6; i++) M[i] = lerp(M0[i], M1[i], lift);
      sh = lerp(0, 18, lift);
    } else {
      // lot do galerii: szerokość i wysokość (nie skala), na końcu osiadanie w narożnikach
      var g = m.g1;
      var cx = lerp(ucx, g.left + g.width / 2, fly);
      var cy = lerp(ucy, g.top + g.height / 2, fly) - Math.sin(fly * Math.PI) * vh * 0.04;
      w = lerp(W1, g.width, fly);
      h = lerp(H1, g.height, fly);
      var rot = lerp(-3, -1, fly);
      if (seat > 0) rot = seat < 0.6 ? lerp(-1, 0.4, eOut(seat / 0.6)) : lerp(0.4, 0, eIO((seat - 0.6) / 0.4));
      M = rigid(rot, cx, cy, w, h);
      sh = lerp(18, 3, eOut(seat));
    }

    // przejęcie z krycia arkusza (prasa przygaszona wyjściem: odbitka startuje równie blada),
    // potem dochodzi do pełna w trakcie uniesienia; przy pełnej prasie jak dotąd
    var op = p < 0.985 ? Math.max(seg(p, 0.55, 0.56) * (1 - xo), eOut(seg(p, 0.56, 0.66))) : 0;
    setIf(polaroid, 'visibility', op > 0 ? 'visible' : 'hidden');
    setIf(polaroid, 'opacity', op.toFixed(3));
    setIf(polaroid, 'width', w.toFixed(1) + 'px');
    setIf(polaroid, 'height', h.toFixed(1) + 'px');
    setIf(polaroid, 'padding', (w * 0.045).toFixed(1) + 'px ' + (w * 0.045).toFixed(1) + 'px 0');
    setIf(polaroid, '--sh', sh.toFixed(1) + 'px');
    setIf(polaroid, 'transform', matrix(M));
    setIf(cap, 'opacity', seg(p, 0.6, 0.68).toFixed(3));

    // złota krawędź arkusza przechodzi na odbitkę i rozpływa się; grubość niezależna od skali macierzy
    var edge = 1 - seg(p, 0.56, 0.6);
    var msc = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
    setIf(polaroid, '--edge', edge.toFixed(3));
    setIf(polaroid, '--ew', edge > 0 ? (0.75 / msc).toFixed(2) : '0');

    // złote narożniki albumu wsuwają się po przekątnej, zanim nastąpi podmiana
    var co = eOut(seg(p, 0.93, 0.975));
    setIf(polaroid, '--co', co.toFixed(3));
    setIf(polaroid, '--cs', (4 * (1 - co)).toFixed(2));

    // wywołanie: złota sepia → pełny kolor
    var devA = seg(p, 0.58, 0.64);
    var devB = seg(p, 0.62, 0.7);
    setIf(dev, 'opacity', (1 - devA).toFixed(3));
    var s1 = 1 - devB;
    setIf(pImg, 'filter', s1 > 0.001
      ? 'sepia(' + s1.toFixed(3) + ') saturate(' + (1 - 0.5 * s1).toFixed(3) + ') brightness(' + (1 + 0.12 * s1).toFixed(3) + ')'
      : '');

    // podmiana na prawdziwe zdjęcie galerii przy identycznej geometrii
    var landed = p >= 0.985 ? 1 : 0;
    setIf(target, '--landed', String(landed));
    setIf(target, '--g1-events', landed ? 'auto' : 'none');
  }

  function loop(now) {
    raf = 0;
    var m = readTarget();
    var dt = Math.min(64, now - (last || now));
    last = now;
    var idle = advance(now, dt, m);
    render(ph.h, m);
    if (ph.h !== ph.goal || ph.dwellLeft > 0 || m.e !== lastE || !idle) {
      lastE = m.e;
      raf = requestAnimationFrame(loop);
    } else {
      last = 0;
    }
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  window.addEventListener('scroll', kick, { passive: true });
  // wysokość podpisu mierzona poza pętlą klatki
  function measure() {
    capH = cap.offsetHeight;
    // non-scaling-stroke: Chrome kreskuje w pikselach ekranu, więc przy rycinie
    // większej niż viewBox kreska pathLength=1 kończyłaby się przed końcem ścieżki
    setIf(art, '--dk', Math.max(1, art.getBoundingClientRect().width / 306).toFixed(3));
    kick();
  }

  window.addEventListener('resize', measure);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(measure);
    ro.observe(grid);
    ro.observe(cap);
    ro.observe(art);
  }
  measure();
})();
