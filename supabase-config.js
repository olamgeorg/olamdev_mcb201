/* OlamDev MCB201 - Supabase loader.
   NO keys are stored in this file. Keys come from:
   1) Vercel Environment Variables, served by /api/config (production), or
   2) config.local.js (only for testing on your own computer - never upload it to GitHub). */
(function () {
  var state = { client: null, error: null, promise: null };

  async function loadConfig() {
    var c = window.OLAMDEV_CONFIG;
    if (c && c.url && c.key) return c;
    try {
      var r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) { var j = await r.json(); if (j && j.url && j.key) return j; }
    } catch (e) { /* offline or running from file:// */ }
    try { var cached = JSON.parse(localStorage.getItem('olamdev_cfg') || 'null'); if (cached && cached.url && cached.key) return cached; } catch (e) {}
    return null;
  }

  window.OlamSB = {
    init: function () {
      if (!state.promise) {
        state.promise = (async function () {
          var cfg = await loadConfig();
          if (!cfg) { state.error = 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel (see README).'; return null; }
          if (!window.supabase) { state.error = 'Could not load the Supabase library. Check your internet connection.'; return null; }
          state.client = window.supabase.createClient(cfg.url, cfg.key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'olamdev-auth' }
          });
          try { localStorage.setItem('olamdev_cfg', JSON.stringify(cfg)); } catch (e) {}
          return state.client;
        })();
      }
      return state.promise;
    },
    error: function () { return state.error; }
  };
})();
