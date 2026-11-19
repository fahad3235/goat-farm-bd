/* Goat Farm BD \u2014 UI app (vanilla JS, localStorage, offline).
 * Reads ?asof=YYYY-MM-DD for deterministic testing; otherwise uses today. */
(function () {
  'use strict';
  var L = window.GoatFarmLogic;
  var D = window.GoatFarmData;
  var I = window.GoatFarmI18n;

  var params = new URLSearchParams(location.search);
  var ASOF = params.get('asof') || L.todayISO();
  var lang = localStorage.getItem(D.LANG_KEY) || 'en';
  if (lang !== 'en' && lang !== 'bn') lang = 'en';

  var state = load();
  var tab = 'dash';
  var goatFilter = { q: '', status: 'all', sex: 'all' };
  var editingGoatId = null;

  function load() {
    try {
      var raw = localStorage.getItem(D.STORAGE_KEY);
      if (!raw) return L.emptyState();
      var parsed = L.parseImport(raw);
      if (parsed.ok) return parsed.data;
      return L.emptyState();
    } catch (e) { return L.emptyState(); }
  }
  function save() {
    localStorage.setItem(D.STORAGE_KEY, JSON.stringify(state));
  }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function t(k) { return I.t(k, lang); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function goatLabel(g) {
    return g.tag + (g.name ? ' (' + g.name + ')' : '');
  }
  function money(n) { return L.formatMoney(n, lang); }
  function num(n) { return L.formatNum(n, lang); }
  function showMsg(el, text, isErr) {
    el.textContent = text;
    el.className = 'msg ' + (isErr ? 'err' : 'ok');
    el.hidden = false;
  }

  /* ---------- render shell ---------- */
  var root = document.getElementById('app');
  root.innerHTML =
    '<header><h1 id="appTitle"></h1><p id="appSub" class="sub"></p>' +
    '<div class="langrow"><button id="langBtn" class="langbtn"></button></div></header>' +
    '<nav id="tabs" class="tabs"></nav>' +
    '<main id="view"></main>' +
    '<footer><p id="disclaimer" class="disclaimer"></p></footer>';
  var view = document.getElementById('view');

  var TABS = ['dash', 'goats', 'health', 'breeding', 'money', 'data'];
  function renderTabs() {
    document.getElementById('tabs').innerHTML = TABS.map(function (k) {
      return '<button data-tab="' + k + '" class="tabbtn' + (tab === k ? ' active' : '') + '">' + esc(t('tab' + k[0].toUpperCase() + k.slice(1))) + '</button>';
    }).join('');
    document.querySelectorAll('#tabs .tabbtn').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.dataset.tab; render(); });
    });
  }

  function render() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.getElementById('appTitle').textContent = t('appTitle');
    document.getElementById('appSub').textContent = t('appSub');
    document.getElementById('disclaimer').textContent = t('disclaimer');
    var lb = document.getElementById('langBtn');
    lb.textContent = lang === 'en' ? '\u09ac\u09be\u0982\u09b2\u09be' : 'English';
    lb.onclick = function () {
      lang = lang === 'en' ? 'bn' : 'en';
      localStorage.setItem(D.LANG_KEY, lang);
      render();
    };
    renderTabs();
    if (tab === 'dash') renderDash();
    else if (tab === 'goats') renderGoats();
    else if (tab === 'health') renderHealth();
    else if (tab === 'breeding') renderBreeding();
    else if (tab === 'money') renderMoney();
    else renderData();
  }

  function statCard(label, value, sub) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value">' + esc(value) + '</div>' +
      (sub ? '<div class="stat-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  function renderDash() {
    var d = L.computeDashboard(state, ASOF);
    var upH = L.upcomingHealth(state, ASOF, 30);
    var upK = L.upcomingKidding(state, ASOF, 30);
    var h = '<section><h2>' + esc(t('tabDash')) + '</h2><div class="stats">' +
      statCard(t('alive'), num(d.alive), t('does') + ' ' + num(d.does) + ' \u00b7 ' + t('bucks') + ' ' + num(d.bucks) + ' \u00b7 ' + t('kids') + ' ' + num(d.kids)) +
      statCard(t('invested'), money(d.invested), t('sales') + ' ' + money(d.salesTotal)) +
      statCard(t('profit'), money(d.profit), t('sold') + ' ' + num(d.sold) + ' \u00b7 ' + t('dead') + ' ' + num(d.dead)) +
      statCard(t('expecting'), num(d.expecting), t('kidsBorn') + ' ' + num(d.kidsBorn) + ' (' + t('kidsAliveL') + ' ' + num(d.kidsAlive) + ')') +
      '</div>';
    h += '<h3>' + esc(t('upcomingVacc')) + '</h3>';
    if (!upH.length) h += '<p class="muted">' + esc(t('noneDue')) + '</p>';
    else h += '<ul class="list">' + upH.map(function (x) {
      var g = state.goats.find(function (gg) { return gg.id === x.record.goatId; });
      return '<li><strong>' + esc(g ? goatLabel(g) : '?') + '</strong> \u2014 ' + esc(x.record.detail) +
        ' \u00b7 ' + esc(x.record.nextDue) + ' (' + (x.daysLeft === 0 ? esc(t('today')) : num(x.daysLeft) + ' ' + esc(t('daysLeft'))) + ')</li>';
    }).join('') + '</ul>';
    h += '<h3>' + esc(t('upcomingKid')) + '</h3>';
    if (!upK.length) h += '<p class="muted">' + esc(t('noneDue')) + '</p>';
    else h += '<ul class="list">' + upK.map(function (x) {
      var g = state.goats.find(function (gg) { return gg.id === x.record.doeId; });
      return '<li><strong>' + esc(g ? goatLabel(g) : '?') + '</strong> \u2014 ' + esc(x.record.expectedDate) +
        ' (' + (x.daysLeft === 0 ? esc(t('today')) : num(x.daysLeft) + ' ' + esc(t('daysLeft'))) + ')</li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;
  }

  function breedOptions(sel) {
    return D.BREEDS.map(function (b) {
      return '<option value="' + b + '"' + (b === sel ? ' selected' : '') + '>' + esc(t(b.replace(/ /g, ''))) + '</option>';
    }).join('');
  }
  function sexOptions(sel) {
    return D.SEXES.map(function (s) {
      return '<option value="' + s + '"' + (s === sel ? ' selected' : '') + '>' + esc(t(s)) + '</option>';
    }).join('');
  }
  function statusOptions(sel) {
    return D.GOAT_STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === sel ? ' selected' : '') + '>' + esc(t(s)) + '</option>';
    }).join('');
  }
  function goatOptions(selId, onlySex) {
    return state.goats.filter(function (g) {
      return g.status === 'alive' && (!onlySex || g.sex === onlySex);
    }).map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === selId ? ' selected' : '') + '>' + esc(goatLabel(g)) + '</option>';
    }).join('');
  }

  function renderGoats() {
    var list = state.goats.filter(function (g) {
      if (goatFilter.status !== 'all' && g.status !== goatFilter.status) return false;
      if (goatFilter.sex !== 'all' && g.sex !== goatFilter.sex) return false;
      if (goatFilter.q) {
        var q = goatFilter.q.toLowerCase();
        if ((g.tag + ' ' + (g.name || '')).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
    var g = editingGoatId ? state.goats.find(function (x) { return x.id === editingGoatId; }) : null;
    var h = '<section><h2>' + esc(t('tabGoats')) + ' (' + num(state.goats.length) + ')</h2>' +
      '<form id="goatForm" class="card"><h3>' + esc(editingGoatId ? t('edit') : t('addGoat')) + '</h3>' +
      '<div class="grid">' +
      '<label>' + esc(t('tag')) + ' *<input id="fTag" maxlength="20" value="' + esc(g ? g.tag : '') + '"></label>' +
      '<label>' + esc(t('nameOpt')) + '<input id="fName" maxlength="40" value="' + esc(g ? (g.name || '') : '') + '"></label>' +
      '<label>' + esc(t('breed')) + '<select id="fBreed">' + breedOptions(g ? g.breed : 'Black Bengal') + '</select></label>' +
      '<label>' + esc(t('sex')) + '<select id="fSex">' + sexOptions(g ? g.sex : 'doe') + '</select></label>' +
      '<label>' + esc(t('dob')) + '<input id="fDob" type="date" value="' + esc(g ? (g.dob || '') : '') + '"></label>' +
      '<label>' + esc(t('acquired')) + '<input id="fAcq" type="date" value="' + esc(g ? (g.acquiredDate || '') : ASOF) + '"></label>' +
      '<label>' + esc(t('purchasePrice')) + '<input id="fPrice" type="number" min="0" step="1" value="' + (g && g.purchasePrice ? g.purchasePrice : '') + '"></label>' +
      '<label>' + esc(t('status')) + '<select id="fStatus">' + statusOptions(g ? g.status : 'alive') + '</select></label>' +
      '</div><label class="full">' + esc(t('notes')) + '<input id="fNotes" maxlength="120" value="' + esc(g ? (g.notes || '') : '') + '"></label>' +
      '<div class="row"><button type="submit" class="primary">' + esc(t('save')) + '</button>' +
      (editingGoatId ? '<button type="button" id="cancelEdit" class="ghost">' + esc(t('cancel')) + '</button>' : '') + '</div>' +
      '<p id="goatMsg" class="msg" hidden></p></form>' +
      '<div class="filters"><input id="qSearch" placeholder="' + esc(t('searchTag')) + '" value="' + esc(goatFilter.q) + '">' +
      '<select id="qStatus"><option value="all">' + esc(t('status')) + ': ' + esc(t('all')) + '</option>' + statusOptions(goatFilter.status === 'all' ? '' : goatFilter.status) + '</select>' +
      '<select id="qSex"><option value="all">' + esc(t('sex')) + ': ' + esc(t('all')) + '</option>' + sexOptions(goatFilter.sex === 'all' ? '' : goatFilter.sex) + '</select></div>';
    if (!list.length) h += '<p class="muted">' + esc(t('noGoats')) + '</p>';
    else h += '<ul class="list cards">' + list.map(function (gg) {
      return '<li class="gcard"><div><strong>' + esc(goatLabel(gg)) + '</strong> \u00b7 ' + esc(t(gg.breed.replace(/ /g, ''))) + ' \u00b7 ' + esc(t(gg.sex)) +
        (gg.dob ? ' \u00b7 ' + esc(t('age')) + ' ' + esc(L.ageLabel(gg.dob, ASOF, lang)) : '') +
        '<br><span class="muted">' + esc(t(gg.status)) + (gg.purchasePrice ? ' \u00b7 ' + money(gg.purchasePrice) : '') + (gg.notes ? ' \u00b7 ' + esc(gg.notes) : '') + '</span></div>' +
        '<div class="row"><button data-edit="' + gg.id + '" class="ghost">' + esc(t('edit')) + '</button>' +
        '<button data-del="' + gg.id + '" class="danger">' + esc(t('del')) + '</button></div></li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;

    document.getElementById('goatForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var rec = {
        id: editingGoatId || uid(),
        tag: document.getElementById('fTag').value.trim(),
        name: document.getElementById('fName').value.trim(),
        breed: document.getElementById('fBreed').value,
        sex: document.getElementById('fSex').value,
        dob: document.getElementById('fDob').value,
        acquiredDate: document.getElementById('fAcq').value,
        purchasePrice: document.getElementById('fPrice').value === '' ? 0 : Number(document.getElementById('fPrice').value),
        status: document.getElementById('fStatus').value,
        notes: document.getElementById('fNotes').value.trim(),
      };
      var others = state.goats.filter(function (x) { return x.id !== rec.id; }).map(function (x) { return x.tag; });
      var errs = L.validateGoat(rec, others);
      var msg = document.getElementById('goatMsg');
      if (errs.length) { showMsg(msg, t('errRequired') + ' (' + errs[0] + ')', true); return; }
      if (editingGoatId) {
        var ix = state.goats.findIndex(function (x) { return x.id === editingGoatId; });
        state.goats[ix] = rec; editingGoatId = null;
      } else state.goats.push(rec);
      save(); render();
      showMsg(document.getElementById('goatMsg'), t('saved'), false);
    });
    var ce = document.getElementById('cancelEdit');
    if (ce) ce.addEventListener('click', function () { editingGoatId = null; render(); });
    document.getElementById('qSearch').addEventListener('input', function (e) { goatFilter.q = e.target.value; renderGoatsListOnly(); });
    document.getElementById('qStatus').addEventListener('change', function (e) { goatFilter.status = e.target.value; render(); });
    document.getElementById('qSex').addEventListener('change', function (e) { goatFilter.sex = e.target.value; render(); });
    view.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editingGoatId = b.dataset.edit; render(); });
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(t('confirmDelete'))) return;
        state.goats = state.goats.filter(function (x) { return x.id !== b.dataset.del; });
        state.health = state.health.filter(function (x) { return x.goatId !== b.dataset.del; });
        state.breeding = state.breeding.filter(function (x) { return x.doeId !== b.dataset.del; });
        state.sales = state.sales.filter(function (x) { return x.goatId !== b.dataset.del; });
        save(); render();
      });
    });

    function renderGoatsListOnly() {
      // Re-render whole tab but keep focus in the search box.
      var pos = document.getElementById('qSearch').selectionStart;
      render();
      var q = document.getElementById('qSearch');
      q.focus(); q.setSelectionRange(pos, pos);
    }
  }

  function renderHealth() {
    var sorted = state.health.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var h = '<section><h2>' + esc(t('tabHealth')) + ' (' + num(state.health.length) + ')</h2>' +
      '<form id="healthForm" class="card"><h3>' + esc(t('addHealth')) + '</h3><div class="grid">' +
      '<label>' + esc(t('goat')) + ' *<select id="hGoat">' + goatOptions(null, null) + '</select></label>' +
      '<label>' + esc(t('kind')) + '<select id="hKind">' + D.HEALTH_KINDS.map(function (k) { return '<option value="' + k + '">' + esc(t(k)) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('medicine')) + ' *<input id="hDetail" list="medList" maxlength="60" placeholder="' + esc(t('pickMedicine')) + '"><datalist id="medList">' +
      D.COMMON_MEDICINES.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist></label>' +
      '<label>' + esc(t('date')) + ' *<input id="hDate" type="date" value="' + ASOF + '"></label>' +
      '<label>' + esc(t('cost')) + '<input id="hCost" type="number" min="0" step="1"></label>' +
      '<label>' + esc(t('nextDue')) + '<input id="hNext" type="date"></label>' +
      '</div><div class="row"><button type="submit" class="primary">' + esc(t('save')) + '</button></div>' +
      '<p id="healthMsg" class="msg" hidden></p></form>';
    if (!sorted.length) h += '<p class="muted">' + esc(t('noHealth')) + '</p>';
    else h += '<ul class="list">' + sorted.map(function (r) {
      var g = state.goats.find(function (gg) { return gg.id === r.goatId; });
      return '<li><strong>' + esc(g ? goatLabel(g) : '?') + '</strong> \u2014 ' + esc(t(r.kind)) + ': ' + esc(r.detail) +
        ' \u00b7 ' + esc(r.date) + (r.cost ? ' \u00b7 ' + money(r.cost) : '') + (r.nextDue ? ' \u00b7 ' + esc(t('nextDue')) + ' ' + esc(r.nextDue) : '') +
        ' <button data-del="' + r.id + '" class="danger small">' + esc(t('del')) + '</button></li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;
    document.getElementById('healthForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var rec = {
        id: uid(),
        goatId: document.getElementById('hGoat').value,
        kind: document.getElementById('hKind').value,
        detail: document.getElementById('hDetail').value.trim(),
        date: document.getElementById('hDate').value,
        cost: document.getElementById('hCost').value === '' ? 0 : Number(document.getElementById('hCost').value),
        nextDue: document.getElementById('hNext').value,
      };
      var ids = state.goats.map(function (g) { return g.id; });
      var errs = L.validateHealth(rec, ids);
      var msg = document.getElementById('healthMsg');
      if (errs.length) { showMsg(msg, t('errRequired') + ' (' + errs[0] + ')', true); return; }
      state.health.push(rec); save(); render();
      showMsg(document.getElementById('healthMsg'), t('saved'), false);
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(t('confirmDelete'))) return;
        state.health = state.health.filter(function (x) { return x.id !== b.dataset.del; });
        save(); render();
      });
    });
  }

  function renderBreeding() {
    var sorted = state.breeding.slice().sort(function (a, b) { return b.breedingDate.localeCompare(a.breedingDate); });
    var h = '<section><h2>' + esc(t('tabBreeding')) + ' (' + num(state.breeding.length) + ')</h2>' +
      '<form id="breedForm" class="card"><h3>' + esc(t('addBreeding')) + '</h3><div class="grid">' +
      '<label>' + esc(t('doe')) + ' *<select id="bDoe">' + goatOptions(null, 'doe') + '</select></label>' +
      '<label>' + esc(t('buckTag')) + '<input id="bBuck" maxlength="20"></label>' +
      '<label>' + esc(t('breedingDate')) + ' *<input id="bDate" type="date" value="' + ASOF + '"></label>' +
      '<label>' + esc(t('expectedDate')) + '<input id="bExpected" type="date" readonly></label>' +
      '<label>' + esc(t('actualDate')) + '<input id="bActual" type="date"></label>' +
      '<label>' + esc(t('kidsBornL')) + '<input id="bBorn" type="number" min="0" max="6" step="1"></label>' +
      '<label>' + esc(t('kidsAliveL')) + '<input id="bAlive" type="number" min="0" max="6" step="1"></label>' +
      '<label>' + esc(t('status')) + '<select id="bStatus"><option value="expecting">' + esc(t('expecting')) + '</option><option value="kidded">' + esc(t('kidded')) + '</option><option value="failed">' + esc(t('failed')) + '</option></select></label>' +
      '</div><p class="muted">' + esc(t('auto150')) + '</p>' +
      '<div class="row"><button type="submit" class="primary">' + esc(t('save')) + '</button></div>' +
      '<p id="breedMsg" class="msg" hidden></p></form>';
    if (!sorted.length) h += '<p class="muted">' + esc(t('noBreeding')) + '</p>';
    else h += '<ul class="list">' + sorted.map(function (r) {
      var g = state.goats.find(function (gg) { return gg.id === r.doeId; });
      return '<li><strong>' + esc(g ? goatLabel(g) : '?') + '</strong>' + (r.buckTag ? ' \u00d7 ' + esc(r.buckTag) : '') +
        ' \u00b7 ' + esc(r.breedingDate) + ' \u2192 ' + esc(r.expectedDate || '') +
        (r.actualDate ? ' \u00b7 ' + esc(t('actualDate')) + ' ' + esc(r.actualDate) : '') +
        (r.status === 'kidded' ? ' \u00b7 ' + esc(t('kidsBornL')) + ' ' + num(r.kidsBorn || 0) + ' / ' + num(r.kidsAlive || 0) : '') +
        ' \u00b7 ' + esc(t(r.status)) +
        ' <button data-del="' + r.id + '" class="danger small">' + esc(t('del')) + '</button></li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;
    var bd = document.getElementById('bDate'), be = document.getElementById('bExpected');
    function syncExpected() { be.value = L.expectedKiddingDate(bd.value) || ''; }
    bd.addEventListener('change', syncExpected); syncExpected();
    document.getElementById('breedForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var rec = {
        id: uid(),
        doeId: document.getElementById('bDoe').value,
        buckTag: document.getElementById('bBuck').value.trim(),
        breedingDate: bd.value,
        expectedDate: be.value,
        actualDate: document.getElementById('bActual').value,
        kidsBorn: document.getElementById('bBorn').value === '' ? 0 : Number(document.getElementById('bBorn').value),
        kidsAlive: document.getElementById('bAlive').value === '' ? 0 : Number(document.getElementById('bAlive').value),
        status: document.getElementById('bStatus').value,
      };
      var doeIds = state.goats.filter(function (g) { return g.sex === 'doe'; }).map(function (g) { return g.id; });
      var errs = L.validateBreeding(rec, doeIds);
      var msg = document.getElementById('breedMsg');
      if (errs.length) { showMsg(msg, t('errRequired') + ' (' + errs[0] + ')', true); return; }
      state.breeding.push(rec); save(); render();
      showMsg(document.getElementById('breedMsg'), t('saved'), false);
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(t('confirmDelete'))) return;
        state.breeding = state.breeding.filter(function (x) { return x.id !== b.dataset.del; });
        save(); render();
      });
    });
  }

  function renderMoney() {
    var d = L.computeDashboard(state, ASOF);
    var exps = state.expenses.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var sals = state.sales.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var h = '<section><h2>' + esc(t('tabMoney')) + '</h2><div class="stats">' +
      statCard(t('invested'), money(d.invested), t('purchasePrice') + ' ' + money(d.purchaseTotal) + ' + ' + t('expenses') + ' ' + money(d.expenseTotal) + ' + ' + t('tabHealth') + ' ' + money(d.healthCost)) +
      statCard(t('sales'), money(d.salesTotal)) +
      statCard(t('profit'), money(d.profit)) +
      '</div>' +
      '<form id="expForm" class="card"><h3>' + esc(t('addExpense')) + '</h3><div class="grid">' +
      '<label>' + esc(t('date')) + ' *<input id="eDate" type="date" value="' + ASOF + '"></label>' +
      '<label>' + esc(t('category')) + '<select id="eCat">' + D.EXPENSE_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + esc(t(c === 'medicine' ? 'medicine' : c)) + '</option>'; }).join('') + '</select></label>' +
      '<label>' + esc(t('amount')) + ' *<input id="eAmt" type="number" min="1" step="1"></label>' +
      '<label>' + esc(t('notes')) + '<input id="eNote" maxlength="80"></label>' +
      '</div><div class="row"><button type="submit" class="primary">' + esc(t('save')) + '</button></div>' +
      '<p id="expMsg" class="msg" hidden></p></form>' +
      '<form id="saleForm" class="card"><h3>' + esc(t('addSale')) + '</h3><p class="muted">' + esc(t('saleNote')) + '</p><div class="grid">' +
      '<label>' + esc(t('goat')) + ' *<select id="sGoat">' + goatOptions(null, null) + '</select></label>' +
      '<label>' + esc(t('date')) + ' *<input id="sDate" type="date" value="' + ASOF + '"></label>' +
      '<label>' + esc(t('price')) + ' *<input id="sPrice" type="number" min="1" step="1"></label>' +
      '<label>' + esc(t('buyer')) + '<input id="sBuyer" maxlength="40"></label>' +
      '</div><div class="row"><button type="submit" class="primary">' + esc(t('save')) + '</button></div>' +
      '<p id="saleMsg" class="msg" hidden></p></form>';
    h += '<h3>' + esc(t('expenses')) + ' (' + num(exps.length) + ')</h3>';
    if (!exps.length) h += '<p class="muted">' + esc(t('noExpenses')) + '</p>';
    else h += '<ul class="list">' + exps.map(function (e) {
      return '<li>' + esc(t(e.category === 'medicine' ? 'medicine' : e.category)) + ' \u00b7 ' + money(e.amount) + ' \u00b7 ' + esc(e.date) + (e.note ? ' \u00b7 ' + esc(e.note) : '') +
        ' <button data-exp-del="' + e.id + '" class="danger small">' + esc(t('del')) + '</button></li>';
    }).join('') + '</ul>';
    h += '<h3>' + esc(t('salesList')) + ' (' + num(sals.length) + ')</h3>';
    if (!sals.length) h += '<p class="muted">' + esc(t('noSales')) + '</p>';
    else h += '<ul class="list">' + sals.map(function (s) {
      var g = state.goats.find(function (gg) { return gg.id === s.goatId; });
      return '<li><strong>' + esc(g ? goatLabel(g) : '?') + '</strong> \u00b7 ' + money(s.price) + ' \u00b7 ' + esc(s.date) + (s.buyer ? ' \u00b7 ' + esc(s.buyer) : '') +
        ' <button data-sale-del="' + s.id + '" class="danger small">' + esc(t('del')) + '</button></li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;
    document.getElementById('expForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var rec = {
        id: uid(),
        date: document.getElementById('eDate').value,
        category: document.getElementById('eCat').value,
        amount: Number(document.getElementById('eAmt').value),
        note: document.getElementById('eNote').value.trim(),
      };
      var errs = L.validateExpense(rec);
      var msg = document.getElementById('expMsg');
      if (errs.length) { showMsg(msg, t('errRequired') + ' (' + errs[0] + ')', true); return; }
      state.expenses.push(rec); save(); render();
      showMsg(document.getElementById('expMsg'), t('saved'), false);
    });
    document.getElementById('saleForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var rec = {
        id: uid(),
        goatId: document.getElementById('sGoat').value,
        date: document.getElementById('sDate').value,
        price: Number(document.getElementById('sPrice').value),
        buyer: document.getElementById('sBuyer').value.trim(),
      };
      var goatMap = {};
      state.goats.forEach(function (g) { goatMap[g.id] = g; });
      var errs = L.validateSale(rec, goatMap);
      var msg = document.getElementById('saleMsg');
      if (errs.length) { showMsg(msg, t('errRequired') + ' (' + errs[0] + ')', true); return; }
      state.sales.push(rec);
      goatMap[rec.goatId].status = 'sold';
      save(); render();
      showMsg(document.getElementById('saleMsg'), t('saved'), false);
    });
    view.querySelectorAll('[data-exp-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(t('confirmDelete'))) return;
        state.expenses = state.expenses.filter(function (x) { return x.id !== b.dataset.expDel; });
        save(); render();
      });
    });
    view.querySelectorAll('[data-sale-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm(t('confirmDelete'))) return;
        var sale = state.sales.find(function (x) { return x.id === b.dataset.saleDel; });
        state.sales = state.sales.filter(function (x) { return x.id !== b.dataset.saleDel; });
        if (sale) {
          var g = state.goats.find(function (gg) { return gg.id === sale.goatId; });
          if (g && g.status === 'sold') g.status = 'alive';
        }
        save(); render();
      });
    });
  }

  function renderData() {
    var h = '<section><h2>' + esc(t('tabData')) + '</h2>' +
      '<p class="muted">' + esc(t('dataHelp')) + '</p>' +
      '<div class="row"><button id="exportBtn" class="primary">' + esc(t('exportBtn')) + '</button>' +
      '<button id="importBtn" class="ghost">' + esc(t('importBtn')) + '</button>' +
      '<input type="file" id="importFile" accept=".json,application/json" hidden>' +
      '<button id="eraseBtn" class="danger">' + esc(t('eraseBtn')) + '</button></div>' +
      '<form id="eraseForm" class="card" hidden><h3>' + esc(t('eraseBtn')) + '</h3>' +
      '<label>' + esc(t('eraseConfirm')) + '<input id="eraseInput" placeholder="' + esc(t('erasePlaceholder')) + '"></label>' +
      '<div class="row"><button type="submit" class="danger">' + esc(t('eraseBtn')) + '</button></div></form>' +
      '<p id="dataMsg" class="msg" hidden></p></section>';
    view.innerHTML = h;
    document.getElementById('exportBtn').addEventListener('click', function () {
      var blob = new Blob([L.exportJSON(state)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'goat-farm-bd-backup.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    var fileInput = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = L.parseImport(String(reader.result));
        var msg = document.getElementById('dataMsg');
        if (!res.ok) { showMsg(msg, t('importBad') + res.error, true); return; }
        state = res.data; save(); render();
        showMsg(document.getElementById('dataMsg'), t('imported'), false);
      };
      reader.readAsText(file);
    });
    document.getElementById('eraseBtn').addEventListener('click', function () {
      document.getElementById('eraseForm').hidden = false;
    });
    document.getElementById('eraseForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('dataMsg');
      if (document.getElementById('eraseInput').value.trim() !== 'DELETE') {
        showMsg(msg, t('eraseConfirm'), true); return;
      }
      state = L.emptyState(); save(); render();
      showMsg(document.getElementById('dataMsg'), t('erased'), false);
    });
  }

  render();
})();
