/*! Getclient business owner dashboard (/dashboard/).
 *  Sign-in: a 6-digit code (or link) emailed to the address on the listing.
 *  Every change goes through gc_owner_* database functions, which check that the
 *  signed-in person owns the listing and enforce the tier rules.
 */
(function () {
  'use strict';
  var G = window.GC || {};
  var sb = G.sb, esc = G.esc, T = G.T;
  var root = document.getElementById('gc-dash');
  if (!root || !sb) return;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var TIMING = { urgent: 'Urgent', week: 'This week', month: 'This month', flexible: 'Flexible' };
  var CAP = { gold: { services: 12, photos: 20 }, blue: { services: 8, photos: 6 }, none: { services: 0, photos: 0 } };
  var TIER = { gold: 'Gold Verified', blue: 'Blue Verified', none: 'Basic' };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* */ } } };
  var listings = [], cur = null, tab = 'overview', email = '';
  var body = $('#gc-dash-body');
  function when(d) { return d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function err(e) { return (e && (e.message || e.error_description || e.error)) || String(e); }
  function view(id) { ['login', 'app', 'none'].forEach(function (v) { $('#gc-dash-' + v).hidden = v !== id; }); }

  /* ---------------- sign in ---------------- */
  var msg = $('#gc-dash-msg');
  $('#gc-dash-email').addEventListener('submit', function (e) {
    e.preventDefault();
    email = $('#de').value.trim().toLowerCase();
    msg.className = 'msg'; msg.textContent = 'Sending your code…';
    sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/dashboard/' } }).then(function (r) {
      if (r.error) { msg.className = 'msg err'; msg.textContent = /rate/i.test(r.error.message) ? 'Too many codes requested. Wait a minute and try again.' : err(r.error); return; }
      $('#gc-dash-email').hidden = true; $('#gc-dash-code').hidden = false; $('#dc').focus();
      msg.className = 'msg ok'; msg.textContent = 'Check ' + email + ' for your code (and your spam folder). You can also tap the link in the email.';
    });
  });
  $('#gc-dash-code').addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'msg'; msg.textContent = 'Signing in…';
    sb.auth.verifyOtp({ email: email, token: $('#dc').value.replace(/\s/g, ''), type: 'email' }).then(function (r) {
      if (r.error) { msg.className = 'msg err'; msg.textContent = 'That code did not work. Check it, or request a new one.'; return; }
      start();
    });
  });
  $('#gc-dash-back').addEventListener('click', function () { $('#gc-dash-email').hidden = false; $('#gc-dash-code').hidden = true; msg.textContent = ''; });
  function out() { sb.auth.signOut().then(function () { view('login'); }); }
  $('#gc-dash-out').addEventListener('click', out);
  $('#gc-dash-out2').addEventListener('click', out);

  /* ---------------- load the owner's listings ---------------- */
  function start() {
    sb.rpc('gc_claim_listings').then(function (r) {
      if (r.error) { view('login'); msg.className = 'msg err'; msg.textContent = /function|schema/i.test(r.error.message) ? 'The dashboard is not switched on yet (run supabase/schema.sql).' : err(r.error); return; }
      var ids = (r.data || []).map(function (x) { return typeof x === 'string' ? x : x.gc_claim_listings; });
      if (!ids.length) { view('none'); return; }
      return sb.from(T('listings')).select('*').in('public_id', ids).then(function (l) {
        listings = l.data || [];
        if (!listings.length) { view('none'); return; }
        var want = store.get('gc_dash_listing');
        cur = listings.filter(function (x) { return x.public_id === want; })[0] || listings[0];
        var pick = $('#gc-dash-pick');
        pick.hidden = listings.length < 2;
        pick.innerHTML = listings.map(function (x) { return '<option value="' + esc(x.public_id) + '">' + esc(x.name) + '</option>'; }).join('');
        pick.value = cur.public_id;
        view('app'); header(); go(tab);
      });
    });
  }
  $('#gc-dash-pick').addEventListener('change', function () {
    cur = listings.filter(function (x) { return x.public_id === this.value; }, this)[0];
    store.set('gc_dash_listing', cur.public_id); header(); go(tab);
  });
  function tierOf(l) { return l.tier === 'gold' || l.tier === 'blue' ? l.tier : 'none'; }
  function header() {
    $('#gc-dash-name').textContent = cur.name;
    $('#gc-dash-view').href = '/b/' + cur.slug + '/';
    var st = { approved: ['tier--blue', 'Live'], pending: ['tier--none', 'Waiting for review'], rejected: ['tier--none', 'Needs changes'], suspended: ['tier--none', 'Suspended'] }[cur.status] || ['tier--none', cur.status];
    $('#gc-dash-chips').innerHTML = '<span class="tier tier--' + (tierOf(cur) === 'none' ? 'none' : tierOf(cur)) + '">' + TIER[tierOf(cur)] + '</span><span class="tier ' + st[0] + '">' + st[1] + '</span><span class="tier tier--listed">' + esc(cur.public_id) + '</span>';
    sb.rpc('gc_owner_leads', { p_listing: cur.public_id }).then(function (r) {
      var open = (r.data || []).filter(function (x) { return (x.gc_owner_leads || x).status === 'offered'; }).length;
      var b = $('[data-badge="jobs"]'); b.hidden = !open; b.textContent = open;
    });
  }

  /* ---------------- tabs ---------------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (!t) return;
    $$('.atab').forEach(function (x) { x.classList.toggle('on', x === t); });
    go(t.getAttribute('data-tab'));
  });
  function go(t) {
    tab = t;
    $$('.atab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === t); });
    body.innerHTML = '<p class="lede">Loading…</p>';
    ({ overview: overview, jobs: jobs, quotes: quotes, listing: listingForm, services: services, photos: photos, badge: badge })[t]();
  }
  function upsell(what) {
    return '<div class="empty"><h3>' + what + ' come with Blue and Gold</h3><p>Basic listings show your description and contact details. Upgrade to add services, photos, quote requests and promotion on every page.</p><a class="btn btn-p" href="/pricing/#compare">Compare tiers</a></div>';
  }

  /* overview */
  function overview() {
    sb.rpc('gc_owner_stats', { p_listing: cur.public_id }).then(function (r) {
      var s = r.data || {};
      var card = function (n, label, icon) { return '<div class="stat"><b>' + (n == null ? '–' : n) + '</b><span><i class="fa-solid ' + icon + '"></i> ' + label + '</span></div>'; };
      var cv = s.category_views || {}, mine = s.views || 0, t = tierOf(cur);
      var up = '';
      if (t !== 'gold' && cv.gold != null) {
        var better = t === 'none' ? (cv.blue != null ? 'Blue businesses in your category average <b>' + cv.blue + '</b> views and Gold <b>' + cv.gold + '</b>' : 'Gold businesses in your category average <b>' + cv.gold + '</b> views')
          : 'Gold businesses in your category average <b>' + cv.gold + '</b> views, with ads on every page';
        up = '<div class="note" style="margin-top:1rem"><b>Your profile had ' + mine + ' views in the last 30 days.</b> ' + better + '. <a href="/pricing/#compare">See what upgrading adds</a>.</div>';
      }
      body.innerHTML = (cur.status !== 'approved' ? '<div class="note note--w" style="margin-bottom:1rem">' +
          (cur.status === 'pending' ? 'Your listing is waiting for review. We usually review within one to two business days.' :
           cur.status === 'rejected' ? '<b>Your application needs changes.</b> ' + esc(cur.reject_reason || '') + (cur.reject_fix ? '<br><b>How to fix it:</b> ' + esc(cur.reject_fix) : '') + ' <a href="/list/?ref=' + esc(cur.public_id) + '">Continue my application</a>' :
           'Your listing is suspended. ' + esc(cur.reject_reason || '') + ' Contact info@getclient.co.za.') + '</div>' : '') +
        '<p class="eyebrow">Last 30 days</p><div class="stats">' +
        card(s.views, 'profile views', 'fa-eye') + card(s.badge_clicks, 'visits from your badge', 'fa-certificate') +
        card(s.website_clicks, 'clicks to your website', 'fa-globe') + card(s.phone_clicks, 'calls and WhatsApps', 'fa-phone') + '</div>' +
        '<div class="stats" style="margin-top:1rem">' + card(s.leads_offered, 'job offers', 'fa-briefcase') + card(s.leads_accepted, 'jobs accepted', 'fa-handshake') +
        card(s.quotes, 'direct quote requests', 'fa-paper-plane') + card(s.response_rate == null ? '–' : s.response_rate + '%', 'response rate', 'fa-reply') + '</div>' + up +
        (!cur.badge_verified_at ? '<div class="note note--w" style="margin-top:1rem"><b>Badge not confirmed on ' + esc(cur.website || 'your website') + '.</b> Every listing must show it. <a href="#" data-goto="badge">Get the code and check it</a>.</div>' : '');
      var g = $('[data-goto]', body); if (g) g.addEventListener('click', function (e) { e.preventDefault(); go('badge'); });
    });
  }

  /* job offers */
  function jobs() {
    if (tierOf(cur) === 'none') { body.innerHTML = upsell('Job offers'); return; }
    sb.rpc('gc_owner_leads', { p_listing: cur.public_id }).then(function (r) {
      var rows = (r.data || []).map(function (x) { return x.gc_owner_leads || x; });
      if (r.error) { body.innerHTML = '<div class="empty"><p>' + esc(err(r.error)) + '</p></div>'; return; }
      if (!rows.length) { body.innerHTML = '<div class="empty"><h3>No job offers yet</h3><p>When a client near you asks for ' + esc(cur.subcategory || 'your services') + ', and you are one of the best matches, the job appears here and in your email. Keep your services up to date so we match you accurately.</p><a class="btn btn-g" href="#" data-goto="services">Edit my services</a></div>'; var g = $('[data-goto]', body); if (g) g.addEventListener('click', function (e) { e.preventDefault(); go('services'); }); return; }
      body.innerHTML = rows.map(function (l) {
        var j = l.job, open = l.status === 'offered';
        var st = { offered: 'Waiting for your answer', accepted: 'Accepted', declined: 'Declined', expired: 'Expired (not answered in time)', withdrawn: 'Closed by the client' }[l.status];
        return '<article class="areq"><div class="areq__h"><div><h3>' + esc(j.service) + ' <span class="tier ' + (open ? 'tier--blue' : 'tier--none') + '">' + st + '</span>' +
          (l.match === 'possible' ? '<span class="tier tier--none">Possible match</span>' : '') + '</h3>' +
          '<div class="areq__m"><span>' + esc(j.city) + (l.nearby ? ' (nearby)' : '') + '</span><span>' + esc(TIMING[j.timing] || '') + '</span>' + (j.budget ? '<span>Budget: ' + esc(j.budget) + '</span>' : '') +
          '<span>' + esc(j.ref) + '</span><span>Offered ' + when(l.offered_at) + '</span></div></div>' +
          (open ? '<div class="areq__acts"><button class="btn btn-p btn-s" data-acc="' + l.lead_id + '">Accept</button><button class="btn btn-g btn-s" data-dec="' + l.lead_id + '">Decline</button></div>' : '') + '</div>' +
          '<p style="white-space:pre-wrap;margin:.8rem 0 0">' + esc(j.details) + '</p>' +
          (open ? '<p class="hint" style="margin:.5rem 0 0">Answer by ' + when(l.expires_at) + '.</p>' : '') +
          (l.client ? '<div class="note note--ok" style="margin-top:.8rem"><b>' + esc(l.client.name) + '</b> · ' + (l.client.phone ? '<a href="tel:' + esc(l.client.phone) + '">' + esc(l.client.phone) + '</a> · ' : '') + (l.client.email ? '<a href="mailto:' + esc(l.client.email) + '">' + esc(l.client.email) + '</a>' : '') + '</div>' : '') +
          '</article>';
      }).join('');
      $$('[data-acc],[data-dec]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-acc') || b.getAttribute('data-dec'), action = b.hasAttribute('data-acc') ? 'accept' : 'decline';
          var reason = null;
          if (action === 'decline') { reason = prompt('Why are you declining? (optional, e.g. Fully booked, Not my kind of work)', 'Not my kind of work'); if (reason === null) return; }
          b.disabled = true;
          sb.rpc('gc_owner_respond_lead', { p_lead: id, p_action: action, p_reason: reason }).then(function (r) {
            if (r.error || (r.data && r.data.ok === false)) alert((r.data && r.data.error) || err(r.error));
            header(); jobs();
          });
        });
      });
    });
  }

  /* quote requests */
  function quotes() {
    if (tierOf(cur) === 'none') { body.innerHTML = upsell('Quote requests'); return; }
    sb.from(T('quotes')).select('*').eq('business_id', cur.public_id).order('created_at', { ascending: false }).limit(200).then(function (r) {
      var rows = r.data || [];
      if (!rows.length) { body.innerHTML = '<div class="empty"><h3>No quote requests yet</h3><p>Requests sent from your profile appear here and in your email.</p></div>'; return; }
      body.innerHTML = rows.map(function (q) {
        return '<article class="areq"><div class="areq__h"><div><h3>' + esc(q.name) + ' <span class="tier ' + (q.responded_at ? 'tier--blue' : 'tier--none') + '">' + (q.responded_at ? 'Replied' : 'Not replied yet') + '</span></h3>' +
          '<div class="areq__m"><span>' + when(q.created_at) + '</span>' + (q.phone ? '<span><a href="tel:' + esc(q.phone) + '">' + esc(q.phone) + '</a></span>' : '') + '</div></div>' +
          '<div class="areq__acts"><a class="btn btn-p btn-s" href="mailto:' + esc(q.email) + '?subject=' + encodeURIComponent('Your quote request on Getclient') + '">Reply by email</a>' +
          (q.responded_at ? '' : '<button class="btn btn-g btn-s" data-mark="' + q.id + '">Mark as replied</button>') + '</div></div>' +
          '<p style="white-space:pre-wrap;margin:.8rem 0 0">' + esc(q.details) + '</p></article>';
      }).join('') + '<p class="hint">Marking requests as replied keeps your published response rate accurate.</p>';
      $$('[data-mark]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          b.disabled = true;
          sb.rpc('gc_owner_mark_quote', { p_id: b.getAttribute('data-mark'), p_answered: true }).then(function (r) { if (r.error) alert(err(r.error)); quotes(); });
        });
      });
    });
  }

  /* listing details */
  function listingForm() {
    var f = function (k, label, type, extra) {
      var v = cur[k] == null ? '' : cur[k];
      return '<div class="f"><label for="ol-' + k + '">' + label + '</label>' + (type === 'area'
        ? '<textarea id="ol-' + k + '" data-k="' + k + '" minlength="50">' + esc(v) + '</textarea>'
        : '<input id="ol-' + k + '" data-k="' + k + '" value="' + esc(v) + '"' + (type ? ' type="' + type + '"' : '') + (extra || '') + '>') + '</div>';
    };
    body.innerHTML = '<form class="form card" id="ol-form" style="padding:1.6rem;max-width:760px">' +
      '<p class="hint" style="margin:0">Business name, category and town: email <a href="mailto:info@getclient.co.za">info@getclient.co.za</a> to change these, since they affect verification.</p>' +
      f('tagline', 'One-line summary', '', ' maxlength="120"') + f('description', 'Description of your business', 'area') +
      '<div class="row2">' + f('subcategory', 'Speciality (used to match you to jobs)', '', ' maxlength="80"') + f('employees', 'Team size') + '</div>' +
      '<div class="row2">' + f('phone', 'Phone', 'tel') + f('website', 'Website', 'url') + '</div>' +
      f('address', 'Address or area served') +
      '<div class="row2">' + f('contact_name', 'Contact person') + f('contact_role', 'Role') + '</div>' +
      '<p class="hint" style="margin:0">Changing your website means the Getclient badge must be confirmed on the new site.</p>' +
      '<button class="btn btn-p" type="submit">Save changes</button><p class="msg" id="ol-msg"></p></form>';
    $('#ol-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var p = {};
      $$('[data-k]', this).forEach(function (i) { p[i.getAttribute('data-k')] = i.value; });
      var m = $('#ol-msg'); m.className = 'msg'; m.textContent = 'Saving…';
      sb.rpc('gc_owner_update', { p_listing: cur.public_id, p: p }).then(function (r) {
        if (r.error) { m.className = 'msg err'; m.textContent = err(r.error); return; }
        Object.keys(p).forEach(function (k) { cur[k] = p[k]; });
        m.className = 'msg ok'; m.textContent = 'Saved. Your profile updates within minutes.';
      });
    });
  }

  /* services */
  function services() {
    var cap = CAP[tierOf(cur)].services;
    if (!cap) { body.innerHTML = upsell('Services'); return; }
    sb.from(T('services')).select('name,description,price_from,sort').eq('listing_id', cur.public_id).order('sort').then(function (r) {
      var rows = r.data || [];
      var line = function (s) {
        return '<div class="svc-row"><input placeholder="Service, e.g. Geyser installation" maxlength="80" data-s="name" value="' + esc(s.name || '') + '">' +
          '<input placeholder="One line about it" maxlength="280" data-s="description" value="' + esc(s.description || '') + '">' +
          '<input placeholder="Price, e.g. From R450" maxlength="40" data-s="price_from" value="' + esc(s.price_from || '') + '" style="max-width:180px">' +
          '<button type="button" class="btn btn-g btn-s" data-rm aria-label="Remove">&times;</button></div>';
      };
      body.innerHTML = '<div class="card" style="padding:1.6rem;max-width:900px"><h3>Your services <span class="mut" style="font-weight:400">(up to ' + cap + ')</span></h3>' +
        '<p class="hint">Clients see these on your profile, and we use them to match you to the right jobs. Be specific: "Geyser installation" matches better than "Plumbing work".</p>' +
        '<div id="sv-list" style="display:grid;gap:.5rem;margin:1rem 0">' + (rows.length ? rows : [{}]).map(line).join('') + '</div>' +
        '<button class="btn btn-g btn-s" type="button" id="sv-add"><i class="fa-solid fa-plus"></i> Add a service</button> ' +
        '<button class="btn btn-p" type="button" id="sv-save">Save services</button><p class="msg" id="sv-msg"></p></div>';
      var list = $('#sv-list');
      list.addEventListener('click', function (e) { if (e.target.closest('[data-rm]')) e.target.closest('.svc-row').remove(); });
      $('#sv-add').addEventListener('click', function () { if ($$('.svc-row', list).length < cap) list.insertAdjacentHTML('beforeend', line({})); });
      $('#sv-save').addEventListener('click', function () {
        var data = $$('.svc-row', list).map(function (row) {
          var o = {}; $$('[data-s]', row).forEach(function (i) { o[i.getAttribute('data-s')] = i.value.trim(); }); return o;
        }).filter(function (o) { return o.name.length >= 2; });
        var m = $('#sv-msg'); m.className = 'msg'; m.textContent = 'Saving…';
        sb.rpc('gc_owner_set_services', { p_listing: cur.public_id, p: data }).then(function (r) {
          if (r.error) { m.className = 'msg err'; m.textContent = err(r.error); return; }
          m.className = 'msg ok'; m.textContent = 'Saved ' + data.length + ' service' + (data.length === 1 ? '' : 's') + '.';
        });
      });
    });
  }

  /* photos */
  function photos() {
    var cap = CAP[tierOf(cur)].photos;
    if (!cap) { body.innerHTML = upsell('Photos'); return; }
    sb.from(T('photos')).select('id,path,sort').eq('listing_id', cur.public_id).order('sort').then(function (r) {
      var rows = r.data || [];
      body.innerHTML = '<div class="card" style="padding:1.6rem"><h3>Photos <span class="mut" style="font-weight:400">(' + rows.length + ' of ' + cap + ')</span></h3>' +
        '<p class="hint">JPG, PNG or WebP, up to 5 MB each. The first photo is your cover image.</p>' +
        '<div class="gallery" style="margin:1rem 0">' + rows.map(function (p) {
          return '<div class="gallery__i" style="position:relative"><img src="' + esc(G.photoURL(p.path)) + '" alt=""><button class="btn btn-danger btn-s" data-del="' + p.id + '" style="position:absolute;top:6px;right:6px">Delete</button></div>';
        }).join('') + '</div>' +
        (rows.length < cap ? '<input type="file" id="ph-in" accept="image/jpeg,image/png,image/webp" multiple> <p class="msg" id="ph-msg"></p>' : '<p class="hint">You have reached the photo limit for your tier.</p>') + '</div>';
      $$('[data-del]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Delete this photo?')) return;
          sb.rpc('gc_owner_delete_photo', { p_id: b.getAttribute('data-del') }).then(function (x) { if (x.error) alert(err(x.error)); photos(); });
        });
      });
      var inp = $('#ph-in');
      if (inp) inp.addEventListener('change', function () {
        var files = Array.prototype.slice.call(inp.files, 0, cap - rows.length);
        var m = $('#ph-msg'); m.className = 'msg'; m.textContent = 'Uploading ' + files.length + '…';
        Promise.all(files.map(function (file, i) {
          if (file.size > 5 * 1024 * 1024) return Promise.resolve('too big');
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          var path = cur.public_id + '/' + Date.now() + '-' + i + '.' + ext;
          return sb.storage.from('gc-photos').upload(path, file, { cacheControl: '31536000' }).then(function (u) {
            if (u.error) return u.error.message;
            return sb.from(T('photos')).insert({ listing_id: cur.public_id, path: path, sort: rows.length + i }).then(function (x) { return x.error ? x.error.message : null; });
          });
        })).then(function (res) {
          var bad = res.filter(Boolean);
          if (bad.length) alert('Some photos were not added: ' + bad.join('; '));
          photos();
        });
      });
    });
  }

  /* badge */
  function badge() {
    var code = '<script src="https://getclient.co.za/badge.js" data-gc-id="' + cur.public_id + '" async><\/script>';
    body.innerHTML = '<div class="card" style="padding:1.6rem;max-width:820px"><h3>Your Listed on Getclient badge</h3>' +
      '<p>' + (cur.badge_verified_at ? '<span class="pillok"><i class="fa-solid fa-check"></i> Found on your website ' + when(cur.badge_verified_at) + '</span>' : '<span class="pillno"><i class="fa-solid fa-xmark"></i> Not confirmed on your website yet</span>') + '</p>' +
      '<p class="hint">Every listing must show the badge on its website. Paste this once, ideally in your footer:</p>' +
      '<div class="codebox"><button class="btn btn-s copy" data-copy="#bd-code">Copy</button><pre id="bd-code">' + esc(code) + '</pre></div>' +
      '<p style="margin-top:1rem"><button class="btn btn-p" id="bd-check"><i class="fa-solid fa-magnifying-glass"></i> Check ' + esc((cur.website || '').replace(/^https?:\/\//, '')) + ' now</button> <a class="btn btn-g" href="/badge/?id=' + esc(cur.public_id) + '">Other badge styles</a></p>' +
      '<p class="msg" id="bd-msg"></p></div>';
    $('#bd-check').addEventListener('click', function () {
      var m = $('#bd-msg'); m.className = 'msg'; m.textContent = 'Checking your website…';
      G.fn('check-badge', { listing_id: cur.public_id }).then(function (r) {
        if (r.status !== 200) { m.className = 'msg err'; m.textContent = (r.data && (r.data.error || r.data.message)) || 'The check is not available right now.'; return; }
        if (r.data.found) { cur.badge_verified_at = r.data.checked_at; m.className = 'msg ok'; m.textContent = 'Badge found. Thank you!'; }
        else { m.className = 'msg err'; m.textContent = (r.data.error || 'Badge not found.') + ' Publish the code, then check again.'; }
      });
    });
  }

  sb.auth.getSession().then(function (r) { if (r.data && r.data.session) start(); else view('login'); });
})();
