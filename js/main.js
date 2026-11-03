/* ==========================================================================
   Emilia & Olek · logika strony
   ========================================================================== */

(function () {
  'use strict';

  var DEFAULT_GUEST = 'Drodzy Goście';
  var WEDDING = new Date('2027-08-08T15:00:00+02:00');

  /* --- Toast --------------------------------------------------------------- */

  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    // czas czytania rośnie z długością komunikatu (min. 3,2 s)
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, Math.max(3200, msg.length * 55));
  }
  window.weddingToast = toast;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      // gdy przeglądarka odmówi (brak fokusu, uprawnienia), próbujemy starej metody
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var prev = document.activeElement;
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    });
  }
  window.weddingCopy = copyText;

  /* --- Personalizacja (?gosc=) ---------------------------------------------- */

  function guestFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var raw = p.get('gosc') || p.get('guest');
    if (!raw) return null;
    var clean = raw.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    return clean || null;
  }

  var guest = guestFromUrl();
  document.querySelectorAll('[data-guest]').forEach(function (el) {
    el.textContent = guest || DEFAULT_GUEST;
  });
  window.weddingGuest = guest;

  /* --- Wejście: koperta, potem strona ------------------------------------------ */

  var pageShown = false;
  function showPage() {
    if (pageShown) return;
    pageShown = true;
    document.body.classList.add('page-in');
  }
  document.addEventListener('intro:leaving', showPage);
  document.addEventListener('intro:done', showPage);

  // ?podglad pomija kopertę i odsłania wszystko (do zrzutów i edycji treści)
  var previewParam = new URLSearchParams(window.location.search).get('podglad');
  if (previewParam !== null) {
    document.documentElement.classList.add('is-preview');
    // ?podglad=900 udaje wysokość ekranu przy zrzutach całej strony
    var heroEl = document.querySelector('.hero');
    if (heroEl && Number(previewParam) > 0) heroEl.style.minHeight = Number(previewParam) + 'px';
    var introEl = document.getElementById('intro');
    if (introEl) introEl.classList.add('is-done');
    document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
    document.querySelectorAll('[data-enter]').forEach(function (el) { el.style.opacity = '1'; });
    pageShown = true;
  } else if (window.weddingIntro) {
    window.weddingIntro.play();
  } else {
    showPage();
  }

  /* --- Nawigacja -------------------------------------------------------------------- */

  var nav = document.getElementById('nav');
  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');

  function onScroll() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var toggleLabel = toggle && toggle.querySelector('.sr-only');

  function setMenu(open) {
    if (!links || !toggle) return;
    links.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (toggleLabel) toggleLabel.textContent = open ? 'Zamknij menu' : 'Menu';
    document.body.classList.toggle('is-locked', open);
  }
  function closeMenu() { setMenu(false); }
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = !links.classList.contains('is-open');
      setMenu(open);
      if (!open) toggle.focus();
    });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) {
      if (!links.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeMenu(); toggle.focus(); return; }
      // otwarte menu: Tab krąży tylko między przełącznikiem a linkami
      if (e.key === 'Tab') {
        var ring = [toggle].concat(Array.prototype.slice.call(links.querySelectorAll('a')));
        var i = ring.indexOf(document.activeElement);
        e.preventDefault();
        var next = i === -1 ? 0 : (i + (e.shiftKey ? -1 : 1) + ring.length) % ring.length;
        ring[next].focus();
      }
    });
    // po powrocie do szerokiego ekranu menu nie może zostać otwarte
    window.matchMedia('(min-width: 961px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });
  }

  /* --- Odsłanianie przy przewijaniu ---------------------------------------------------- */

  // kolejne wiersze w jednej grupie dostają małe opóźnienie
  document.querySelectorAll('.program-list, .info-list, .places-grid').forEach(function (group) {
    Array.prototype.forEach.call(group.querySelectorAll('[data-reveal]'), function (el, i) {
      el.style.setProperty('--d', (i % 4) * 0.12 + 's');
    });
  });

  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  // skok do sekcji (menu, przyciski, stopka): cel jest odsłonięty, zanim przewijanie się skończy
  function revealTarget(hash) {
    if (!hash || hash.length < 2) return;
    var target = null;
    try { target = document.querySelector(hash); } catch (err) { return; }
    if (!target) return;
    var els = Array.prototype.slice.call(target.querySelectorAll('[data-reveal]'));
    if (target.hasAttribute('data-reveal')) els.push(target);
    els.forEach(function (el) {
      el.classList.add('is-in');
      if (io) io.unobserve(el);
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) revealTarget(a.getAttribute('href'));
  }, true);
  if (window.location.hash) revealTarget(window.location.hash);

  /* --- Odliczanie ---------------------------------------------------------------------------- */

  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  var LABELS = {
    days: ['dzień', 'dni', 'dni'],
    hours: ['godzina', 'godziny', 'godzin'],
    minutes: ['minuta', 'minuty', 'minut'],
    seconds: ['sekunda', 'sekundy', 'sekund']
  };

  // Bęben cyfry: pas 9..0 + jedna komórka zapasowa na przejście 0 → 9 (albo 0 → 3 przy godzinach)
  function Drum(holder) {
    var drum = document.createElement('span');
    drum.className = 'drum';
    var reel = document.createElement('span');
    reel.className = 'reel';
    for (var i = 9; i >= 0; i--) {
      var c = document.createElement('span');
      c.textContent = i;
      reel.appendChild(c);
    }
    var spare = document.createElement('span');
    reel.appendChild(spare);
    drum.appendChild(reel);
    holder.appendChild(drum);
    this.reel = reel;
    this.spare = spare;
    this.value = 0;
    this.place(0, true);
  }
  Drum.prototype.place = function (index, snap) {
    this.reel.classList.toggle('is-snap', !!snap);
    this.reel.style.transform = 'translateY(' + (-1.2 * index) + 'em)';
  };
  Drum.prototype.set = function (d, wind) {
    var self = this;
    if (d === this.value) return;
    this.reel.classList.toggle('is-wind', !!wind);
    if (!wind && d > this.value) {
      // licznik maleje: przejście w górę ("zawinięcie") przewija o jedną pozycję dalej
      this.spare.textContent = d;
      this.place(9 - this.value, true);
      void this.reel.offsetWidth;
      this.place(10, false);
      clearTimeout(this.t);
      this.t = setTimeout(function () { self.place(9 - d, true); }, 850);
    } else {
      this.place(9 - d, false);
    }
    this.value = d;
  };

  var countEl = document.getElementById('countdown');
  var countSr = document.getElementById('count-sr');
  var countTitle = document.getElementById('count-title');
  var units = {};
  var started = false;
  var lastSrMinute = -1;

  if (countEl) {
    countEl.querySelectorAll('.drum-unit').forEach(function (unit) {
      var set = unit.querySelector('.drum-set');
      var n = Number(unit.getAttribute('data-digits'));
      var drums = [];
      for (var i = 0; i < n; i++) drums.push(new Drum(set));
      units[unit.getAttribute('data-unit')] = { drums: drums, label: unit.querySelector('.drum-lbl') };
    });
  }

  function remaining() {
    var diff = Math.max(0, WEDDING - new Date());
    return {
      diff: diff,
      days: Math.floor(diff / 864e5),
      hours: Math.floor(diff / 36e5) % 24,
      minutes: Math.floor(diff / 6e4) % 60,
      seconds: Math.floor(diff / 1e3) % 60
    };
  }

  function tick(wind) {
    if (!countEl) return;
    var v = remaining();
    Object.keys(units).forEach(function (k) {
      var u = units[k];
      var digits = String(Math.min(v[k], Math.pow(10, u.drums.length) - 1)).padStart(u.drums.length, '0');
      u.drums.forEach(function (drum, i) { drum.set(Number(digits[i]), wind); });
      u.label.textContent = plural(v[k], LABELS[k][0], LABELS[k][1], LABELS[k][2]);
    });
    var minuteKey = Math.floor(v.diff / 6e4);
    if (countSr && minuteKey !== lastSrMinute) {
      lastSrMinute = minuteKey;
      countSr.textContent = 'Do ślubu zostało ' + v.days + ' ' + plural(v.days, 'dzień', 'dni', 'dni') + ', ' +
        v.hours + ' ' + plural(v.hours, 'godzina', 'godziny', 'godzin') + ' i ' +
        v.minutes + ' ' + plural(v.minutes, 'minuta', 'minuty', 'minut') + '.';
    }
    if (v.diff === 0 && countTitle) {
      countTitle.textContent = new Date() - WEDDING > 864e5 ? 'Dziękujemy, że byliście z nami' : 'To już dziś!';
    }
  }

  function startClock() {
    if (started) return;
    started = true;
    tick(true);
    // kolejne tyknięcia równo z pełną sekundą
    setTimeout(function loop() {
      tick(false);
      setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    }, 1900);
  }

  if (countEl) {
    if ('IntersectionObserver' in window && !document.documentElement.classList.contains('is-preview')) {
      var countIo = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { startClock(); countIo.disconnect(); }
      }, { threshold: 0.35 });
      countIo.observe(countEl);
    } else {
      startClock();
    }
  }

  /* --- Kopiowanie adresów --------------------------------------------------------------------- */

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // data-copy-text ma pierwszeństwo (pełny adres, gdy na stronie jest skrót)
      var text = btn.getAttribute('data-copy-text');
      if (!text) {
        var src = document.querySelector(btn.getAttribute('data-copy'));
        if (!src) return;
        text = src.textContent.trim();
      }
      copyText(text)
        .then(function () { toast('Skopiowano adres'); })
        .catch(function () { toast('Nie udało się skopiować. Zaznaczcie adres ręcznie.'); });
    });
  });

  /* --- Kalendarz ------------------------------------------------------------------------------- */

  var EVENT = {
    title: 'Ślub i wesele Emilii i Olka',
    details: '15:00 Ceremonia: Parafia pw. Przemienienia Pańskiego, Opławiec, Bydgoszcz\n' +
             '17:15 Wesele: Dwór Hulanka, ul. Pawłówek 6, 85-438 Bydgoszcz\n\n' +
             'Prosimy o odpowiedź do 1 maja 2027.',
    location: 'Parafia pw. Przemienienia Pańskiego, Opławiec, Bydgoszcz',
    start: '20270808T130000Z',
    end: '20270809T030000Z'
  };

  var calGoogle = document.getElementById('cal-google');
  if (calGoogle) {
    calGoogle.addEventListener('click', function () {
      var u = new URL('https://calendar.google.com/calendar/render');
      u.searchParams.set('action', 'TEMPLATE');
      u.searchParams.set('text', EVENT.title);
      u.searchParams.set('dates', EVENT.start + '/' + EVENT.end);
      u.searchParams.set('details', EVENT.details);
      u.searchParams.set('location', EVENT.location);
      window.open(u.toString(), '_blank', 'noopener');
    });
  }

  var calIcs = document.getElementById('cal-ics');
  if (calIcs) {
    calIcs.addEventListener('click', function () {
      function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
      var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      var ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Emilia i Olek//Zaproszenie//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:slub-emilia-olek-20270808@zaproszenie',
        'DTSTAMP:' + stamp,
        'DTSTART:' + EVENT.start,
        'DTEND:' + EVENT.end,
        'SUMMARY:' + esc(EVENT.title),
        'DESCRIPTION:' + esc(EVENT.details),
        'LOCATION:' + esc(EVENT.location),
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Slub-Emilia-i-Olek-2027.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Pobrano plik kalendarza');
    });
  }

  /* --- Galeria: lightbox ------------------------------------------------------------------------- */

  var lb = document.getElementById('lightbox');
  var lbFrame = document.getElementById('lb-frame');
  var lbCap = document.getElementById('lb-cap');
  var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-grid .g'));
  var current = 0;
  var lastFocus = null;

  function showItem(i) {
    current = (i + items.length) % items.length;
    var item = items[current];
    var thumb = item.querySelector('img');
    var img = document.createElement('img');
    var fullSrc = item.getAttribute('data-full') || thumb.src;
    // od razu miniatura (już w pamięci), ostra wersja podmienia się po wczytaniu;
    // proporcje z miniatury trzymają ramę w docelowym rozmiarze, bez skoku
    img.src = thumb.currentSrc || thumb.src;
    img.alt = thumb.alt;
    if (thumb.naturalWidth && thumb.naturalHeight) {
      img.style.setProperty('--r', thumb.naturalWidth / thumb.naturalHeight);
      img.classList.add('is-sized');
    }
    lbFrame.replaceChildren(img);
    var full = new Image();
    full.onload = function () { if (items[current] === item) img.src = full.src; };
    full.src = fullSrc;
    // sąsiednie zdjęcia czekają już w pamięci podręcznej
    [current - 1, current + 1].forEach(function (n) {
      var near = items[(n + items.length) % items.length];
      var src = near && near.getAttribute('data-full');
      if (src) (new Image()).src = src;
    });
    if (lbCap) {
      lbFrame.appendChild(lbCap);
      var alt = document.createElement('span');
      alt.className = 'lb-cap-alt';
      alt.textContent = thumb.alt;
      var count = document.createElement('span');
      count.className = 'lb-cap-count';
      count.textContent = (current + 1) + ' / ' + items.length;
      lbCap.replaceChildren(alt, count);
    }
  }

  if (lb && lbFrame && items.length && typeof lb.showModal === 'function') {
    items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        lastFocus = item;
        showItem(i);
        lb.showModal();
        // strona pod lightboxem stoi w miejscu (iOS przewija ją przeciągnięciem)
        document.documentElement.classList.add('lb-locked');
      });
    });
    document.getElementById('lb-close').addEventListener('click', function () { lb.close(); });
    document.getElementById('lb-prev').addEventListener('click', function () { showItem(current - 1); });
    document.getElementById('lb-next').addEventListener('click', function () { showItem(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbFrame) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showItem(current - 1);
      if (e.key === 'ArrowRight') showItem(current + 1);
    });
    lb.addEventListener('close', function () {
      document.documentElement.classList.remove('lb-locked');
      lbFrame.replaceChildren();
      if (lastFocus) lastFocus.focus();
    });

    // przesunięcie palcem na telefonie
    var startX = null;
    lb.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) showItem(current + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* --- Generator linków ------------------------------------------------------------------------- */

  var gen = document.getElementById('gen');
  var genOpen = document.getElementById('gen-open');
  var genName = document.getElementById('gen-name');
  var genOut = document.getElementById('gen-out');
  var genCopy = document.getElementById('gen-copy');

  function genLink() {
    var base = window.location.origin + window.location.pathname;
    var name = genName.value.trim();
    return name ? base + '?gosc=' + encodeURIComponent(name).replace(/%20/g, '+') : '';
  }

  // generator widzi tylko Para Młoda: adres z ?para (np. index.html?para)
  var isCouple = new URLSearchParams(window.location.search).has('para');
  if (genOpen) genOpen.hidden = !isCouple;

  if (isCouple && gen && genOpen && typeof gen.showModal === 'function') {
    genOpen.addEventListener('click', function () { gen.showModal(); genName.focus(); });
    genName.addEventListener('input', function () {
      genOut.textContent = genLink() || 'Link pojawi się tutaj';
    });
    genCopy.addEventListener('click', function () {
      var link = genLink();
      if (!link) { toast('Najpierw wpiszcie zwrot do Gościa'); genName.focus(); return; }
      copyText(link)
        .then(function () { toast('Skopiowano link'); })
        .catch(function () { toast('Nie udało się skopiować linku'); });
    });
  }
})();
