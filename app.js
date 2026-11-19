/* OlamDev MCB201 Quiz - main app (vanilla JS) */
(function () {
  'use strict';
  var BANK = window.QUESTION_BANK || [];
  var LETTERS = ['A', 'B', 'C', 'D'];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fdate(d) { try { return new Date(d).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function gradeOf(p) { return p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 45 ? 'D' : 'F'; }
  var MODES = {
    practice: { name: 'Practice Mode', desc: 'Correct answer + explanation shown immediately. No timer.' },
    exam: { name: 'Exam Mode', desc: 'No answers until the end. One countdown timer: 60 seconds per question in total. Auto-submits at zero.' },
    timed: { name: 'Timed (Track) Mode', desc: '60 seconds per question. When time ends, it moves to the next question automatically.' }
  };
  var THEMES = [['light', 'Light', '#f4f6fb'], ['dark', 'Dark', '#0f172a'], ['green', 'Green', '#16a34a'], ['blue', 'Blue', '#1d4ed8'], ['purple', 'Purple', '#7c3aed'], ['pink', 'Pink', '#db2777'], ['orange', 'Orange', '#ea580c'], ['amoled', 'Black / AMOLED', '#000000']];
  var TCOLOR = { light: '#2563eb', dark: '#0f172a', green: '#16a34a', blue: '#1d4ed8', purple: '#7c3aed', pink: '#db2777', orange: '#ea580c', amoled: '#000000' };

  var TOPICS = [];
  (function () { var m = {}; BANK.forEach(function (q) { m[q.topic] = (m[q.topic] || 0) + 1; }); Object.keys(m).forEach(function (k) { TOPICS.push({ name: k, count: m[k] }); }); })();

  var S = { sb: null, user: null, sel: {}, mode: 'practice', count: '20', seen: {}, deferred: null, authMode: 'login', screen: 'boot' };
  var Q = null, LAST = null;
  var settings = Object.assign({ theme: 'light', bg: 'gradient', font: 'medium' }, ls('olamdev_settings', {}));

  /* ---------- settings ---------- */
  function applySettings() {
    var h = document.documentElement; h.dataset.theme = settings.theme; h.dataset.bg = settings.bg; h.dataset.font = settings.font;
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', TCOLOR[settings.theme] || '#2563eb');
    lsSet('olamdev_settings', settings);
  }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200); }

  /* ---------- storage keys ---------- */
  function K(n) { return 'olamdev_' + n + '_' + (S.user ? S.user.id : 'guest'); }
  function hist() { return ls(K('results'), []); }
  function setHist(v) { lsSet(K('results'), v); }

  /* ---------- navigation ---------- */
  function show(name) {
    S.screen = name;
    ['boot', 'auth', 'home', 'quiz', 'result', 'scores', 'settings'].forEach(function (n) { $('#screen-' + n).classList.toggle('hidden', n !== name); });
    $('#topbar').classList.toggle('hidden', name === 'auth' || name === 'boot');
    window.scrollTo(0, 0);
  }

  /* ================= AUTH ================= */
  function renderAuth(msg) {
    var su = S.authMode === 'signup';
    $('#screen-auth').innerHTML =
      '<div class="card auth-card center"><div class="brand-big">OLAMDEV</div>' +
      '<h1>OlamDev MCB201 Quiz</h1><p class="muted">Microbiology 201 - Microbiology</p>' +
      '<div class="tabs"><button class="tab' + (su ? '' : ' active') + '" data-act="authmode" data-v="login">Login</button><button class="tab' + (su ? ' active' : '') + '" data-act="authmode" data-v="signup">Sign Up</button></div>' +
      '<form id="authForm" style="text-align:left" autocomplete="on">' +
      (su ? '<label class="lbl">Full Name</label><input id="aName" type="text" placeholder="e.g. Ayo Adeyemi" autocomplete="name" required>' : '') +
      '<label class="lbl">Email</label><input id="aEmail" type="email" placeholder="you@example.com" autocomplete="email" required>' +
      '<label class="lbl">Password</label><input id="aPass" type="password" placeholder="At least 6 characters" minlength="6" autocomplete="' + (su ? 'new-password' : 'current-password') + '" required>' +
      '<button class="btn btn-primary btn-block" id="aBtn" type="submit">' + (su ? 'Create Account' : 'Login') + '</button></form>' +
      '<div id="aMsg">' + (msg || '') + '</div>' +
      (OlamSB.error() ? '<div class="msg err">' + esc(OlamSB.error()) + '</div>' : '') + '</div>';
    var f = $('#authForm'); if (f) f.addEventListener('submit', onAuthSubmit);
  }
  function aMsg(t, cls) { $('#aMsg').innerHTML = '<div class="msg ' + cls + '">' + esc(t) + '</div>'; }
  async function onAuthSubmit(ev) {
    ev.preventDefault();
    var su = S.authMode === 'signup', btn = $('#aBtn');
    var name = su ? $('#aName').value.trim() : '', email = $('#aEmail').value.trim(), pw = $('#aPass').value;
    if (su && name.length < 2) return aMsg('Please enter your full name.', 'err');
    if (!S.sb) return aMsg(OlamSB.error() || 'Cannot reach the server. Check your internet.', 'err');
    btn.disabled = true; btn.textContent = 'Please wait...';
    try {
      var r;
      if (su) {
        r = await S.sb.auth.signUp({ email: email, password: pw, options: { data: { full_name: name } } });
        if (r.error) throw r.error;
        if (!r.data.session) { S.authMode = 'login'; renderAuth('<div class="msg ok">Account created. Check your email to confirm it, then login.</div>'); return; }
        await onSession(r.data.session, name);
      } else {
        r = await S.sb.auth.signInWithPassword({ email: email, password: pw });
        if (r.error) throw r.error;
        await onSession(r.data.session);
      }
    } catch (e) {
      aMsg(e.message || 'Something went wrong.', 'err');
      btn.disabled = false; btn.textContent = su ? 'Create Account' : 'Login';
    }
  }
  async function onSession(session, nameHint) {
    var u = session.user, name = nameHint || (u.user_metadata && u.user_metadata.full_name) || '';
    var isAdmin = false;
    try {
      var p = await S.sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
      if (p.data) name = p.data.full_name || name;
      else await S.sb.from('profiles').insert({ id: u.id, full_name: name || u.email, email: u.email, role: 'student' });
    } catch (e) {}
    try { var a = await S.sb.rpc('is_admin'); isAdmin = !!a.data; } catch (e) {}
    S.user = { id: u.id, email: u.email, name: name || u.email, isAdmin: isAdmin, offline: false };
    lsSet('olamdev_user', S.user);
    $('#adminLink').classList.toggle('hidden', !isAdmin);
    await pullHistory(); syncPending();
    goHome();
  }
  async function logout() {
    stopTimer(); Q = null;
    try { if (S.sb) await S.sb.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem('olamdev_user'); } catch (e) {}
    S.user = null; S.seen = {}; S.authMode = 'login'; $('#adminLink').classList.add('hidden'); renderAuth(); show('auth');
  }

  /* ================= HOME ================= */
  function goHome() { stopTimer(); Q = null; renderHome(); show('home'); }
  function selCount() { return TOPICS.filter(function (t) { return S.sel[t.name]; }).reduce(function (a, t) { return a + t.count; }, 0); }
  function renderHome() {
    var y = window.scrollY, n = selCount(), seenN = Object.keys(S.seen).length;
    var h = '<div class="card welcome"><h1>Welcome, ' + esc(S.user.name.split(' ')[0]) + '!</h1><p>OlamDev MCB201 Quiz &bull; Microbiology 201 - Microbiology</p><p style="font-size:.85rem">' + BANK.length + ' questions across ' + TOPICS.length + ' topics, all from your lecturer\'s notes.</p></div>';
    h += '<div class="card"><div class="row between"><h2 style="margin:0">1. Select Topics</h2><div class="row"><button class="btn btn-sm" data-act="selall">Select All</button><button class="btn btn-sm" data-act="clearall">Clear All</button></div></div><div style="margin-top:.7rem">';
    TOPICS.forEach(function (t, i) {
      h += '<label class="topic-item' + (S.sel[t.name] ? ' on' : '') + '"><input type="checkbox" data-act="topic" data-i="' + i + '"' + (S.sel[t.name] ? ' checked' : '') + '><span class="nm">' + esc(t.name) + '</span><span class="ct">(' + t.count + ' questions)</span></label>';
    });
    h += '<p class="muted" style="margin:.4rem 0 0;font-size:.85rem">' + (n ? n + ' questions available in your selection' : 'Tick one, several or all topics') + '</p></div>';
    h += '<div class="card" style="margin-top:1rem;box-shadow:none"><h2>2. Number of Questions</h2><div class="row">';
    ['10', '20', '30', '50', '100', 'all'].forEach(function (c) { h += '<button class="chip' + (S.count === c ? ' active' : '') + '" data-act="count" data-v="' + c + '">' + (c === 'all' ? 'All' : c) + '</button>'; });
    h += '</div></div></div>';
    h += '<div class="card"><h2>3. Choose Mode</h2>';
    Object.keys(MODES).forEach(function (m) { h += '<div class="mode-card' + (S.mode === m ? ' active' : '') + '" data-act="mode" data-v="' + m + '"><b>' + MODES[m].name + '</b><span>' + MODES[m].desc + '</span></div>'; });
    h += '</div>';
    h += '<button class="btn btn-primary btn-block" style="font-size:1.1rem;padding:1rem" data-act="start"' + (n ? '' : ' disabled') + '>&#9654; Start Quiz</button>';
    h += '<div class="grid-2" style="margin-top:.8rem"><button class="btn" data-act="scores">&#128200; My Scores</button><button class="btn" data-act="resetseen"' + (seenN ? '' : ' disabled') + '>&#8635; Restart Session (' + seenN + ' seen)</button></div>';
    $('#screen-home').innerHTML = h; window.scrollTo(0, y);
  }

  /* ================= QUIZ ================= */
  function startQuiz() {
    var pool = BANK.filter(function (q) { return S.sel[q.topic]; });
    if (!pool.length) return toast('Select at least one topic.');
    var want = S.count === 'all' ? pool.length : Math.min(+S.count, pool.length);
    var fresh = pool.filter(function (q) { return !S.seen[q.id]; });
    if (!fresh.length) { pool.forEach(function (q) { delete S.seen[q.id]; }); fresh = pool.slice(); toast('You have seen every question in these topics this session. Pool restarted.'); }
    else if (fresh.length < want) toast('Only ' + fresh.length + ' unseen questions left in these topics - no repeats this session.');
    var picked = shuffle(fresh).slice(0, want);
    picked.forEach(function (q) { S.seen[q.id] = 1; });
    LAST = { ids: picked.map(function (q) { return q.id; }), topics: TOPICS.filter(function (t) { return S.sel[t.name]; }).map(function (t) { return t.name; }), mode: S.mode };
    beginQuiz(picked, LAST.topics, S.mode);
  }
  function beginQuiz(questions, topics, mode) {
    var items = shuffle(questions).map(function (q) {
      var opts = shuffle(q.options.map(function (t, i) { return { t: t, ok: i === q.correctAnswer }; }));
      return { q: q, opts: opts, ci: opts.findIndex(function (o) { return o.ok; }), pick: null, locked: false, timedOut: false };
    });
    Q = { items: items, i: 0, mode: mode, topics: topics, elapsed: 0, qElapsed: 0, total: items.length * 60, remaining: mode === 'timed' ? 60 : items.length * 60, paused: false, last: Date.now(), iv: null, done: false };
    show('quiz'); renderQuiz(); startTimer();
  }
  function startTimer() { stopTimer(); if (!Q) return; Q.last = Date.now(); Q.iv = setInterval(tick, 250); }
  function stopTimer() { if (Q && Q.iv) { clearInterval(Q.iv); Q.iv = null; } }
  function tick() {
    if (!Q || Q.done) return;
    var now = Date.now(), d = (now - Q.last) / 1000; Q.last = now;
    if (Q.paused) return;
    Q.elapsed += d; Q.qElapsed += d;
    if (Q.mode === 'exam') { Q.remaining = Q.total - Q.elapsed; if (Q.remaining <= 0) { toast('Time is up! Submitting your exam...'); return finish(true); } }
    if (Q.mode === 'timed') { Q.remaining = 60 - Q.qElapsed; if (Q.remaining <= 0) return autoNext(); }
    updateTimerUI();
  }
  function updateTimerUI() {
    var el = $('#tDisp'); if (!el || Q.mode === 'practice') return;
    el.textContent = fmt(Q.remaining);
    var low = Q.mode === 'timed' ? Q.remaining <= 10 : Q.remaining <= 60;
    $('#timerBox').classList.toggle('low', low);
  }
  function autoNext() {
    var it = Q.items[Q.i]; if (it.pick === null) it.timedOut = true;
    if (Q.i >= Q.items.length - 1) { toast('Time is up on the last question. Submitting...'); return finish(true); }
    toast('Time up - moving to the next question'); Q.i++; Q.qElapsed = 0; Q.remaining = 60; renderQuiz();
  }
  function renderQuiz() {
    var it = Q.items[Q.i], n = Q.items.length, practice = Q.mode === 'practice', locked = it.locked;
    var h = '<div class="q-head"><div><b>Question ' + (Q.i + 1) + ' / ' + n + '</b></div><div class="row">';
    if (!practice) h += '<div class="timer" id="timerBox">&#9201; <span id="tDisp">' + fmt(Q.remaining) + '</span></div><button class="btn btn-sm" data-act="pause">&#10074;&#10074; Pause</button>';
    else h += '<span class="pill">No timer</span>';
    h += '<button class="btn btn-sm" data-act="quit">Quit</button></div></div>';
    h += '<div class="progress"><i style="width:' + (((Q.i + (locked ? 1 : 0)) / n) * 100).toFixed(1) + '%"></i></div>';
    h += '<div class="card" style="margin-top:.9rem"><div class="meta"><span class="pill">' + esc(it.q.topic) + '</span><span class="pill ' + it.q.difficulty + '">' + it.q.difficulty + '</span><span class="pill">' + MODES[Q.mode].name + '</span></div>';
    h += '<div class="q-text">' + esc(it.q.question) + '</div>';
    it.opts.forEach(function (o, k) {
      var cls = 'opt';
      if (locked) { if (k === it.ci) cls += ' correct'; else if (k === it.pick) cls += ' wrong'; }
      else if (it.pick === k) cls += ' sel';
      h += '<button class="' + cls + '" data-act="pick" data-k="' + k + '"' + (locked ? ' disabled' : '') + '><span class="k">' + LETTERS[k] + '</span><span>' + esc(o.t) + '</span></button>';
    });
    if (locked) h += '<div class="explain"><b>' + (it.pick === it.ci ? '&#10004; Correct.' : '&#10008; Incorrect. Correct answer: ' + LETTERS[it.ci] + '.') + '</b><br>' + esc(it.q.explanation) + '<br><span class="muted" style="font-size:.8rem">Source: ' + esc(it.q.source) + '</span></div>';
    h += '</div>';
    var last = Q.i === n - 1;
    h += '<div class="q-nav"><button class="btn" data-act="prev"' + (Q.i === 0 || Q.mode === 'timed' ? ' disabled' : '') + '>&larr; Previous</button><button class="btn" data-act="skip"' + (last ? ' disabled' : '') + '>Skip</button>';
    h += last ? '<button class="btn btn-ok" data-act="submit">Submit &#10003;</button>' : '<button class="btn btn-primary" data-act="next">Next &rarr;</button>';
    h += '</div>';
    if (!last && Q.mode === 'exam') h += '<button class="btn btn-block" style="margin-top:.6rem" data-act="submit">Submit Exam Now</button>';
    $('#screen-quiz').innerHTML = h; updateTimerUI();
  }
  function pick(k) {
    var it = Q.items[Q.i]; if (it.locked || Q.paused) return;
    it.pick = k; if (Q.mode === 'practice') it.locked = true; renderQuiz();
  }
  function go(d) { if (!Q || Q.paused) return; var ni = Q.i + d; if (ni < 0 || ni >= Q.items.length) return; Q.i = ni; if (Q.mode === 'timed') { Q.qElapsed = 0; Q.remaining = 60; } renderQuiz(); window.scrollTo(0, 0); }
  function togglePause() {
    if (!Q) return; Q.paused = !Q.paused; Q.last = Date.now();
    var o = $('#pauseOv');
    if (Q.paused) { o = document.createElement('div'); o.id = 'pauseOv'; o.className = 'pause-overlay'; o.innerHTML = '<h2>&#10074;&#10074; Paused</h2><p class="muted">The question is hidden while the timer is paused.</p><button class="btn btn-primary" data-act="pause" style="font-size:1.1rem;padding:1rem 2rem">&#9654; Resume</button>'; document.body.appendChild(o); }
    else if (o) o.remove();
  }
  function submitQuiz() {
    if (!Q) return;
    var un = Q.items.filter(function (i) { return i.pick === null; }).length;
    if (un && !confirm(un + ' question(s) are unanswered. Submit anyway?')) return;
    finish(false);
  }

  /* ================= FINISH & SAVE ================= */
  async function finish(auto) {
    if (!Q || Q.done) return; Q.done = true; stopTimer();
    var ov = $('#pauseOv'); if (ov) ov.remove();
    var correct = 0, wrong = 0, skipped = 0, ts = {}, mastery = ls(K('mastery'), {});
    Q.items.forEach(function (it) {
      var t = it.q.topic; ts[t] = ts[t] || { c: 0, t: 0 }; ts[t].t++;
      if (it.pick === null) skipped++;
      else if (it.pick === it.ci) { correct++; ts[t].c++; mastery[it.q.id] = 1; }
      else wrong++;
    });
    lsSet(K('mastery'), mastery);
    var total = Q.items.length, pct = total ? Math.round((correct / total) * 1000) / 10 : 0;
    var rec = { id: 'local_' + Date.now(), date: new Date().toISOString(), topics: Q.topics, mode: Q.mode, score: correct, total: total, pct: pct, grade: gradeOf(pct), passFail: pct >= 50 ? 'Pass' : 'Fail', timeUsed: Math.round(Q.elapsed), topicStats: ts, synced: false };
    var h = hist(); h.unshift(rec); setHist(h);
    S.lastResult = { rec: rec, items: Q.items, correct: correct, wrong: wrong, skipped: skipped, auto: auto };
    renderResult(); show('result');
    saveRemote(rec).then(function (ok) { var n = $('#syncNote'); if (n) n.innerHTML = ok ? '<span class="pill ok">&#10003; Saved to server</span>' : '<span class="pill warn">Saved on this device - will sync when online</span>'; });
  }
  async function saveRemote(rec) {
    if (!S.sb || !S.user || S.user.offline || !navigator.onLine) return false;
    try {
      var r = await S.sb.from('results').insert({
        user_id: S.user.id, full_name: S.user.name, email: S.user.email, topics: rec.topics.join(' | '), mode: rec.mode,
        score: rec.score, total_questions: rec.total, percentage: rec.pct, grade: rec.grade, pass_fail: rec.passFail,
        time_used: rec.timeUsed, topic_stats: rec.topicStats
      }).select('id').single();
      if (r.error) return false;
      var h = hist(); h.forEach(function (x) { if (x.id === rec.id) { x.synced = true; x.sid = r.data.id; } }); setHist(h); rec.synced = true; return true;
    } catch (e) { return false; }
  }
  async function syncPending() { var h = hist().filter(function (x) { return !x.synced; }); for (var i = 0; i < h.length; i++) await saveRemote(h[i]); }
  async function pullHistory() {
    if (!S.sb || !S.user || !navigator.onLine) return;
    try {
      var cleared = ls(K('cleared'), 0);
      var r = await S.sb.from('results').select('*').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(1000);
      if (r.error) return;
      var server = r.data.filter(function (x) { return new Date(x.created_at).getTime() > cleared; }).map(function (x) {
        return { id: x.id, date: x.created_at, topics: (x.topics || '').split(' | '), mode: x.mode, score: x.score, total: x.total_questions, pct: +x.percentage, grade: x.grade, passFail: x.pass_fail, timeUsed: x.time_used, topicStats: x.topic_stats || {}, synced: true };
      });
      var pend = hist().filter(function (x) { return !x.synced; });
      setHist(pend.concat(server).sort(function (a, b) { return new Date(b.date) - new Date(a.date); }));
    } catch (e) {}
  }

  /* ================= RESULT ================= */
  function renderResult(filter) {
    var R = S.lastResult, rec = R.rec, C = 2 * Math.PI * 54;
    filter = filter || 'all';
    var h = '<div class="card"><div class="ring-wrap"><div class="ring"><svg width="190" height="190" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54" fill="none" stroke-width="10"/><circle class="fg" id="ringFg" cx="60" cy="60" r="54" fill="none" stroke-width="10" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" style="stroke:' + (rec.pct >= 50 ? 'var(--ok)' : 'var(--bad)') + '"/></svg><div class="txt"><b>' + rec.pct + '%</b><span>' + rec.score + ' / ' + rec.total + '</span></div></div>';
    h += '<div class="big-grade" style="margin-top:.5rem">Grade ' + rec.grade + ' &bull; <span style="color:' + (rec.pct >= 50 ? 'var(--ok)' : 'var(--bad)') + '">' + (rec.pct >= 50 ? 'PASS' : 'FAIL') + '</span></div>';
    h += '<p class="muted" style="margin:.2rem 0">' + (R.auto ? 'Time ended - auto-submitted. ' : '') + MODES[rec.mode].name + ' &bull; Time used ' + fmt(rec.timeUsed) + '</p><div id="syncNote"><span class="pill">Saving...</span></div></div>';
    h += '<div class="grid-4"><div class="stat"><b>' + rec.score + '/' + rec.total + '</b><span>Score</span></div><div class="stat"><b style="color:var(--ok)">' + R.correct + '</b><span>Correct</span></div><div class="stat"><b style="color:var(--bad)">' + R.wrong + '</b><span>Wrong</span></div><div class="stat"><b style="color:var(--warn)">' + R.skipped + '</b><span>Skipped</span></div></div></div>';
    h += '<div class="card"><h2>Performance by Topic</h2>' + Object.keys(rec.topicStats).map(function (t) { var s = rec.topicStats[t], p = Math.round(s.c / s.t * 100); return barRow(t, p, s.c + '/' + s.t + ' (' + p + '%)'); }).join('') + '</div>';
    h += '<div class="row" style="margin-bottom:1rem"><button class="btn btn-primary" data-act="retake">&#8635; Retake</button><button class="btn" data-act="newquiz">New Quiz</button><button class="btn" data-act="home">Go Home</button></div>';
    h += '<div class="card"><div class="row between"><h2 style="margin:0">Review Answers</h2><div class="row"><button class="chip' + (filter === 'all' ? ' active' : '') + '" data-act="rfilter" data-v="all">All</button><button class="chip' + (filter === 'wrong' ? ' active' : '') + '" data-act="rfilter" data-v="wrong">Wrong</button><button class="chip' + (filter === 'skip' ? ' active' : '') + '" data-act="rfilter" data-v="skip">Skipped</button></div></div><div style="margin-top:.8rem">';
    R.items.forEach(function (it, i) {
      var st = it.pick === null ? 'skip' : it.pick === it.ci ? 'good' : 'bad';
      if (filter === 'wrong' && st !== 'bad') return; if (filter === 'skip' && st !== 'skip') return;
      h += '<div class="review-item ' + st + '"><div class="meta"><span class="pill">Q' + (i + 1) + '</span><span class="pill">' + esc(it.q.topic) + '</span><span class="pill ' + it.q.difficulty + '">' + it.q.difficulty + '</span></div><p><b>' + esc(it.q.question) + '</b></p>';
      h += '<p>Your answer: <b style="color:' + (st === 'good' ? 'var(--ok)' : st === 'bad' ? 'var(--bad)' : 'var(--warn)') + '">' + (it.pick === null ? (it.timedOut ? 'Not answered (time ended)' : 'Skipped') : LETTERS[it.pick] + '. ' + esc(it.opts[it.pick].t)) + '</b></p>';
      h += '<p>Correct answer: <b style="color:var(--ok)">' + LETTERS[it.ci] + '. ' + esc(it.opts[it.ci].t) + '</b></p><div class="explain">' + esc(it.q.explanation) + '<br><span class="muted" style="font-size:.8rem">Source: ' + esc(it.q.source) + '</span></div></div>';
    });
    h += '</div></div>';
    $('#screen-result').innerHTML = h;
    setTimeout(function () { var f = $('#ringFg'); if (f) f.style.strokeDashoffset = (C * (1 - rec.pct / 100)).toFixed(2); }, 80);
    if (rec.synced) { var n = $('#syncNote'); if (n) n.innerHTML = '<span class="pill ok">&#10003; Saved to server</span>'; }
  }
  function barRow(label, p, right) {
    var cls = p >= 70 ? 'fill-ok' : p >= 50 ? 'fill-warn' : 'fill-bad';
    var tag = p >= 70 ? '<span class="pill ok">Strong</span>' : p >= 50 ? '<span class="pill warn">Average</span>' : '<span class="pill bad">Weak</span>';
    return '<div class="bar-row"><div class="top"><b>' + esc(label) + '</b>' + tag + '<span class="muted">' + right + '</span></div><div class="progress thin ' + cls + '"><i style="width:' + p + '%"></i></div></div>';
  }

  /* ================= MY SCORES ================= */
  function renderScores() {
    var h = hist(), n = h.length, avg = n ? Math.round(h.reduce(function (a, x) { return a + x.pct; }, 0) / n * 10) / 10 : 0, best = n ? Math.max.apply(null, h.map(function (x) { return x.pct; })) : 0, last = n ? h[0].pct : 0;
    var o = '<div class="card"><div class="row between"><h2 style="margin:0">&#128200; My Scores</h2><button class="btn btn-sm" data-act="home">&larr; Home</button></div><p class="muted" style="margin:.3rem 0 .8rem">' + esc(S.user.name) + ' &bull; ' + esc(S.user.email) + '</p><div class="grid-4"><div class="stat"><b>' + n + '</b><span>Quizzes taken</span></div><div class="stat"><b>' + avg + '%</b><span>Average score</span></div><div class="stat"><b>' + best + '%</b><span>Best score</span></div><div class="stat"><b>' + last + '%</b><span>Last score</span></div></div></div>';
    var agg = {}; h.forEach(function (x) { Object.keys(x.topicStats || {}).forEach(function (t) { var s = x.topicStats[t]; agg[t] = agg[t] || { c: 0, t: 0 }; agg[t].c += s.c; agg[t].t += s.t; }); });
    var mastery = ls(K('mastery'), {}), mcount = {}; BANK.forEach(function (q) { if (mastery[q.id]) mcount[q.topic] = (mcount[q.topic] || 0) + 1; });
    o += '<div class="card"><h2>Score per Topic (Weak vs Strong)</h2>' + (Object.keys(agg).length ? Object.keys(agg).sort(function (a, b) { return agg[a].c / agg[a].t - agg[b].c / agg[b].t; }).map(function (t) { var p = Math.round(agg[t].c / agg[t].t * 100); return barRow(t, p, agg[t].c + '/' + agg[t].t + ' (' + p + '%)'); }).join('') : '<p class="muted">Take a quiz to see your strong and weak topics.</p>') + '</div>';
    o += '<div class="card"><h2>Topic Progress</h2><p class="muted" style="margin-top:-.3rem;font-size:.85rem">Completed = questions you have answered correctly at least once.</p>' + TOPICS.map(function (t) { var p = Math.round((mcount[t.name] || 0) / t.count * 100); return '<div class="bar-row"><div class="top"><b>' + esc(t.name) + '</b><span class="muted">' + p + '% completed</span></div><div class="progress thin"><i style="width:' + p + '%"></i></div></div>'; }).join('') + '</div>';
    o += '<div class="card"><div class="row between"><h2 style="margin:0">History</h2><button class="btn btn-sm btn-danger" data-act="clearhist"' + (n ? '' : ' disabled') + '>Clear History</button></div><div style="margin-top:.6rem">';
    o += n ? h.map(function (x) { return '<div class="hist-item"><div class="l"><b>' + fdate(x.date) + '</b><br><span class="muted">' + esc((x.topics || []).join(', ')) + '</span><br><span class="pill">' + MODES[x.mode].name + '</span> <span class="muted">Time ' + fmt(x.timeUsed) + '</span></div><div class="r"><b>' + x.score + '/' + x.total + '</b><br>' + x.pct + '% &bull; ' + x.grade + '<br>' + (x.synced ? '<span class="pill ok">synced</span>' : '<span class="pill warn">pending</span>') + '</div></div>'; }).join('') : '<p class="muted">No quizzes taken yet.</p>';
    o += '</div></div>';
    $('#screen-scores').innerHTML = o;
  }
  function clearHistory() {
    if (!confirm('Clear your history on this device? Your lecturer will still keep the official scores saved on the server.')) return;
    setHist([]); lsSet(K('mastery'), {}); lsSet(K('cleared'), Date.now()); renderScores(); toast('History cleared.');
  }

  /* ================= SETTINGS ================= */
  function renderSettings() {
    var h = '<div class="card"><div class="row between"><h2 style="margin:0">&#9881; Settings</h2><button class="btn btn-sm" data-act="home">&larr; Home</button></div></div>';
    h += '<div class="card"><h2>Theme</h2><div class="swatches">' + THEMES.map(function (t) { return '<button class="sw' + (settings.theme === t[0] ? ' active' : '') + '" data-act="theme" data-v="' + t[0] + '"><i style="background:' + t[2] + '"></i>' + t[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>Background</h2><div class="row">' + [['plain', 'Plain Color'], ['gradient', 'Gradient'], ['pattern', 'Pattern'], ['image', 'Image']].map(function (b) { return '<button class="chip' + (settings.bg === b[0] ? ' active' : '') + '" data-act="bg" data-v="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>Font Size</h2><div class="row">' + [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']].map(function (b) { return '<button class="chip' + (settings.font === b[0] ? ' active' : '') + '" data-act="font" data-v="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="card"><h2>Account &amp; App</h2><p class="muted">' + esc(S.user.name) + '<br>' + esc(S.user.email) + '</p><div class="row"><button class="btn btn-primary" data-act="install">&#11015; Install App</button><button class="btn btn-danger" data-act="logout">Logout</button></div></div>';
    $('#screen-settings').innerHTML = h;
  }
  function install() {
    if (S.deferred) { S.deferred.prompt(); S.deferred.userChoice.finally(function () { S.deferred = null; $('#installBtn').classList.add('hidden'); }); }
    else if (window.matchMedia('(display-mode: standalone)').matches) toast('The app is already installed.');
    else toast('To install: open your browser menu and choose "Install app" or "Add to Home screen".');
  }

  /* ================= EVENTS ================= */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act, v = el.dataset.v;
    if (el.tagName === 'INPUT') return;
    switch (a) {
      case 'home': if (S.screen === 'quiz' && Q && !Q.done && !confirm('Leave this quiz? Your progress will be lost.')) return; if (!S.user) return; goHome(); break;
      case 'scores': renderScores(); show('scores'); break;
      case 'settings': renderSettings(); show('settings'); break;
      case 'install': install(); break;
      case 'logout': logout(); break;
      case 'authmode': S.authMode = v; renderAuth(); break;
      case 'selall': TOPICS.forEach(function (t) { S.sel[t.name] = true; }); renderHome(); break;
      case 'clearall': S.sel = {}; renderHome(); break;
      case 'count': S.count = v; renderHome(); break;
      case 'mode': S.mode = v; renderHome(); break;
      case 'start': startQuiz(); break;
      case 'resetseen': S.seen = {}; renderHome(); toast('Session restarted - all questions are available again.'); break;
      case 'pick': pick(+el.dataset.k); break;
      case 'next': go(1); break;
      case 'prev': go(-1); break;
      case 'skip': if (Q.mode === 'timed') Q.items[Q.i].timedOut = false; go(1); break;
      case 'submit': submitQuiz(); break;
      case 'pause': togglePause(); break;
      case 'quit': if (confirm('Quit this quiz? Your progress will be lost.')) goHome(); break;
      case 'retake': if (LAST) { var ids = LAST.ids; var qs = BANK.filter(function (q) { return ids.indexOf(q.id) > -1; }); beginQuiz(qs, LAST.topics, LAST.mode); } break;
      case 'newquiz': goHome(); break;
      case 'rfilter': renderResult(v); break;
      case 'clearhist': clearHistory(); break;
      case 'theme': settings.theme = v; applySettings(); renderSettings(); break;
      case 'bg': settings.bg = v; applySettings(); renderSettings(); break;
      case 'font': settings.font = v; applySettings(); renderSettings(); break;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (el.dataset && el.dataset.act === 'topic') { var t = TOPICS[+el.dataset.i]; S.sel[t.name] = el.checked; renderHome(); }
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.deferred = e; $('#installBtn').classList.remove('hidden'); });
  window.addEventListener('online', function () { if (S.user && !S.user.offline) syncPending(); });
  window.addEventListener('beforeunload', function (e) { if (Q && !Q.done) { e.preventDefault(); e.returnValue = ''; } });

  /* ================= BOOT ================= */
  async function boot() {
    applySettings();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
    S.sb = await OlamSB.init();
    var cached = ls('olamdev_user', null);
    try {
      if (S.sb) {
        var r = await S.sb.auth.getSession();
        if (r.data && r.data.session) { await onSession(r.data.session); return; }
      }
    } catch (e) {}
    if (cached && !navigator.onLine) { S.user = Object.assign({}, cached, { offline: true }); $('#adminLink').classList.add('hidden'); goHome(); toast('Offline mode - your scores will sync when you are online.'); return; }
    renderAuth(); show('auth');
  }
  boot();
})();
