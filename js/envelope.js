/* ==========================================================================
   Koperta (intro): sekwencja faz na #intro.
   show → flip → flat → peel → open (+flap-back) → rise → front → out
   ========================================================================== */

(function () {
  'use strict';

  var intro = document.getElementById('intro');
  if (!intro) return;

  var skipBtn = document.getElementById('intro-skip');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var timers = [];
  var running = false;

  // Czas każdej fazy od początku (ms)
  var STEPS = [
    [80,   'p-show'],
    [1700, 'p-flip'],
    [2980, 'p-flat'],
    [3150, 'p-peel'],
    [3700, 'p-open'],
    [4330, 'p-flap-back'],
    [5150, 'p-rise'],
    [7700, 'p-front']
  ];
  var OUT_AT = 10000;
  var END_AT = 11150;

  // Odświeżenie strony albo kolejna wizyta: ta sama sekwencja, ok. 3 s
  var QUICK_STEPS = [
    [40,   'p-show'],
    [350,  'p-flip'],
    [1080, 'p-flat'],
    [1100, 'p-peel'],
    [1250, 'p-open'],
    [1560, 'p-flap-back'],
    [1700, 'p-rise']
  ];
  var QUICK_OUT_AT = 2750;

  function isReload() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav) return nav.type === 'reload';
      return performance.navigation && performance.navigation.type === 1;
    } catch (e) { return false; }
  }
  // pełna ceremonia tylko przy pierwszej wizycie (pominięcie też się liczy)
  var SEEN_KEY = 'eo-intro-seen-2027';
  function wasSeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* tryb prywatny */ }
  }
  var PHASES = STEPS.map(function (s) { return s[1]; }).concat('is-out', 'is-quick');

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    PHASES.forEach(function (c) { intro.classList.remove(c); });
  }

  function finish() {
    if (!running) return;
    running = false;
    markSeen();
    reset();
    intro.classList.add('is-done');
    // fokus był w intro ("Pomiń"): przenosimy go na zaproszenie, nie na <body>
    if (intro.contains(document.activeElement)) {
      var names = document.querySelector('.card-invite .invite-names');
      if (names) {
        if (!names.hasAttribute('tabindex')) names.setAttribute('tabindex', '-1');
        names.focus({ preventScroll: true });
      } else {
        document.activeElement.blur();
      }
    }
    document.body.classList.remove('is-locked', 'intro-on');
    document.removeEventListener('keydown', onKey);
    document.dispatchEvent(new CustomEvent('intro:done'));
  }

  function fadeOut() {
    if (!running) return;
    markSeen();
    timers.forEach(clearTimeout);
    timers = [];
    intro.classList.add('is-out');
    document.dispatchEvent(new CustomEvent('intro:leaving'));
    at(1150, finish);
  }

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fadeOut();
    }
  }

  function play() {
    if (reduced.matches) {
      intro.classList.add('is-done');
      document.dispatchEvent(new CustomEvent('intro:leaving'));
      document.dispatchEvent(new CustomEvent('intro:done'));
      return;
    }
    reset();
    running = true;
    window.scrollTo(0, 0);
    intro.classList.remove('is-done');
    document.body.classList.add('is-locked', 'intro-on');
    document.addEventListener('keydown', onKey);
    // wymuszenie reflow, żeby p-show zawsze startował od stanu początkowego
    void intro.offsetWidth;
    var quick = isReload() || wasSeen();
    var steps = quick ? QUICK_STEPS : STEPS;
    var outAt = quick ? QUICK_OUT_AT : OUT_AT;
    intro.classList.toggle('is-quick', quick);
    steps.forEach(function (s) { at(s[0], function () { intro.classList.add(s[1]); }); });
    at(outAt, fadeOut);
    at(outAt + 1550, finish);
    // klawiatura i czytnik ekranu zaczynają od "Pomiń"
    // (po pierwszej klatce: wcześniej przeglądarka jeszcze ustawia fokus dokumentu)
    if (skipBtn) at(60, function () { skipBtn.focus({ preventScroll: true }); });
  }

  if (skipBtn) skipBtn.addEventListener('click', fadeOut);
  intro.addEventListener('click', function (e) {
    // kliknięcie w kartę po jej wyjęciu przechodzi od razu do zaproszenia
    if (intro.classList.contains('p-front') && e.target !== skipBtn) fadeOut();
  });

  window.weddingIntro = { play: play, skip: fadeOut };
})();
