/* OlamDev MCB201 - Admin dashboard. Access is enforced by Supabase (RLS + is_admin()). */
(function () {
  'use strict';
  var sb = null, profiles = [], results = [], tab = 'overview', F = { q: '', topic: '', mode: '', from: '', to: '' }, studentQ = '', anaUser = 'all';
  var app = document.getElementById('app');
  var TOPICS = []; (window.QUESTION_BANK || []).forEach(function (q) { if (TOPICS.indexOf(q.topic) < 0) TOPICS.push(q.topic); });
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fdate(d) { try { return new Date(d).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3000); }
  var MODE_NAME = { practice: 'Practice', exam: 'Exam', timed: 'Timed' };

  async function boot() {
    sb = await OlamSB.init();
    if (!sb) return loginView(OlamSB.error());
    var r = await sb.auth.getSession();
    if (r.data && r.data.session) return enter(); loginView();
  }
  function loginView(err) {
    $('#logoutBtn').classList.add('hidden');
    app.innerHTML = '<div class="card auth-card center"><div class="brand-big">ADMIN</div><h1>Admin Login</h1><p class="muted">OlamDev MCB201 Quiz</p><form id="lf" style="text-align:left"><label class="lbl">Admin Email</label><input id="le" type="email" required><label class="lbl">Password</label><input id="lp" type="password" required><button class="btn btn-primary btn-block" type="submit">Login</button></form><div id="lm">' + (err ? '<div class="msg err">' + esc(err) + '</div>' : '') + '</div></div>';
    $('#lf').addEventListener('submit', async function (e) {
      e.preventDefault(); if (!sb) return;
      var r = await sb.auth.signInWithPassword({ email: $('#le').value.trim(), password: $('#lp').value });
      if (r.error) { $('#lm').innerHTML = '<div class="msg err">' + esc(r.error.message) + '</div>'; return; }
      enter();
    });
  }
  async function enter() {
    $('#logoutBtn').classList.remove('hidden');
    app.innerHTML = '<div class="card center"><div class="spinner"></div><p class="muted">Checking admin access...</p></div>';
    var a = await sb.rpc('is_admin');
    if (a.error || !a.data) { app.innerHTML = '<div class="card center"><h1>&#128683; Access denied</h1><p class="muted">This page is only for the administrator.</p><a class="btn btn-primary" href="index.html" style="text-decoration:none;display:inline-block">Back to Quiz</a></div>'; return; }
    try { await load(); } catch (e) { app.innerHTML = '<div class="card"><div class="msg err">Could not load data: ' + esc(e.message || e) + '. Did you run the SQL in the README?</div></div>'; return; }
    render();
  }
  async function fetchAll(table) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var r = await sb.from(table).select('*').order('created_at', { ascending: false }).range(from, from + step - 1);
      if (r.error) throw r.error; out = out.concat(r.data); if (r.data.length < step) break; from += step;
    }
    return out;
  }
  async function load() { var p = await Promise.all([fetchAll('profiles'), fetchAll('results')]); profiles = p[0]; results = p[1]; }
  function students() { return profiles.filter(function (p) { return p.role !== 'admin'; }); }

  /* ---------- helpers ---------- */
  function filtered() {
    var q = F.q.toLowerCase();
    return results.filter(function (r) {
      if (q && (String(r.full_name || '').toLowerCase().indexOf(q) < 0 && String(r.email || '').toLowerCase().indexOf(q) < 0)) return false;
      if (F.topic && String(r.topics || '').split(' | ').indexOf(F.topic) < 0) return false;
      if (F.mode && r.mode !== F.mode) return false;
      var d = new Date(r.created_at).getTime();
      if (F.from && d < new Date(F.from + 'T00:00:00').getTime()) return false;
      if (F.to && d > new Date(F.to + 'T23:59:59').getTime()) return false;
      return true;
    });
  }
  function aggregate(list) {
    var agg = {}; list.forEach(function (r) { var ts = r.topic_stats || {}; Object.keys(ts).forEach(function (t) { agg[t] = agg[t] || { c: 0, t: 0 }; agg[t].c += ts[t].c; agg[t].t += ts[t].t; }); }); return agg;
  }
  function bar(label, p, right) {
    var cls = p >= 70 ? 'fill-ok' : p >= 50 ? 'fill-warn' : 'fill-bad', tag = p >= 70 ? '<span class="pill ok">Strong</span>' : p >= 50 ? '<span class="pill warn">Average</span>' : '<span class="pill bad">Weak</span>';
    return '<div class="bar-row"><div class="top"><b>' + esc(label) + '</b>' + tag + '<span class="muted">' + right + '</span></div><div class="progress thin ' + cls + '"><i style="width:' + p + '%"></i></div></div>';
  }
  function avg(list) { return list.length ? Math.round(list.reduce(function (a, r) { return a + (+r.percentage || 0); }, 0) / list.length * 10) / 10 : 0; }

  /* ---------- views ---------- */
  function render() {
    var tabs = [['overview', 'Overview'], ['students', 'Students'], ['scores', 'All Scores'], ['analysis', 'Weak / Strong Topics']];
    var h = '<div class="admin-tabs">' + tabs.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '<button class="chip" data-act="refresh">&#8635; Refresh</button></div><div id="view"></div>';
    app.innerHTML = h; view();
  }
  function view() {
    var v = $('#view'); if (!v) return;
    if (tab === 'overview') v.innerHTML = viewOverview();
    else if (tab === 'students') v.innerHTML = viewStudents();
    else if (tab === 'scores') v.innerHTML = viewScores();
    else v.innerHTML = viewAnalysis();
  }
  function viewOverview() {
    var st = students(), pass = results.filter(function (r) { return r.pass_fail === 'Pass'; }).length;
    var h = '<div class="grid-4"><div class="stat"><b>' + st.length + '</b><span>Students registered</span></div><div class="stat"><b>' + results.length + '</b><span>Quizzes taken</span></div><div class="stat"><b>' + avg(results) + '%</b><span>Average score</span></div><div class="stat"><b>' + (results.length ? Math.round(pass / results.length * 100) : 0) + '%</b><span>Pass rate</span></div></div>';
    h += '<div class="card" style="margin-top:1rem"><h2>Latest 10 Scores</h2>' + scoreTable(results.slice(0, 10), false) + '</div>';
    return h;
  }
  function viewStudents() {
    var q = studentQ.toLowerCase();
    var list = students().filter(function (p) { return !q || String(p.full_name || '').toLowerCase().indexOf(q) > -1 || String(p.email || '').toLowerCase().indexOf(q) > -1; });
    var h = '<div class="card"><h2>Students (' + list.length + ')</h2><input id="sq" placeholder="Search name or email..." value="' + esc(studentQ) + '"><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Date Joined</th><th>Quizzes</th><th>Avg %</th><th>Actions</th></tr></thead><tbody>';
    list.forEach(function (p) {
      var rs = results.filter(function (r) { return r.user_id === p.id; });
      h += '<tr><td>' + esc(p.full_name) + '</td><td>' + esc(p.email) + '</td><td>' + fdate(p.created_at) + '</td><td>' + rs.length + '</td><td>' + avg(rs) + '%</td><td><button class="btn btn-sm" data-act="viewstudent" data-id="' + p.id + '">Topics</button> <button class="btn btn-sm btn-danger" data-act="delstudent" data-id="' + p.id + '">Delete</button></td></tr>';
    });
    return h + (list.length ? '' : '<tr><td colspan="6" class="muted">No students found.</td></tr>') + '</tbody></table></div></div>';
  }
  function scoreTable(list, del) {
    var h = '<div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Topics</th><th>Mode</th><th>Score</th><th>%</th><th>Grade</th><th>Date</th><th>Time</th>' + (del ? '<th></th>' : '') + '</tr></thead><tbody>';
    list.forEach(function (r) {
      h += '<tr><td>' + esc(r.full_name) + '</td><td>' + esc(r.email) + '</td><td style="min-width:200px">' + esc(String(r.topics || '').split(' | ').join(', ')) + '</td><td>' + (MODE_NAME[r.mode] || esc(r.mode)) + '</td><td>' + r.score + '/' + r.total_questions + '</td><td><b>' + r.percentage + '%</b></td><td>' + esc(r.grade) + ' <span class="pill ' + (r.pass_fail === 'Pass' ? 'ok' : 'bad') + '">' + esc(r.pass_fail) + '</span></td><td>' + fdate(r.created_at) + '</td><td>' + fmt(r.time_used) + '</td>' + (del ? '<td><button class="btn btn-sm btn-danger" data-act="delscore" data-id="' + r.id + '">Delete</button></td>' : '') + '</tr>';
    });
    return h + (list.length ? '' : '<tr><td colspan="10" class="muted">No scores found.</td></tr>') + '</tbody></table></div>';
  }
  function viewScores() {
    var list = filtered();
    var h = '<div class="card"><h2>All Scores (' + list.length + ')</h2><div class="filters"><input id="fq" placeholder="Search name / email" value="' + esc(F.q) + '"><select id="ft"><option value="">All topics</option>' + TOPICS.map(function (t) { return '<option' + (F.topic === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select><select id="fm"><option value="">All modes</option><option value="practice"' + (F.mode === 'practice' ? ' selected' : '') + '>Practice</option><option value="exam"' + (F.mode === 'exam' ? ' selected' : '') + '>Exam</option><option value="timed"' + (F.mode === 'timed' ? ' selected' : '') + '>Timed</option></select><input id="ff" type="date" value="' + F.from + '" title="From date"><input id="fto" type="date" value="' + F.to + '" title="To date"></div>';
    h += '<div class="row" style="margin:.7rem 0"><button class="btn btn-sm btn-primary" data-act="csv">&#11015; Export CSV</button><button class="btn btn-sm" data-act="clearf">Clear filters</button></div>' + scoreTable(list, true) + '</div>';
    return h;
  }
  function viewAnalysis() {
    var st = students();
    var list = anaUser === 'all' ? results : results.filter(function (r) { return r.user_id === anaUser; });
    var agg = aggregate(list), keys = Object.keys(agg).sort(function (a, b) { return agg[a].c / agg[a].t - agg[b].c / agg[b].t; });
    var h = '<div class="card"><h2>Weak vs Strong Topics</h2><select id="au"><option value="all">All students (combined)</option>' + st.map(function (p) { return '<option value="' + p.id + '"' + (anaUser === p.id ? ' selected' : '') + '>' + esc(p.full_name) + ' - ' + esc(p.email) + '</option>'; }).join('') + '</select>';
    h += keys.length ? keys.map(function (t) { var p = Math.round(agg[t].c / agg[t].t * 100); return bar(t, p, agg[t].c + '/' + agg[t].t + ' (' + p + '%)'); }).join('') : '<p class="muted">No quiz data yet.</p>';
    h += '<p class="muted" style="font-size:.85rem">Weak &lt; 50% &bull; Average 50-69% &bull; Strong &ge; 70%</p></div>';
    if (anaUser === 'all') {
      h += '<div class="card"><h2>Per-student summary</h2><div class="table-wrap"><table class="t"><thead><tr><th>Student</th><th>Quizzes</th><th>Avg %</th><th>Weakest topic</th><th>Strongest topic</th></tr></thead><tbody>';
      st.forEach(function (p) {
        var rs = results.filter(function (r) { return r.user_id === p.id; }), a = aggregate(rs), k = Object.keys(a).sort(function (x, y) { return a[x].c / a[x].t - a[y].c / a[y].t; });
        h += '<tr><td>' + esc(p.full_name) + '<br><span class="muted">' + esc(p.email) + '</span></td><td>' + rs.length + '</td><td>' + avg(rs) + '%</td><td>' + (k.length ? esc(k[0]) + ' (' + Math.round(a[k[0]].c / a[k[0]].t * 100) + '%)' : '-') + '</td><td>' + (k.length ? esc(k[k.length - 1]) + ' (' + Math.round(a[k[k.length - 1]].c / a[k[k.length - 1]].t * 100) + '%)' : '-') + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    }
    return h;
  }

  /* ---------- actions ---------- */
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    var list = filtered(), rows = [['Name', 'Email', 'Topics', 'Mode', 'Score', 'Total Questions', 'Percentage', 'Grade', 'Pass/Fail', 'Time Used (s)', 'Date']];
    list.forEach(function (r) { rows.push([r.full_name, r.email, String(r.topics || '').split(' | ').join('; '), r.mode, r.score, r.total_questions, r.percentage, r.grade, r.pass_fail, r.time_used, new Date(r.created_at).toISOString()]); });
    var blob = new Blob(['\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'olamdev_mcb201_scores_' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    toast('Exported ' + list.length + ' scores.');
  }
  async function delScore(id) {
    if (!confirm('Delete this score permanently?')) return;
    var r = await sb.from('results').delete().eq('id', id); if (r.error) return toast('Error: ' + r.error.message);
    results = results.filter(function (x) { return x.id !== id; }); view(); toast('Score deleted.');
  }
  async function delStudent(id) {
    var p = profiles.find(function (x) { return x.id === id; });
    if (!confirm('Delete student "' + (p ? p.full_name : '') + '" and ALL their scores? This cannot be undone.')) return;
    var r = await sb.rpc('admin_delete_student', { target: id }); if (r.error) return toast('Error: ' + r.error.message);
    profiles = profiles.filter(function (x) { return x.id !== id; }); results = results.filter(function (x) { return x.user_id !== id; }); view(); toast('Student deleted.');
  }

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return render(); }
    var el = e.target.closest('[data-act]'); if (!el) return; var a = el.dataset.act, id = el.dataset.id;
    if (a === 'csv') exportCSV();
    else if (a === 'clearf') { F = { q: '', topic: '', mode: '', from: '', to: '' }; view(); }
    else if (a === 'delscore') delScore(id);
    else if (a === 'delstudent') delStudent(id);
    else if (a === 'viewstudent') { anaUser = id; tab = 'analysis'; render(); }
    else if (a === 'refresh') { try { await load(); render(); toast('Refreshed.'); } catch (er) { toast('Error: ' + er.message); } }
  });
  document.addEventListener('input', function (e) {
    var i = e.target.id, pos = e.target.selectionStart;
    if (i === 'fq') { F.q = e.target.value; view(); } else if (i === 'sq') { studentQ = e.target.value; view(); } else return;
    var n = document.getElementById(i); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
  });
  document.addEventListener('change', function (e) {
    var i = e.target.id, v = e.target.value;
    if (i === 'ft') F.topic = v; else if (i === 'fm') F.mode = v; else if (i === 'ff') F.from = v; else if (i === 'fto') F.to = v; else if (i === 'au') anaUser = v; else return;
    view();
  });
  $('#logoutBtn').addEventListener('click', async function () { if (sb) await sb.auth.signOut(); loginView(); });
  boot();
})();
