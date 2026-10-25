/*! Getclient reviewer panel.
 *  Pending, Approved, Rejected and Suspended sections. Acting on an application
 *  moves it to its new section straight away. Approval needs the Listed on
 *  Getclient badge to be found on the business website (the database enforces
 *  this too). Rejecting asks for the issue and how to fix it; the applicant is
 *  emailed both, with a link to continue their application.
 */
(function () {
  'use strict';
  var G = window.GC || {};
  var sb = G.sb, LIVE = G.live, esc = G.esc, T = G.T;
  var admin = document.getElementById('gc-admin');
  if (!admin) return;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var queue = $('#gc-queue'), loginBox = $('#gc-login'), main = $('#gc-admin-main');
  var current = 'pending', cache = {}, filter = '';

  var CHECKS = [
    ['check_identity', 'Identity'], ['check_cipc', 'CIPC registration'],
    ['check_insurance', 'Insurance'], ['check_trading_history', 'Trading history'], ['check_reviews', 'Client ratings']
  ];
  // A tier may only be set once the checks behind it are actually ticked.
  var REQUIRED = {
    none: [], blue: ['check_identity', 'check_cipc'],
    gold: ['check_identity', 'check_cipc', 'check_insurance', 'check_trading_history', 'check_reviews']
  };
  // Common rejection reasons, each with the fix that goes into the applicant's email.
  var REASONS = [
    ['badge', 'The Listed on Getclient badge is not on your website.',
      'Paste the badge code from https://getclient.co.za/badge/ into your website (the footer is best), publish it, and submit your application again.'],
    ['website', 'Your website could not be reached, or does not belong to this business.',
      'Make sure your website is live and shows your business name, then submit again with the correct address.'],
    ['cipc', 'The CIPC registration number does not match the CIPC register.',
      'Check the number on your CoR14.3 certificate (format 2019/123456/07) and submit again with the correct number.'],
    ['docs', 'One or more verification documents are missing, unreadable or out of date.',
      'Upload clear, current copies of every document listed for your tier (PDF, JPG or PNG) and submit again.'],
    ['details', 'The business details are incomplete or inaccurate.',
      'Complete every required field with your registered business name, a real description and working contact details.'],
    ['duplicate', 'This business is already listed on Getclient.',
      'Contact info@getclient.co.za to manage or upgrade your existing listing instead of applying again.'],
    ['other', '', '']
  ];

  function show(view) { loginBox.hidden = view === 'main'; main.hidden = view !== 'main'; }

  $('#gc-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('#gc-login-msg');
    if (!LIVE) { m.textContent = 'Connect Supabase in config.js first.'; return; }
    m.textContent = 'Signing in…';
    sb.auth.signInWithPassword({ email: $('#gc-email').value, password: $('#gc-password').value }).then(function (r) {
      if (r.error) { m.textContent = 'Those credentials did not work.'; return; }
      show('main'); refresh(); offerPasskey();
    });
  });

  /* ---------- fingerprint / face sign-in (passkeys) ---------- */
  // The device checks the fingerprint or face and signs a one-time challenge;
  // the admin-passkey edge function verifies it and returns a sign-in token.
  var CFG = window.GC_CONFIG || {};
  var WA = window.SimpleWebAuthnBrowser;
  var pkMsg = $('#gc-pk-msg');
  function pkFn(body, token) {
    return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/admin-passkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + (token || CFG.supabaseAnonKey) },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); })
      .catch(function () { return { status: 0, data: {} }; });
  }
  function pkSupported() {
    if (!WA || !window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

  function deviceName() {
    var u = navigator.userAgent;
    return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone' :
      /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows PC' : 'This device';
  }

  function turnOn() {
    pkMsg.className = 'msg'; pkMsg.textContent = 'Follow the prompt on your device…';
    sb.auth.getSession().then(function (s) {
      var token = s.data && s.data.session && s.data.session.access_token;
      if (!token) { pkMsg.className = 'msg err'; pkMsg.textContent = 'Sign in with your password first.'; return; }
      return pkFn({ action: 'register-options' }, token).then(function (o) {
        if (o.status !== 200) throw new Error(o.status === 404 || o.status === 0 ? 'Fingerprint sign-in is not switched on yet (deploy the admin-passkey function).' : (o.data.message || 'Could not start.'));
        return WA.startRegistration(o.data.options);
      }).then(function (att) {
        return pkFn({ action: 'register-verify', response: att, device: deviceName() }, token);
      }).then(function (v) {
        if (v.status !== 200) throw new Error(v.data.message || 'Setting it up did not complete.');
        store.set('gc_pk_on', '1');
        $('#gc-pk-offer').hidden = true;
        pkMsg.className = 'msg ok'; pkMsg.textContent = 'Done. Next time, choose "Sign in with fingerprint or face".';
      });
    }).catch(function (err) {
      pkMsg.className = 'msg err';
      pkMsg.textContent = err && err.name === 'NotAllowedError' ? 'Cancelled. You can turn it on any time from the Fingerprint / face button.' : (err.message || String(err));
    });
  }

  function offerPasskey() {
    pkSupported().then(function (yes) {
      if (!yes) return;
      $('#gc-pk-setup').hidden = false;
      if (!store.get('gc_pk_on') && !store.get('gc_pk_later')) $('#gc-pk-offer').hidden = false;
    });
  }
  $('#gc-pk-on').addEventListener('click', turnOn);
  $('#gc-pk-setup').addEventListener('click', turnOn);
  $('#gc-pk-later').addEventListener('click', function () { store.set('gc_pk_later', '1'); $('#gc-pk-offer').hidden = true; });

  pkSupported().then(function (yes) { if (yes) $('#gc-pk-login-box').hidden = false; });
  $('#gc-pk-login').addEventListener('click', function () {
    var m = $('#gc-login-msg'), btn = this;
    btn.disabled = true; m.textContent = 'Follow the prompt on your device…';
    pkFn({ action: 'login-options' }).then(function (o) {
      if (o.status !== 200) throw new Error(o.status === 404 || o.status === 0 ? 'Fingerprint sign-in is not switched on yet. Use your password.' : (o.data.message || 'Could not start.'));
      return WA.startAuthentication(o.data.options).then(function (asr) {
        return pkFn({ action: 'login-verify', response: asr, challenge_id: o.data.challenge_id });
      });
    }).then(function (v) {
      if (v.status !== 200 || !v.data.token_hash) throw new Error(v.data.message || 'That sign-in was not accepted.');
      return sb.auth.verifyOtp({ token_hash: v.data.token_hash, type: 'magiclink' });
    }).then(function (r) {
      btn.disabled = false;
      if (r.error) throw r.error;
      store.set('gc_pk_on', '1');
      m.textContent = '';
      show('main'); refresh(); offerPasskey();
    }).catch(function (err) {
      btn.disabled = false;
      m.textContent = err && err.name === 'NotAllowedError' ? 'Cancelled.' : (err.message || String(err));
    });
  });

  // the app shortcut "Pending applications" opens /admin/?tab=...
  var wantTab = new URLSearchParams(location.search).get('tab');
  if (wantTab) setTimeout(function () { var t = $('.atab[data-status="' + wantTab.replace(/[^a-z]/g, '') + '"]'); if (t) t.click(); }, 0);
  $('#gc-admin-out').addEventListener('click', function () { sb.auth.signOut().then(function () { show('login'); }); });
  $('#gc-admin-refresh').addEventListener('click', refresh);
  $('#gc-admin-q').addEventListener('input', function () { filter = this.value.trim().toLowerCase(); render(); });

  /* ---------- data ---------- */
  function refresh() {
    queue.innerHTML = '<p class="lede">Loading…</p>';
    return Promise.all(['pending', 'approved', 'rejected', 'suspended'].map(function (s) {
      return sb.from(T('listings')).select('*').eq('status', s).order('created_at', { ascending: false }).limit(1000)
        .then(function (r) { cache[s] = r.error ? null : (r.data || []); });
    }).concat([
      sb.from(T('quotes')).select('*').order('created_at', { ascending: false }).limit(200)
        .then(function (r) { cache.quotes = r.error ? null : (r.data || []); }),
      sb.from(T('jobs')).select('*, ' + T('leads') + '(listing_id, status, rank, nearby, relevance, offered_at, responded_at, decline_reason)')
        .order('created_at', { ascending: false }).limit(200)
        .then(function (r) { cache.jobs = r.error ? null : (r.data || []); })
    ])).then(function () { counts(); render(); });
  }
  function counts() {
    $$('[data-count]').forEach(function (n) {
      var c = cache[n.getAttribute('data-count')];
      n.textContent = c ? c.length : '–';
    });
  }
  function move(id, from, to, patch) {
    var list = cache[from] || [], i = list.findIndex(function (x) { return x.id === id; });
    if (i === -1) return;
    var row = Object.assign(list.splice(i, 1)[0], patch);
    if (to && cache[to]) cache[to].unshift(row);
    counts(); render();
  }

  /* ---------- tabs ---------- */
  admin.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-status]');
    if (!tab || !tab.classList.contains('atab')) return;
    $$('.atab').forEach(function (t) { t.classList.remove('on'); });
    tab.classList.add('on');
    current = tab.getAttribute('data-status');
    render();
  });

  /* ---------- rendering ---------- */
  function tierLabel(t) { return t === 'gold' ? 'Gold Verified' : t === 'blue' ? 'Blue Verified' : 'Basic'; }
  function date(d) { return d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
  function badgePill(x) {
    if (x.badge_verified_at) return '<span class="pillok"><i class="fa-solid fa-check"></i> Badge found ' + date(x.badge_verified_at) + '</span>';
    if (x.badge_check && x.badge_check.error) return '<span class="pillno"><i class="fa-solid fa-xmark"></i> Badge not found</span>';
    return '<span class="pillwait"><i class="fa-solid fa-clock"></i> Badge not checked</span>';
  }

  function card(x) {
    var s = x.status;
    var acts = '';
    if (s === 'pending') {
      acts = '<button class="btn btn-g btn-s" data-badge="' + x.id + '"><i class="fa-solid fa-magnifying-glass"></i> Check badge</button>' +
        '<button class="btn btn-p btn-s" data-act="approved" data-id="' + x.id + '"' + (x.badge_verified_at ? '' : ' disabled title="Find the badge first"') + '>Approve</button>' +
        '<button class="btn btn-danger btn-s" data-reject="' + x.id + '">Reject</button>';
    } else if (s === 'approved') {
      acts = '<a class="btn btn-g btn-s" href="/b/' + esc(x.slug || '') + '/" target="_blank">View</a>' +
        '<button class="btn btn-g btn-s" data-badge="' + x.id + '">Check badge</button>' +
        '<button class="btn btn-danger btn-s" data-reject="' + x.id + '" data-to="suspended">Suspend</button>';
    } else {
      acts = '<button class="btn btn-g btn-s" data-act="pending" data-id="' + x.id + '">Move to pending</button>' +
        '<button class="btn btn-g btn-s" data-badge="' + x.id + '">Check badge</button>' +
        '<button class="btn btn-p btn-s" data-act="approved" data-id="' + x.id + '"' + (x.badge_verified_at ? '' : ' disabled title="Find the badge first"') + '>Approve</button>';
    }

    var docs = x.requested_plan && x.requested_plan !== 'basic'
      ? '<details class="verify" data-docs="' + esc(x.public_id) + '"><summary>Documents' + (x.docs_complete ? ' ✓' : ' (incomplete)') + '</summary><div class="verify__body"><p class="hint">Loading…</p></div></details>' : '';

    var verify = s === 'approved'
      ? '<details class="verify"><summary>Set verification tier</summary><div class="verify__body" data-vid="' + x.id + '">' +
        '<div class="verify__checks">' + CHECKS.map(function (c) {
          return '<label class="chk" style="font-size:.82rem"><input type="checkbox" data-ck="' + c[0] + '"' + (x[c[0]] ? ' checked' : '') + '><span>' + c[1] + '</span></label>';
        }).join('') + '</div><div class="verify__foot"><select data-tier>' + ['none', 'blue', 'gold'].map(function (t) {
          return '<option value="' + t + '"' + ((x.tier || 'none') === t ? ' selected' : '') + '>' + (t === 'none' ? 'Basic' : tierLabel(t)) + '</option>';
        }).join('') + '</select><button class="btn btn-p btn-s" data-save="' + x.id + '">Save tier</button><span class="verify__msg"></span></div>' +
        '<p class="hint" style="margin:.6rem 0 0">Blue needs identity and CIPC. Gold needs all five. Gold appears in the ads on every page; Blue in the Blue Verified showcase.</p></div></details>'
      : '';

    var why = (s === 'rejected' || s === 'suspended') && (x.reject_reason || x.reject_fix)
      ? '<div class="abox" style="grid-column:1/-1;background:#FFF7F7;border-color:#F4C7C7"><h4>' + (s === 'rejected' ? 'Rejected' : 'Suspended') + ' because</h4>' + esc(x.reject_reason || '') +
        (x.reject_fix ? '<h4 style="margin-top:.6rem">How to fix it (sent to the applicant)</h4>' + esc(x.reject_fix) : '') + '</div>' : '';

    return '<article class="areq" data-row="' + x.id + '"><div class="areq__h"><div>' +
      '<h3>' + esc(x.name) + ' <span class="tier tier--' + (x.tier && x.tier !== 'none' ? x.tier : 'none') + '">' + tierLabel(x.tier) + '</span>' +
      (x.requested_plan && x.requested_plan !== 'basic' ? '<span class="tier tier--listed">Applied for ' + tierLabel(x.requested_plan) + '</span>' : '') + '</h3>' +
      '<div class="areq__m"><span><code>' + esc(x.public_id || '') + '</code></span><span>' + esc(x.category || '') + ' · ' + esc(x.city || '') + '</span><span>Submitted ' + date(x.created_at) + '</span>' +
      (x.paid_plan ? '<span style="color:var(--ok)">Paid: ' + esc(x.paid_plan) + '</span>' : '') + '</div></div>' +
      '<div class="areq__acts">' + acts + '</div></div>' +
      '<div class="areq__g">' +
      '<div class="abox"><h4>Contact</h4>' + esc(x.contact_name || '') + (x.contact_role ? ', ' + esc(x.contact_role) : '') + '<br>' +
        '<a href="mailto:' + esc(x.email || '') + '">' + esc(x.email || '') + '</a><br>' + esc(x.phone || '') + '</div>' +
      '<div class="abox"><h4>Website and badge</h4>' + (x.website ? '<a href="' + esc(x.website) + '" target="_blank" rel="noopener">' + esc(x.website) + '</a>' : '<i>No website</i>') +
        '<div style="margin-top:.5rem">' + badgePill(x) + '</div>' +
        (x.badge_check && x.badge_check.error && !x.badge_verified_at ? '<div class="hint" style="margin-top:.3rem">' + esc(x.badge_check.error) + '</div>' : '') + '</div>' +
      '<div class="abox"><h4>Registration</h4>CIPC: ' + esc(x.cipc || '—') + '<br>Founded: ' + esc(x.founded || '—') + '<br>Team: ' + esc(x.employees || '—') + '</div>' +
      why + '</div>' +
      '<p style="font-size:.86rem;color:var(--mut);margin:.8rem 0 0">' + esc((x.description || '').slice(0, 280)) + ((x.description || '').length > 280 ? '…' : '') + '</p>' +
      docs + verify + '<div data-reject-box></div></article>';
  }

  // smart quote matching: every job, and exactly what happened with each offer
  function jobCard(j) {
    var leads = (j[T('leads')] || []).slice().sort(function (a, b) { return a.rank - b.rank; });
    var tone = { matching: 'tier--blue', matched: 'tier--gold', no_match: 'tier--none', closed: 'tier--none' }[j.status] || 'tier--none';
    var st = { offered: 'pillwait', accepted: 'pillok', declined: 'pillno', expired: 'pillno', withdrawn: 'pillwait' };
    return '<article class="areq"><div class="areq__h"><div><h3>' + esc(j.service) + ' <span class="tier ' + tone + '">' + esc(j.status.replace('_', ' ')) + '</span><span class="tier tier--listed">' + esc(j.ref) + '</span></h3>' +
      '<div class="areq__m"><span>' + esc(j.category) + ' · ' + esc(j.city) + '</span><span>' + esc(j.timing) + '</span>' + (j.budget ? '<span>' + esc(j.budget) + '</span>' : '') +
      '<span>' + esc(j.source) + '</span><span>' + date(j.created_at) + '</span></div></div></div>' +
      '<div class="areq__g"><div class="abox"><h4>Client</h4>' + esc(j.client_name) + '<br>' + (j.client_email ? '<a href="mailto:' + esc(j.client_email) + '">' + esc(j.client_email) + '</a><br>' : '') + esc(j.client_phone || '') + '</div>' +
      '<div class="abox" style="grid-column:span 2"><h4>Offers</h4>' + (leads.length ? leads.map(function (l) {
        return '<div style="margin:.2rem 0"><span class="' + (st[l.status] || 'pillwait') + '">' + esc(l.status) + '</span> <code>' + esc(l.listing_id) + '</code> #' + l.rank +
          (l.nearby ? ' · nearby' : '') + ' · match ' + Math.round((l.relevance || 0) * 100) + '%' + (l.decline_reason ? ' · "' + esc(l.decline_reason) + '"' : '') + '</div>';
      }).join('') : '<i>No verified business could take it.</i>') + '</div></div>' +
      '<p style="white-space:pre-wrap;font-size:.88rem;margin:.8rem 0 0">' + esc(j.details) + '</p></article>';
  }

  function quoteCard(q) {
    return '<article class="areq"><div class="areq__h"><div><h3>' + esc(q.name || '') + '</h3><div class="areq__m"><span>To <code>' + esc(q.business_id || '') + '</code></span><span>' + date(q.created_at) + '</span></div></div>' +
      '<div class="areq__acts"><a class="btn btn-g btn-s" href="mailto:' + esc(q.email || '') + '">Email ' + esc(q.email || '') + '</a></div></div>' +
      '<p style="white-space:pre-wrap;font-size:.9rem;margin:.8rem 0 0">' + esc(q.details || '') + '</p>' +
      (q.phone ? '<p class="hint" style="margin:.4rem 0 0">Phone: ' + esc(q.phone) + '</p>' : '') + '</article>';
  }

  function render() {
    var rows = cache[current];
    if (rows === null) {
      queue.innerHTML = '<div class="empty"><h3>Could not load this section</h3><p>' + (current === 'quotes'
        ? 'Quote requests are not readable by reviewers yet. Grant gc_admins read access to gc_quotes in Supabase.'
        : 'Your session may have expired, or this account is not in gc_admins.') + '</p></div>';
      return;
    }
    rows = (rows || []).filter(function (x) {
      return !filter || [x.name, x.public_id, x.email, x.business_id, x.city, x.ref, x.service, x.client_name, x.client_email].join(' ').toLowerCase().indexOf(filter) > -1;
    });
    if (!rows.length) {
      queue.innerHTML = '<div class="empty"><h3>Nothing here</h3><p>No ' + (current === 'quotes' ? 'quote requests' : current === 'jobs' ? 'jobs' : current + ' applications') + (filter ? ' match that search' : ' right now') + '.</p></div>';
      return;
    }
    queue.innerHTML = rows.map(current === 'quotes' ? quoteCard : current === 'jobs' ? jobCard : card).join('');
  }

  /* ---------- actions ---------- */
  function findRow(id) {
    for (var s in cache) { var r = (cache[s] || []).find(function (x) { return x.id === id; }); if (r) return [s, r]; }
    return [null, null];
  }

  queue.addEventListener('click', function (e) {
    // check the business website for the badge
    var bc = e.target.closest('[data-badge]');
    if (bc) {
      var f = findRow(bc.getAttribute('data-badge'));
      bc.disabled = true; bc.textContent = 'Checking…';
      G.fn('check-badge', { listing_id: f[1].public_id }).then(function (r) {
        bc.disabled = false;
        if (r.status === 404 || r.status === 0) {
          alert('The badge checker is not deployed yet. Deploy the check-badge function (see README).');
          bc.textContent = 'Check badge'; return;
        }
        f[1].badge_check = r.data;
        if (r.data.found) f[1].badge_verified_at = r.data.checked_at;
        else alert('Badge not found: ' + (r.data.error || 'no badge code on ' + (r.data.url || 'the website')));
        render();
      });
      return;
    }

    // approve / move back to pending
    var act = e.target.closest('[data-act]');
    if (act) {
      var id = act.getAttribute('data-id'), to = act.getAttribute('data-act'), from = findRow(id)[0];
      act.disabled = true;
      var patch = { status: to, reviewed_at: new Date().toISOString() };
      if (to === 'approved') { patch.reject_reason = null; patch.reject_fix = null; }
      sb.from(T('listings')).update(patch).eq('id', id).then(function (r) {
        if (r.error) {
          act.disabled = false;
          alert(/badge not verified/i.test(r.error.message) ? 'Approval blocked: the Listed on Getclient badge has not been found on this business\'s website yet. Press "Check badge".' : 'Did not save: ' + r.error.message);
          return;
        }
        move(id, from, to, patch);
      });
      return;
    }

    // open the rejection / suspension form
    var rj = e.target.closest('[data-reject]');
    if (rj) {
      var rid = rj.getAttribute('data-reject'), target = rj.getAttribute('data-to') || 'rejected';
      var box = $('[data-row="' + rid + '"] [data-reject-box]');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="reject"><label>Main issue<select data-reason>' + REASONS.map(function (r) {
          return '<option value="' + r[0] + '">' + (r[1] || 'Something else (write it below)') + '</option>';
        }).join('') + '</select></label>' +
        '<label>What the issue is (sent to the applicant)<textarea data-why>' + esc(REASONS[0][1]) + '</textarea></label>' +
        '<label>How to fix it (sent to the applicant)<textarea data-fix>' + esc(REASONS[0][2]) + '</textarea></label>' +
        '<p class="hint" style="margin:0">The email also links to ' + (target === 'rejected' ? 'getclient.co.za/list/ so they can continue their application' : 'our contact details') + '.</p>' +
        '<div style="display:flex;gap:.5rem"><button class="btn btn-danger btn-s" data-send="' + rid + '" data-to="' + target + '">' +
        (target === 'rejected' ? 'Reject and email the applicant' : 'Suspend and email the business') + '</button>' +
        '<button class="btn btn-g btn-s" data-cancel>Cancel</button></div></div>';
      $('[data-reason]', box).addEventListener('change', function () {
        var r = REASONS.find(function (x) { return x[0] === this.value; }, this);
        $('[data-why]', box).value = r[1]; $('[data-fix]', box).value = r[2];
      });
      return;
    }
    if (e.target.closest('[data-cancel]')) { e.target.closest('[data-reject-box]').innerHTML = ''; return; }

    var send = e.target.closest('[data-send]');
    if (send) {
      var sid = send.getAttribute('data-send'), sto = send.getAttribute('data-to'), b = send.closest('.reject');
      var reason = $('[data-why]', b).value.trim(), fix = $('[data-fix]', b).value.trim();
      if (reason.length < 10 || fix.length < 10) { alert('Describe the issue and how to fix it. The applicant receives both.'); return; }
      send.disabled = true;
      var sfrom = findRow(sid)[0];
      // reason and fix are saved first, so the status email (sent by the database trigger) includes them
      sb.from(T('listings')).update({ reject_reason: reason, reject_fix: fix }).eq('id', sid).then(function (r1) {
        if (r1.error) throw r1.error;
        var p = { status: sto, reviewed_at: new Date().toISOString(), reject_reason: reason, reject_fix: fix };
        return sb.from(T('listings')).update({ status: sto, reviewed_at: p.reviewed_at }).eq('id', sid).then(function (r2) {
          if (r2.error) throw r2.error;
          move(sid, sfrom, sto, p);
        });
      }).catch(function (err) {
        send.disabled = false;
        alert('Did not save: ' + (err.message || err) + (/reject_reason|column/i.test(err.message || '') ? '\n\nRun supabase/schema.sql in Supabase first.' : ''));
      });
      return;
    }

    // save tier and checks on an approved listing
    var save = e.target.closest('[data-save]');
    if (save) {
      var body = save.closest('.verify__body'), out = $('.verify__msg', body), patch2 = {}, ticked = [];
      $$('[data-ck]', body).forEach(function (cb) { patch2[cb.getAttribute('data-ck')] = cb.checked; if (cb.checked) ticked.push(cb.getAttribute('data-ck')); });
      var tier = $('[data-tier]', body).value;
      var missing = (REQUIRED[tier] || []).filter(function (k) { return ticked.indexOf(k) === -1; });
      if (missing.length) {
        out.className = 'verify__msg err';
        out.textContent = tierLabel(tier) + ' needs: ' + missing.map(function (k) { return CHECKS.find(function (c) { return c[0] === k; })[1]; }).join(', ');
        return;
      }
      patch2.tier = tier;
      patch2.verified_at = tier === 'none' ? null : new Date().toISOString();
      patch2.sponsored = tier === 'gold';                 // Gold is always advertised
      save.disabled = true; out.className = 'verify__msg'; out.textContent = 'Saving…';
      sb.from(T('listings')).update(patch2).eq('id', save.getAttribute('data-save')).then(function (r) {
        save.disabled = false;
        if (r.error) { out.className = 'verify__msg err'; out.textContent = 'Did not save: ' + r.error.message; return; }
        Object.assign(findRow(save.getAttribute('data-save'))[1], patch2);
        out.className = 'verify__msg ok';
        out.textContent = tierLabel(tier) + ' saved and live.';
      });
    }
  });

  // documents live in a private bucket: short-lived signed links, minted on demand
  queue.addEventListener('toggle', function (e) {
    var det = e.target.closest ? e.target.closest('[data-docs]') : null;
    if (!det || !det.open || det.dataset.loaded) return;
    det.dataset.loaded = '1';
    var pid = det.getAttribute('data-docs'), body = $('.verify__body', det);
    sb.from(T('documents')).select('kind,path,filename').eq('listing_id', pid).is('deleted_at', null).then(function (r) {
      if (r.error || !r.data || !r.data.length) {
        body.innerHTML = '<p style="font-size:.84rem;color:var(--err);margin:0">No documents uploaded. Do not issue a badge for this listing.</p>';
        return;
      }
      Promise.all(r.data.map(function (d) {
        return sb.storage.from('gc-docs').createSignedUrl(d.path, 600).then(function (u) { return { d: d, url: u.data && u.data.signedUrl }; });
      })).then(function (items) {
        var L = { cipc: 'CIPC document', id: 'ID / passport', sars: 'SARS clearance', insurance: 'Insurance certificate' };
        body.innerHTML = items.map(function (it) {
          return '<div class="doc" style="margin-bottom:.4rem"><span class="doc__i"><i class="fa-solid fa-file"></i></span><span class="doc__t"><b>' +
            (L[it.d.kind] || it.d.kind) + '</b><span>' + esc(it.d.filename || '') + '</span></span>' +
            (it.url ? '<a class="btn btn-g btn-s" href="' + it.url + '" target="_blank" rel="noopener">Open</a>' : '<span class="doc__s" style="color:var(--err)">link failed</span>') + '</div>';
        }).join('') + '<p class="hint" style="margin:.4rem 0 0">Links expire in 10 minutes. Delete documents once the check is recorded (POPIA: 90 days).</p>';
      });
    });
  }, true);

  if (LIVE) sb.auth.getSession().then(function (r) { if (r.data && r.data.session) { show('main'); refresh(); offerPasskey(); } else show('login'); });
  else show('login');
})();
