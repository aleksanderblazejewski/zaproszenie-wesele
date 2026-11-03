/* ==========================================================================
   Karta odpowiedzi (RSVP)
   Odpowiedź zapisuje się w przeglądarce Gościa (localStorage). Do Pary
   Młodej trafia dopiero, gdy Gość wyśle podsumowanie: WhatsApp, SMS, e-mail
   albo skopiowaną treść w dowolnej wiadomości.
   ========================================================================== */

(function () {
  'use strict';

  // DO UZUPEŁNIENIA przez Parę Młodą: numer w formacie 48XXXXXXXXX (bez +), e-mail.
  // Puste pole ukrywa dany przycisk; zostaje zawsze "Kopiuj treść odpowiedzi".
  var COUPLE = { whatsapp: '', sms: '', email: '', name: 'Emilia i Olek', nameTo: 'Emilii i Olka' };

  var STORAGE_KEY = 'emilia-olek-rsvp-2027';

  var form = document.getElementById('rsvp-form');
  var done = document.getElementById('rsvp-done');
  if (!form || !done) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var nameInput = document.getElementById('rsvp-name');
  var adultsSelect = document.getElementById('rsvp-adults');
  var attendOnly = document.getElementById('attend-only');
  var errName = document.getElementById('err-name');
  var errAttend = document.getElementById('err-attend');
  var radios = form.querySelectorAll('input[name="attendance"]');
  var summary = document.getElementById('done-summary');
  var doneTitle = document.getElementById('done-title');
  var doneLead = document.getElementById('done-lead');
  var editBtn = document.getElementById('rsvp-edit');
  var sendWa = document.getElementById('send-wa');
  var sendSms = document.getElementById('send-sms');
  var sendMail = document.getElementById('send-mail');
  var sendCopy = document.getElementById('send-copy');
  var fallback = document.getElementById('done-fallback');
  var summaryLabel = document.getElementById('done-summary-label');

  var LEAD_PRE = doneLead.innerHTML;
  // bez kanałów kopiowanie jest jedyną drogą: jedno zdanie zamiast leadu i notatki
  var LEAD_PRE_COPY = '<strong>Ostatni krok:</strong> skopiujcie treść i wyślijcie ją Emilii lub Olkowi w dowolnej wiadomości. Dopiero wtedy do nas dotrze.';
  var COPY_LABEL = 'Kopiuj treść odpowiedzi';
  var COPY_AGAIN = 'Skopiuj ponownie';
  var LEAD_SENT = 'Jeśli wiadomość nie wyszła, wyślijcie ją ponownie.';
  // skopiowanie to jeszcze nie wysłanie: osobny, uczciwy stan
  var LEAD_COPIED = '<strong>Ostatni krok:</strong> wklejcie ją teraz w wiadomości do Emilii lub Olka. Dopiero wtedy do\u00A0nas dotrze.';
  var current = null;

  // z formy grzecznościowej na kopercie zostawiamy same imiona
  if (window.weddingGuest && !nameInput.value) {
    nameInput.value = window.weddingGuest
      .replace(/^(Sz\.?\s*P\.?|Szanown\S*(\s+Państw\S*)?|Państw\S*)\s+/i, '')
      .trim();
  }
  // para lub "Państwo" w zwrocie: domyślnie 2 osoby, w innym razie 1
  if (adultsSelect) {
    adultsSelect.value = window.weddingGuest && /\si\s|Państw/i.test(window.weddingGuest) ? '2' : '1';
  }

  /* --- kanały wysyłki ------------------------------------------------------ */

  function setLabel(btn, text) { btn.querySelector('span').textContent = text; }
  var channels = [
    [sendWa, COUPLE.whatsapp, 'WhatsApp'],
    [sendSms, COUPLE.sms, 'SMS'],
    [sendMail, COUPLE.email, 'E-mail']
  ];
  var anyChannel = false;
  channels.forEach(function (c) {
    var on = !!c[1];
    c[0].hidden = !on;
    if (on) { anyChannel = true; setLabel(c[0], c[2] + ' do ' + COUPLE.nameTo); }
  });
  // bez numeru i adresu kopiowanie jest jedyną drogą: przycisk staje się główny
  sendCopy.classList.toggle('btn-black', !anyChannel);
  sendCopy.classList.toggle('btn-line', anyChannel);

  /* --- formularz ------------------------------------------------------------ */

  function attendance() {
    var r = form.querySelector('input[name="attendance"]:checked');
    return r ? r.value : null;
  }

  function syncAttend() {
    attendOnly.hidden = attendance() !== 'yes';
  }
  function setAttendInvalid(bad) {
    radios.forEach(function (r) {
      if (bad) r.setAttribute('aria-invalid', 'true');
      else r.removeAttribute('aria-invalid');
    });
  }
  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      errAttend.hidden = true;
      setAttendInvalid(false);
      syncAttend();
    });
  });
  nameInput.addEventListener('input', function () {
    if (nameInput.value.trim()) {
      errName.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    }
  });
  syncAttend();

  function collect() {
    var f = new FormData(form);
    return {
      name: (f.get('name') || '').trim(),
      attendance: attendance(),
      adults: f.get('adults'),
      children: f.get('children'),
      diet: f.get('diet'),
      song: (f.get('song') || '').trim(),
      phone: (f.get('phone') || '').trim(),
      notes: (f.get('notes') || '').trim()
    };
  }

  function rows(d) {
    var yes = d.attendance === 'yes';
    var list = [['Gość', d.name], ['Odpowiedź', yes ? 'Z radością przybędziemy' : 'Niestety, nie możemy przybyć']];
    if (yes) {
      var people = d.adults + ' dorosł' + (d.adults === '1' ? 'a osoba' : (Number(d.adults) < 5 ? 'e osoby' : 'ych osób'));
      if (d.children !== '0') people += ', dzieci: ' + d.children;
      list.push(['Osoby', people]);
      list.push(['Menu', d.diet]);
      if (d.song) list.push(['Piosenka', d.song]);
    }
    if (d.phone) list.push(['Telefon', d.phone]);
    if (d.notes) list.push(['Wiadomość', d.notes]);
    return list;
  }

  function message(d) {
    var lines = [COUPLE.name + ', oto nasza odpowiedź na zaproszenie (8 sierpnia 2027):', ''];
    rows(d).forEach(function (r) { lines.push(r[0] + ': ' + r[1]); });
    return lines.join('\n');
  }

  function save(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (err) { /* tryb prywatny */ }
  }

  // stan nagłówka: "returning" = powrót z zapisaną, jeszcze niewysłaną odpowiedzią
  function status(d, returning) {
    var yes = d.attendance === 'yes';
    if (d.sentVia === 'copy') {
      doneTitle.textContent = 'Treść skopiowana';
      doneLead.innerHTML = LEAD_COPIED;
    } else if (d.sentVia) {
      doneTitle.textContent = yes ? 'Dziękujemy, do zobaczenia!' : 'Dziękujemy za odpowiedź';
      doneLead.textContent = LEAD_SENT;
    } else {
      doneTitle.textContent = returning ? 'Wasza odpowiedź czeka na wysłanie' : 'Prawie gotowe';
      doneLead.innerHTML = anyChannel ? LEAD_PRE : LEAD_PRE_COPY;
    }
    setLabel(sendCopy, d.sentVia === 'copy' ? COPY_AGAIN : COPY_LABEL);
  }

  function render(d, returning) {
    current = d;
    status(d, returning);

    var dl = document.createElement('dl');
    rows(d).forEach(function (r) {
      var row = document.createElement('div');
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = r[0];
      dd.textContent = r[1];
      row.append(dt, dd);
      dl.appendChild(row);
    });
    summary.replaceChildren(dl);

    var text = encodeURIComponent(message(d));
    var subject = encodeURIComponent('Odpowiedź na zaproszenie: ' + d.name);
    sendWa.href = 'https://wa.me/' + COUPLE.whatsapp + '?text=' + text;
    sendSms.href = 'sms:' + (COUPLE.sms ? '+' + COUPLE.sms : '') + '?body=' + text;
    sendMail.href = 'mailto:' + COUPLE.email + '?subject=' + subject + '&body=' + text;

    showFallback(false);
    form.hidden = true;
    done.hidden = false;
  }

  // pole awaryjne samo jest treścią odpowiedzi: na ten czas chowamy podsumowanie pod nim
  function showFallback(on) {
    fallback.hidden = !on;
    summaryLabel.hidden = on;
    summary.hidden = on;
    if (!on) { fallback.value = ''; fallback.style.height = ''; }
  }

  function markSent(via) {
    if (!current) return;
    current.sentVia = via;
    current.sentAt = new Date().toISOString();
    save(current);
    status(current, false);
  }

  [[sendWa, 'whatsapp'], [sendSms, 'sms'], [sendMail, 'email']].forEach(function (c) {
    c[0].addEventListener('click', function () { markSent(c[1]); });
  });
  sendCopy.addEventListener('click', function () {
    if (!current || !window.weddingCopy) return;
    window.weddingCopy(message(current))
      .then(function () {
        showFallback(false);
        markSent('copy');
        if (window.weddingToast) window.weddingToast('Skopiowano treść odpowiedzi.');
      })
      .catch(function () {
        // pokazujemy całą treść zaznaczoną: skrót klawiszowy albo przytrzymanie palcem
        fallback.value = message(current);
        showFallback(true);
        fallback.style.height = 'auto';
        // scrollHeight nie liczy obramowania (box-sizing: border-box)
        fallback.style.height = (fallback.scrollHeight + fallback.offsetHeight - fallback.clientHeight) + 'px';
        fallback.focus({ preventScroll: true });
        fallback.select();
        fallback.setSelectionRange(0, fallback.value.length);
        fallback.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'nearest' });
        var fine = window.matchMedia('(pointer: fine)').matches;
        if (window.weddingToast) window.weddingToast(fine
          ? 'Zaznaczyliśmy treść poniżej. Skopiujcie ją skrótem Ctrl+C (na Macu ⌘C).'
          : 'Zaznaczyliśmy treść poniżej. Przytrzymajcie ją palcem i wybierzcie „Kopiuj”.');
      });
  });

  function fill(d) {
    ['name', 'adults', 'children', 'diet', 'song', 'phone', 'notes'].forEach(function (k) {
      if (form.elements[k] && d[k] != null) form.elements[k].value = d[k];
    });
    var r = form.querySelector('input[name="attendance"][value="' + d.attendance + '"]');
    if (r) r.checked = true;
    syncAttend();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = collect();
    var firstBad = null;

    if (!d.name) {
      errName.hidden = false;
      nameInput.setAttribute('aria-invalid', 'true');
      firstBad = nameInput;
    }
    if (!d.attendance) {
      errAttend.hidden = false;
      setAttendInvalid(true);
      firstBad = firstBad || radios[0];
    }
    if (firstBad) { firstBad.focus(); return; }

    // nowa (lub zmieniona) odpowiedź trzeba wysłać od nowa
    save(d);
    render(d, false);
    done.focus({ preventScroll: true });
    done.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  });

  editBtn.addEventListener('click', function () {
    done.hidden = true;
    form.hidden = false;
    nameInput.focus();
  });

  // Powrót Gościa: pokazujemy zapisaną odpowiedź
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.name && saved.attendance) {
      fill(saved);
      render(saved, true);
    }
  } catch (err) { /* brak dostępu do pamięci */ }
})();
