/*! Getclient app.js — a Digitalx Group project.
 *  Uses supabase-js v2 (loaded in the page head, same pattern as the Digitalx
 *  client portal). Every dynamic feature degrades gracefully: with the database
 *  unreachable, the pre-rendered pages stay intact and forms fall back to email.
 */
(function () {
  'use strict';

  var CFG = window.GC_CONFIG || {};
  var URL_ = (CFG.supabaseUrl || '').replace(/\/$/, '');
  var KEY = CFG.supabaseAnonKey || '';
  var PFX = CFG.tablePrefix || 'gc_';
  var sb = null, LIVE = false;

  try {
    if (URL_ && KEY && typeof window.supabase !== 'undefined') {
      sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true } });
      LIVE = true;
    }
  } catch (e) { console.error('Supabase init failed', e); }

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var T = function (n) { return PFX + n; };
  window.GC = { sb: sb, live: LIVE, esc: esc, T: T };

  /* ================================================== navigation */
  $$('.mnav .mi > button').forEach(function (btn) {
    var mi = btn.parentNode;
    function close() { mi.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    function open() {
      $$('.mnav .mi.open').forEach(function (o) {
        o.classList.remove('open');
        var b = $('button', o); if (b) b.setAttribute('aria-expanded', 'false');
      });
      mi.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      mi.classList.contains('open') ? close() : open();
    });
    mi.addEventListener('mouseenter', open);
    mi.addEventListener('mouseleave', close);
    mi.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); btn.focus(); } });
  });
  document.addEventListener('click', function () {
    $$('.mnav .mi.open').forEach(function (o) {
      o.classList.remove('open');
      var b = $('button', o); if (b) b.setAttribute('aria-expanded', 'false');
    });
  });

  var burger = $('#gc-burger'), drawer = $('#gc-drawer');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      drawer.classList.add('on');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
    var close = $('#gc-close');
    if (close) close.addEventListener('click', function () {
      drawer.classList.remove('on');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  }

  /* ================================================== clipboard */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var src = $(btn.getAttribute('data-copy'));
    if (!src) return;
    navigator.clipboard.writeText((src.value !== undefined ? src.value : src.textContent).trim())
      .then(function () {
        var was = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = was; }, 1600);
      });
  });

  /* ================================================== sharing */
  // Delegated, so it works on static profiles and on client-rendered ones alike.
  var nativeShare = !!(navigator.share);
  $$('[data-share-native]').forEach(function (b) { b.hidden = !nativeShare; });

  document.addEventListener('click', function (e) {
    var box = e.target.closest('.share');
    if (!box) return;
    var url = box.getAttribute('data-share-url');
    var text = box.getAttribute('data-share-text');
    var msg = $('.share__msg', box);

    if (e.target.closest('[data-share-native]')) {
      e.preventDefault();
      navigator.share({ title: text, text: text, url: url }).catch(function () {});
      return;
    }
    if (e.target.closest('[data-share-copy]')) {
      e.preventDefault();
      navigator.clipboard.writeText(url).then(function () {
        msg.textContent = 'Link copied.';
        setTimeout(function () { msg.textContent = ''; }, 2200);
      }).catch(function () {
        var i = $('.share__u', box);
        if (i) { i.focus(); i.select(); msg.textContent = 'Press Ctrl+C to copy.'; }
      });
    }
  });

  /* ================================================== stars */
  var STAR_D = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z';
  function starsHTML(v, cls) {
    var n = Math.round(Number(v) || 0), out = '';
    for (var i = 0; i < 5; i++) {
      out += '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="star-' +
        (i < n ? 'on' : 'off') + '" d="' + STAR_D + '"/></svg>';
    }
    return '<span class="' + (cls || 'stars') + '" role="img" aria-label="' + n + ' out of 5 stars">' + out + '</span>';
  }
  function ratingHTML(avg, count) {
    if (!count) return starsHTML(0) + ' <span>Not rated yet</span>';
    return starsHTML(avg) + ' <b>' + Number(avg).toFixed(1) + '</b> <span>(' + count +
      ' rating' + (count === 1 ? '' : 's') + ')</span>';
  }
  function sealSVG(tier, cls) {
    var c = { gold: ['#B8860B', '#E0A32E'], blue: ['#1D6FF2', '#5A9BFF'] }[tier];
    if (!c) return '';
    var pts = '', n = 12;
    for (var i = 0; i < n * 2; i++) {
      var a = (Math.PI / n) * i - Math.PI / 2, r = i % 2 === 0 ? 15.2 : 12.6;
      pts += (16 + r * Math.cos(a)).toFixed(2) + ',' + (16 + r * Math.sin(a)).toFixed(2) + ' ';
    }
    return '<svg class="seal ' + (cls || 'seal--sm') + '" viewBox="0 0 32 32" role="img" aria-label="' +
      (tier === 'gold' ? 'Gold Verified' : 'Blue Verified') + '"><defs><linearGradient id="jd' + tier +
      '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' +
      c[0] + '"/></linearGradient></defs><polygon points="' + pts.trim() + '" fill="url(#jd' + tier + ')"/>' +
      '<path d="M10.6 16.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  window.GC.stars = starsHTML;

  /* a stable anonymous id, so one person rates a business once */
  function raterId() {
    var k = 'gc_rater';
    var v = localStorage.getItem(k);
    if (!v) {
      v = (crypto.randomUUID ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem(k, v);
    }
    return v;
  }

  /* refresh every rating figure on the page from the database */
  function refreshRatings() {
    var nodes = $$('[data-gc-rating]');
    if (!nodes.length || !LIVE) return;
    var ids = nodes.map(function (n) { return n.getAttribute('data-gc-rating'); });
    sb.from(T('ratings_summary')).select('listing_id,avg_rating,rating_count').in('listing_id', ids)
      .then(function (r) {
        if (r.error) return;
        var map = {};
        (r.data || []).forEach(function (row) { map[row.listing_id] = row; });
        nodes.forEach(function (n) {
          var row = map[n.getAttribute('data-gc-rating')];
          if (row) n.innerHTML = ratingHTML(row.avg_rating, row.rating_count);
        });
      });
  }
  refreshRatings();

  /* the rating control on a profile page */
  var rater = $('[data-gc-rater]');
  if (rater) {
    var listingId = rater.getAttribute('data-gc-rater');
    var msg = $('[data-gc-rater-msg]', rater);
    var btns = $$('[data-gc-star]', rater);
    var mine = Number(localStorage.getItem('gc_rated_' + listingId) || 0);

    function paint(n) {
      btns.forEach(function (b, i) {
        $('path', b).setAttribute('class', i < n ? 'star-on' : 'star-off');
      });
    }
    if (mine) {
      paint(mine);
      msg.className = 'rater__msg ok';
      msg.textContent = 'You rated this business ' + mine + ' out of 5. Tap a different star to change it.';
    }
    btns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { paint(i + 1); });
      b.addEventListener('focus', function () { paint(i + 1); });
      b.addEventListener('click', function () { submitRating(i + 1); });
    });
    rater.addEventListener('mouseleave', function () { paint(mine); });

    // The baked listing ID can drift from the database (a row seeded under a
    // different public_id, or a rebuild that has not run yet). If the server says
    // the listing does not exist, resolve the real id from the URL slug once and
    // retry, so a stale page still rates the right business.
    function resolveId() {
      var m = location.pathname.match(/\/b\/([A-Za-z0-9_-]+)\/?$/);
      if (!m) return Promise.resolve(null);
      return sb.from(T('listings_public')).select('id').eq('slug', m[1]).maybeSingle()
        .then(function (r) { return (r.data && r.data.id) || null; })
        .catch(function () { return null; });
    }

    function submitRating(n) {
      if (!LIVE) {
        msg.className = 'rater__msg err';
        msg.textContent = 'Ratings are not connected yet. Check config.js.';
        return;
      }
      paint(n);
      msg.className = 'rater__msg';
      msg.textContent = 'Saving your rating…';
      sb.rpc('gc_rate', { p_listing: listingId, p_stars: n, p_key: raterId() })
        .then(function (r) {
        if (r.error) {
          var why = (r.error.message || '') + ' ' + (r.error.hint || '');
          if (/listing not found/i.test(why) && !submitRating.retried) {
            submitRating.retried = true;
            return resolveId().then(function (realId) {
              if (!realId || realId === listingId) {
                msg.className = 'rater__msg err';
                msg.textContent = 'This listing is not in the ratings database yet, so it cannot be rated.';
                paint(mine);
                return;
              }
              listingId = realId;                       // use the real id from here on
              rater.setAttribute('data-gc-rater', realId);
              submitRating(n);
            });
          }
          msg.className = 'rater__msg err';
          if (/listing not found/i.test(why)) {
            msg.textContent = 'This listing is not in the ratings database yet, so it cannot be rated.';
          } else if (/function .*gc_rate|does not exist|schema cache/i.test(why)) {
            msg.textContent = 'The rating function is missing. Re-run schema.sql in Supabase.';
          } else {
            msg.textContent = 'That did not save: ' + (r.error.message || 'unknown error');
          }
          console.error('[Getclient] rating failed:', r.error);
          paint(mine);
          return;
        }
        mine = n;
        localStorage.setItem('gc_rated_' + listingId, String(n));
        msg.className = 'rater__msg ok';
        msg.textContent = 'Thank you. Your rating of ' + n + ' out of 5 is saved and now shows to everyone.';
        // paint the new average straight from the value the database returned
        var row = (r.data && r.data[0]) || null;
        if (row) {
          $$('[data-gc-rating="' + listingId + '"]').forEach(function (el) {
            el.innerHTML = ratingHTML(row.avg_rating, row.rating_count);
          });
        }
        refreshRatings();
      });
    }
  }

  /* ================================================== listing card */
  // Mirrors card() in src/lib.mjs, so live-rendered cards match the static ones.
  var PROV = {
    'western-cape': 'Western Cape', 'gauteng': 'Gauteng', 'kwazulu-natal': 'KwaZulu-Natal',
    'eastern-cape': 'Eastern Cape', 'free-state': 'Free State', 'limpopo': 'Limpopo',
    'mpumalanga': 'Mpumalanga', 'northern-cape': 'Northern Cape', 'north-west': 'North West'
  };
  var SHADES = ['#1652F0', '#0B2A6F', '#2A64F6', '#123A9C', '#3D7BFF', '#0F40C4'];
  var Y_SVG = '<svg class="y" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<path d="M-80 -60 L470 300 L-80 660 M470 300 H1300" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="170"/>' +
    '<path d="M-80 -60 L470 300 L-80 660 M470 300 H1300" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="3"/></svg>';
  function provName(s) { return PROV[s] || String(s || '').replace(/-/g, ' '); }
  function locText(b) { return [b.city_name, provName(b.province)].filter(Boolean).join(', '); }
  function initials(name) {
    var w = String(name || '').replace(/\(.*?\)|pty|ltd|\b(the|and|of)\b/gi, ' ').trim().split(/[\s&:-]+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase();
  }
  function shade(id) {
    var h = 0, s = String(id);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return SHADES[h % SHADES.length];
  }
  function avatarHTML(b) {
    return '<span class="avatar" style="background:' + shade(b.id) + '" aria-hidden="true">' + esc(initials(b.name)) + '</span>';
  }
  function photoURL(p) { return URL_ + '/storage/v1/object/public/gc-photos/' + p; }
  function listingCard(b) {
    var loc = locText(b);
    var cov = b.cover_photo
      ? '<img src="' + esc(photoURL(b.cover_photo)) + '" alt="" loading="lazy" width="480" height="132">' : Y_SVG;
    return '<article class="listing is-new" data-gc-listing="' + esc(b.id) + '"><div class="listing__cov">' + cov + '</div>' +
      '<div class="listing__tags">' + (b.sponsored ? '<span class="tier tier--ad">Ad</span>' : '') + '</div>' +
      '<div class="listing__body">' + avatarHTML(b) +
      '<a class="listing__nm" href="/b/' + esc(b.slug) + '/">' + esc(b.name) + sealSVG(b.tier) + '</a>' +
      '<div class="listing__mt"><i class="fa-solid fa-location-dot"></i>' + esc(b.subcategory || b.category_name || '') +
      (loc ? ' · ' + esc(loc) : '') + '</div>' +
      '<p class="listing__ds" style="margin-top:.7rem">' + esc(b.tagline || b.description || '') + '</p>' +
      '<div class="listing__ft"><span class="rate" data-gc-rating="' + esc(b.id) + '">' +
      ratingHTML(b.avg_rating, b.rating_count) + '</span>' +
      '<span class="listing__go">View <i class="fa-solid fa-arrow-right"></i></span></div></div></article>';
  }
  Object.assign(window.GC, {
    card: listingCard, seal: sealSVG, rating: ratingHTML, avatar: avatarHTML, provName: provName,
    locText: locText, photoURL: photoURL, ySvg: Y_SVG
  });

  /* ================================================== scroll reveal */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -40px 0px' });
    $$('.rv').forEach(function (n) { io.observe(n); });
  } else { $$('.rv').forEach(function (n) { n.classList.add('in'); }); }

  /* ================================================== search */
  var results = $('#gc-results');
  if (results) {
    var params = new URLSearchParams(location.search);
    var state = { q: params.get('q') || '', cat: params.get('cat') || '', loc: params.get('loc') || '', tier: params.get('tier') || '' };
    $$('#gc-search-form [name]').forEach(function (el) { if (state[el.name] !== undefined) el.value = state[el.name]; });

    function runSearch() {
      results.innerHTML = '<p class="lede">Searching…</p>';
      if (!LIVE) {
        results.innerHTML = '<div class="empty"><h3>Search is not connected</h3>' +
          '<p>Add your Supabase details to config.js. Category and city pages work without it.</p>' +
          '<a class="btn btn-g" href="/categories/">Browse categories</a></div>';
        return;
      }
      var q = sb.from(T('listings_public')).select('*')
        .order('sponsored', { ascending: false })
        .order('tier_rank', { ascending: false })
        .order('avg_rating', { ascending: false, nullsFirst: false })
        .limit(48);
      if (state.cat) q = q.eq('category', state.cat);
      if (state.loc) q = q.eq('city', state.loc);
      if (state.tier) q = q.eq('tier', state.tier);
      if (state.q) q = q.ilike('search_text', '%' + state.q + '%');
      q.then(function (r) {
        var count = $('#gc-count');
        if (r.error) {
          results.innerHTML = '<div class="empty"><h3>Search is temporarily unavailable</h3>' +
            '<p>The directory is still browsable by category and city.</p>' +
            '<a class="btn btn-g" href="/categories/">Browse categories</a></div>';
          return;
        }
        var rows = r.data || [];
        if (count) count.textContent = rows.length + (rows.length === 48 ? '+' : '') + ' businesses';
        if (!rows.length) {
          results.innerHTML = '<div class="empty"><h3>Nothing matched that search</h3>' +
            '<p>Try a broader category or a wider location. If you know a business that should be here, ask them to list.</p>' +
            '<a class="btn btn-p" href="/list/">List a business</a></div>';
          return;
        }
        results.innerHTML = '<div class="grid cards">' + rows.map(listingCard).join('') + '</div>';
      });
    }
    var sform = $('#gc-search-form');
    if (sform) sform.addEventListener('submit', function (e) {
      e.preventDefault();
      $$('[name]', sform).forEach(function (el) { state[el.name] = el.value; });
      var u = new URLSearchParams();
      Object.keys(state).forEach(function (k) { if (state[k]) u.set(k, state[k]); });
      history.replaceState(null, '', '?' + u.toString());
      runSearch();
    });
    runSearch();
  }

  /* ================================================== listing wizard */
  var listForm = $('#gc-list-form');
  if (listForm) {
    var DOCS = {
      cipc: ['CIPC registration document', 'The CoR14.3 or company disclosure certificate'],
      id: ['ID or passport', 'For the contact person named on the listing'],
      sars: ['SARS tax clearance', 'A current tax compliance status pin or certificate'],
      insurance: ['Insurance certificate', 'Public liability or professional indemnity, currently valid']
    };
    var NEEDED = { basic: [], blue: ['cipc', 'id'], gold: ['cipc', 'id', 'sars', 'insurance'] };
    var picked = {};                                  // kind -> File
    var step = 1;

    // /list/?plan=blue (from the pricing page) preselects that tier
    var wanted = new URLSearchParams(location.search).get('plan');
    var wantedEl = wanted && listForm.querySelector('[name=requested_plan][value="' + wanted.replace(/[^a-z]/g, '') + '"]');
    if (wantedEl) wantedEl.checked = true;

    // choosing a city fills in its province
    var cityEl = listForm.querySelector('[name=city]'), provEl = listForm.querySelector('[name=province]');
    if (cityEl && provEl) cityEl.addEventListener('change', function () {
      var o = cityEl.options[cityEl.selectedIndex];
      var p = o && o.getAttribute('data-prov');
      if (p) provEl.value = p;
    });

    function plan() {
      var el = listForm.querySelector('[name=requested_plan]:checked');
      return el ? el.value : 'basic';
    }

    function goto(n) {
      step = n;
      $$('.step-pane', listForm).forEach(function (p) {
        p.hidden = p.getAttribute('data-pane') !== String(n);
      });
      $$('#gc-steps li').forEach(function (li) {
        var k = Number(li.getAttribute('data-step'));
        li.classList.toggle('on', k === n);
        li.classList.toggle('done', k < n);
      });
      window.scrollTo({ top: $('#gc-steps').offsetTop - 90, behavior: 'smooth' });
    }

    /* ---- documents step is built from the chosen tier ---- */
    function buildDocs() {
      var p = plan(), need = NEEDED[p], box = $('#gc-doc-fields');
      var intro = $('#gc-docs-intro');
      $$('[data-req-cipc]').forEach(function (n) { n.hidden = p === 'basic'; });

      if (!need.length) {
        intro.textContent = 'Basic listings need no documents. Continue to the last step.';
        box.innerHTML = '<div class="empty" style="padding:1.6rem"><p style="margin:0">Nothing to upload ' +
          'for a Basic listing. If you upgrade later, we will ask for documents then.</p></div>';
        return;
      }
      intro.textContent = (p === 'gold' ? 'Gold' : 'Blue') + ' Verified needs ' + need.length +
        ' documents. We check these before you are asked to pay, so you are never charged for a check we cannot complete.';
      box.innerHTML = need.map(function (k) {
        return '<div class="doc" data-doc="' + k + '">' +
          '<span class="doc__i">' + (picked[k] ? '✓' : '↑') + '</span>' +
          '<span class="doc__t"><b>' + DOCS[k][0] + ' *</b><span>' + DOCS[k][1] + '</span></span>' +
          '<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-docfile="' + k + '">' +
          '<span class="doc__s"></span></div>';
      }).join('') +
      '<p class="hint" style="margin-top:.4rem">PDF, JPG or PNG. Up to 10&nbsp;MB each.</p>';

      $$('[data-docfile]', box).forEach(function (inp) {
        var k = inp.getAttribute('data-docfile');
        if (picked[k]) markDoc(k, picked[k].name);
        inp.addEventListener('change', function () {
          var f = inp.files[0];
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) {
            alert('That file is larger than 10 MB. Please compress it and try again.');
            inp.value = ''; return;
          }
          picked[k] = f;
          markDoc(k, f.name);
        });
      });
    }
    function markDoc(k, name) {
      var row = document.querySelector('[data-doc="' + k + '"]');
      if (!row) return;
      row.classList.add('ok');
      $('.doc__i', row).textContent = '✓';
      $('.doc__s', row).textContent = name.length > 24 ? name.slice(0, 22) + '…' : name;
    }

    /* ---- validation per step ---- */
    function validate(n) {
      if (n === 2) {
        var missing = [];
        [['name', 'business name'], ['category', 'category'], ['description', 'description'],
         ['city', 'city'], ['province', 'province'], ['founded', 'year established'],
         ['phone', 'phone'], ['email', 'email'], ['contact_name', 'contact person']].forEach(function (f) {
          var el = listForm.querySelector('[name=' + f[0] + ']');
          if (el && !String(el.value || '').trim()) missing.push(f[1]);
        });
        var d = listForm.querySelector('[name=description]');
        if (d && d.value.trim().length && d.value.trim().length < 50) missing.push('a longer description (50+ characters)');
        if (plan() !== 'basic' && !String(listForm.querySelector('[name=cipc]').value || '').trim()) {
          missing.push('CIPC registration number');
        }
        if (missing.length) { alert('Still needed: ' + missing.join(', ') + '.'); return false; }
      }
      if (n === 3) {
        var need = NEEDED[plan()];
        var absent = need.filter(function (k) { return !picked[k]; });
        if (absent.length) {
          alert('Upload these before continuing: ' + absent.map(function (k) { return DOCS[k][0]; }).join(', ') + '.');
          return false;
        }
        if (need.length && !$('#gc-doc-consent').checked) {
          alert('Please tick the consent box so we may process your documents.');
          return false;
        }
      }
      return true;
    }

    /* ---- pricing comes from the server, never from the page ---- */
    var priced = { plan: 'basic', base: 0, amount: 0, discount_pct: 0, code: null };

    function money(cents) {
      return 'R' + (cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fetchPrice(code) {
      var p = plan();
      if (p === 'basic') {
        priced = { plan: 'basic', base: 0, amount: 0, discount_pct: 0, code: null };
        return Promise.resolve({ valid: true });
      }
      return sb.rpc('gc_price', { p_plan: p, p_code: code || null }).then(function (r) {
        var row = (r.data && r.data[0]) || null;
        if (r.error || !row) {
          priced = { plan: p, base: p === 'gold' ? 129900 : 49900, amount: p === 'gold' ? 129900 : 49900,
                     discount_pct: 0, code: null };
          return { valid: false, reason: 'Could not check that code right now.' };
        }
        if (row.valid) {
          priced = { plan: p, base: row.base, amount: row.amount,
                     discount_pct: row.discount_pct, code: row.code };
        }
        return row;
      });
    }

    function buildSummary() {
      var p = plan();
      var need = NEEDED[p];
      var promo = $('#gc-promo-box');
      if (promo) promo.hidden = (p === 'basic');

      fetchPrice(priced.code).then(function () { renderSummary(p, need); });
    }

    function renderSummary(p, need) {
      var name = p === 'basic' ? 'Basic listing' : (p === 'gold' ? 'Gold' : 'Blue') + ' Verified';
      var rows = '';
      if (p === 'basic') {
        rows = '<div class="sum-row"><span>Listing</span><b>Free</b></div>';
      } else {
        rows = '<div class="sum-row"><span>' + name + ', first month</span><span>' + money(priced.base) + '</span></div>';
        if (priced.discount_pct) {
          rows += '<div class="sum-row sum-row--off"><span>Discount ' + esc(priced.code) + ' (' +
            priced.discount_pct + '% off)</span><span>− ' + money(priced.base - priced.amount) + '</span></div>';
        }
        rows += '<div class="sum-row sum-row--tot"><span>Due now</span><span>' + money(priced.amount) + '</span></div>';
      }

      $('#gc-summary').innerHTML =
        '<h3 style="margin-bottom:.7rem">' + name + '</h3>' +
        '<div class="sum-row"><span>Business</span><b>' + esc(listForm.querySelector('[name=name]').value) + '</b></div>' +
        '<div class="sum-row"><span>Documents</span><span>' +
          (need.length ? need.map(function (k) { return DOCS[k][0]; }).join(', ') : 'None required') + '</span></div>' +
        rows +
        (p === 'basic' ? ''
          : priced.amount === 0
            ? '<p class="note" style="margin-top:.9rem">Your code covers the full amount, so there is nothing ' +
              'to pay today. Your documents still go through the same checks before a badge is issued.</p>'
            : '<p class="note" style="margin-top:.9rem">Submitting opens Paystack. Your listing is only sent ' +
              'for review once the payment goes through — nothing is submitted if you close the window.</p>');

      var btn = $('#gc-submit');
      if (btn) {
        btn.textContent = p === 'basic' || priced.amount === 0
          ? 'Submit for review'
          : 'Pay ' + money(priced.amount) + ' and submit';
      }
    }

    /* ---- apply a discount code ---- */
    var promoGo = $('#gc-promo-go');
    if (promoGo) {
      promoGo.addEventListener('click', function () {
        var code = ($('#gc-promo').value || '').trim().toUpperCase();
        var out = $('#gc-promo-msg');
        if (!code) { out.className = 'promo__msg err'; out.textContent = 'Enter a code first.'; return; }
        if (!LIVE) { out.className = 'promo__msg err'; out.textContent = 'Not connected to the database.'; return; }
        promoGo.disabled = true;
        out.className = 'promo__msg'; out.textContent = 'Checking…';
        fetchPrice(code).then(function (row) {
          promoGo.disabled = false;
          if (!row || !row.valid) {
            priced.code = null; priced.discount_pct = 0;
            out.className = 'promo__msg err';
            out.textContent = (row && row.reason) || 'That code cannot be used here.';
          } else {
            out.className = 'promo__msg ok';
            out.textContent = priced.discount_pct === 100
              ? 'Applied. This code covers the full amount.'
              : 'Applied. ' + priced.discount_pct + '% off.';
          }
          renderSummary(plan(), NEEDED[plan()]);
        });
      });
      $('#gc-promo').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); promoGo.click(); }
      });
    }

    listForm.addEventListener('click', function (e) {
      var nx = e.target.closest('[data-next]'), bk = e.target.closest('[data-back]');
      if (nx) {
        var to = Number(nx.getAttribute('data-next'));
        if (!validate(to - 1)) return;
        if (to === 3) buildDocs();
        if (to === 4) buildSummary();
        goto(to);
      }
      if (bk) goto(Number(bk.getAttribute('data-back')));
    });
    $$('[name=requested_plan]', listForm).forEach(function (r) {
      r.addEventListener('change', function () { picked = {}; buildDocs(); });
    });

    /* ---- submit ---- */
    listForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#gc-submit'), out = $('#gc-list-status');
      var data = {};
      new FormData(listForm).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      delete data.photos;
      data.consent_terms = !!listForm.querySelector('[name=consent_terms]').checked;
      data.consent_review = !!listForm.querySelector('[name=consent_review]').checked;
      if (data.founded) data.founded = parseInt(data.founded, 10);
      var thePlan = plan();
      data.requested_plan = thePlan;
      data.docs_complete = NEEDED[thePlan].every(function (k) { return !!picked[k]; });

      // The badge commitment is a page-level declaration only; it is not sent to
      // gc_submit_listing, which whitelists its fields server-side.
      var badgeOk = $('#gc-badge-consent');
      if (!data.consent_terms || !data.consent_review || (badgeOk && !badgeOk.checked)) {
        out.className = 'msg note note--w';
        out.textContent = 'All three declarations need to be ticked before we can review the listing.';
        return;
      }
      if (!LIVE) {
        out.className = 'msg note note--w';
        out.innerHTML = 'The database is not connected. Email the details to ' +
          '<a href="mailto:hello@digitalxagency.io">hello@digitalxagency.io</a>.';
        return;
      }

      var files = ($('#bphotos') && $('#bphotos').files) ? Array.prototype.slice.call($('#bphotos').files, 0, 6) : [];
      btn.disabled = true;
      out.className = 'msg note';

      // Price is re-read from the server at the moment of submission, so a code
      // edited in the page cannot change what is charged.
      fetchPrice(priced.code).then(function () {
        data.discount_code = priced.code || null;

        if (thePlan === 'basic' || priced.amount === 0) {
          // free, or a code covering the whole amount: nothing to charge
          out.textContent = 'Saving your listing…';
          return saveListing(null);
        }

        if (!window.GCPay || typeof window.PaystackPop === 'undefined') {
          btn.disabled = false;
          out.className = 'msg note note--w';
          out.textContent = 'The payment window could not load. Check your connection, or call 021 879 3035.';
          return;
        }

        // Payment first. The listing is only created once Paystack confirms.
        out.textContent = 'Opening secure payment…';
        window.GCPay({
          plan: thePlan, amount: priced.amount, code: priced.code,
          email: data.email, name: data.name,
          onDone: function (reference) {
            out.className = 'msg note';
            out.textContent = 'Payment received. Saving your listing…';
            saveListing(reference);
          },
          onClose: function () {
            btn.disabled = false;
            out.className = 'msg note note--w';
            out.textContent = 'Payment window closed, so nothing was charged and nothing was submitted. ' +
              'Your details are still here — press the button again when you are ready.';
          }
        });
      });

      function saveListing(reference) {
        // One controlled entry point. It whitelists fields server-side and returns
        // the new public_id, which a plain insert cannot do without exposing
        // pending rows to a SELECT policy.
        return sb.rpc('gc_submit_listing', { p: data }).then(function (r) {
          if (!r.error && (!r.data || !r.data.length)) {
            r = { error: { message: 'The submission did not come back with a listing ID.' } };
          }
          if (r.error) {
            btn.disabled = false;
            out.className = 'msg note note--w';
            var why = r.error.message || 'check the required fields';
            if (/row-level security|permission denied/i.test(why)) {
              why = 'the database is rejecting new listings. Re-run schema.sql in Supabase — ' +
                    'the submission function is missing';
            } else if (/function .*gc_submit_listing|schema cache/i.test(why)) {
              why = 'the submission function is not installed yet. Re-run schema.sql in Supabase';
            }
            out.textContent = 'That did not save: ' + why +
              '. ' + (reference ? 'Your payment went through (ref ' + reference + ') — email ' +
              'hello@digitalxagency.io with that reference and we will finish it by hand.'
              : 'You can also email hello@digitalxagency.io.');
            return;
          }
          var listing = r.data[0];

          // tie the payment to the listing now that it has an id
          if (reference) {
            sb.rpc('gc_attach_payment', { p_reference: reference, p_listing: listing.public_id })
              .then(function () {});
          }

          out.textContent = 'Uploading documents…';
          return uploadDocs(listing.public_id)
            .then(function () { return uploadPhotos(listing.public_id, files, out); })
            .then(function () {
              btn.disabled = false;
              finish(listing, !!reference || priced.amount === 0 && thePlan !== 'basic');
            });
        });
      }

      function finish(listing, paid) {
        listForm.hidden = true;
        $('#gc-steps').hidden = true;
        var done = $('#gc-list-done');
        var idOut = $('#gc-done-id');
        if (idOut) idOut.textContent = listing.public_id;
        var code = $('#gc-done-code');
        if (code) code.textContent = '<!-- Listed on Getclient badge -->\n<script src="https://getclient.co.za/badge.js" data-gc-id="' +
          listing.public_id + '" async><\/script>';
        var more = $('#gc-done-more');
        if (more) more.href = '/badge/?id=' + encodeURIComponent(listing.public_id);
        if (paid) { var pd = $('#gc-done-paid'); if (pd) pd.hidden = false; }
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      function uploadDocs(publicId) {
        var kinds = Object.keys(picked);
        if (!kinds.length) return Promise.resolve();
        return Promise.all(kinds.map(function (k) {
          var f = picked[k];
          var ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
          var path = publicId + '/' + k + '-' + Date.now() + '.' + ext;
          return sb.storage.from('gc-docs').upload(path, f, { upsert: false }).then(function (u) {
            if (u.error) { console.error('doc upload failed', u.error); return; }
            return sb.from(T('documents')).insert({
              listing_id: publicId, kind: k, path: path, filename: f.name
            });
          });
        })).catch(function () {});
      }

      function uploadPhotos(publicId, files, out) {
        if (!files.length) return Promise.resolve();
        out.textContent = 'Uploading photos…';
        return Promise.all(files.map(function (file, i) {
          if (file.size > 5 * 1024 * 1024) return Promise.resolve();
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          var path = publicId + '/' + Date.now() + '-' + i + '.' + ext;
          return sb.storage.from('gc-photos').upload(path, file, { cacheControl: '31536000' })
            .then(function (u) {
              if (u.error) return;
              return sb.from(T('photos')).insert({ listing_id: publicId, path: path, sort: i });
            });
        })).catch(function () {});
      }
    });

    /* photo thumbnails */
    var photoIn = $('#bphotos');
    if (photoIn) {
      photoIn.addEventListener('change', function () {
        var box = $('#gc-photo-preview');
        box.innerHTML = '';
        Array.prototype.slice.call(photoIn.files, 0, 6).forEach(function (f) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          img.alt = '';
          img.onload = function () { URL.revokeObjectURL(img.src); };
          box.appendChild(img);
        });
      });
    }

    buildDocs();
  }

  /* ================================================== quote requests */
  var quoteForm = $('#gc-quote-form');
  if (quoteForm) {
    quoteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = $('#gc-quote-status'), data = {};
      new FormData(quoteForm).forEach(function (v, k) { data[k] = v; });
      if (!LIVE) {
        location.href = 'mailto:' + (quoteForm.getAttribute('data-email') || 'hello@digitalxagency.io') +
          '?subject=' + encodeURIComponent('Quote request via Getclient') +
          '&body=' + encodeURIComponent(Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n'));
        return;
      }
      out.className = 'msg note'; out.textContent = 'Sending your request…';
      sb.from(T('quotes')).insert(data).then(function (r) {
        if (r.error) {
          out.className = 'msg note note--w';
          out.textContent = 'That did not send. Use the phone number above, or WhatsApp us on 021 879 3035.';
          return;
        }
        quoteForm.reset();
        out.className = 'msg note';
        out.textContent = 'Request sent. Getclient tracks whether the business replies.';
      });
    });
  }

  /* ================================================== badge builder */
  var bb = $('#gc-badge-builder');
  if (bb) {
    var el = {
      id: $('#bb-id'), name: $('#bb-name'), tier: $('#bb-tier'), slug: $('#bb-slug'),
      theme: $('#bb-theme'), size: $('#bb-size'), layout: $('#bb-layout'), find: $('#bb-find'), list: $('#bb-suggest')
    };
    var BADGE_W = { 'listed-light': 148, 'listed-dark': 148, 'blue-light': 169, 'blue-dark': 169, 'gold-light': 169, 'gold-dark': 169 };
    var previewHost = document.createElement('span');
    $('#bb-preview').appendChild(previewHost);

    function build() {
      var id = (el.id.value || 'gc-000000').trim(), name = (el.name.value || 'Your Business').trim();
      var tier = el.tier.value, theme = el.theme.value, size = el.size.value, layout = el.layout.value;
      var slug = (el.slug.value || '').trim();
      var label = tier === 'gold' ? 'Gold Verified' : tier === 'blue' ? 'Blue Verified' : '';
      var url = 'https://getclient.co.za/b/' + (slug || id) + '/';
      var img = (tier === 'none' ? 'listed' : tier) + '-' + theme;
      var alt = 'Listed on Getclient' + (label ? ' — ' + label : '');
      var title = name + ' is listed on Getclient' + (label ? ', ' + label : '');

      if (window.GetclientBadge) {
        window.GetclientBadge.mount(previewHost, { id: id, theme: theme, size: size, layout: 'inline' },
          { tier: tier, name: name, url: '/b/' + (slug || id) + '/' });
      }
      $('#bb-stage').classList.toggle('stage--d', theme === 'dark');
      $('#bb-preview-note').textContent = layout === 'inline' ? 'Live preview'
        : 'Live preview. On your site it floats in the bottom ' + (layout === 'float-bl' ? 'left' : 'right') + ' corner.';

      $('#bb-code-script').textContent =
        '<!-- Listed on Getclient badge -->\n<script src="https://getclient.co.za/badge.js" data-gc-id="' + id + '"' +
        (theme !== 'light' ? ' data-gc-theme="' + theme + '"' : '') +
        (size !== 'default' ? ' data-gc-size="' + size + '"' : '') +
        (layout !== 'inline' ? ' data-gc-layout="' + layout + '"' : '') + ' async><\/script>';

      $('#bb-code-html').textContent =
        '<!-- Listed on Getclient badge (no JavaScript) -->\n' +
        '<a href="' + url + '" target="_blank" rel="nofollow noopener" title="' + esc(title) + '">\n' +
        '  <img src="https://getclient.co.za/assets/badge/' + img + '.svg" alt="' + alt + '" width="' + BADGE_W[img] +
        '" height="52" style="border:0;vertical-align:middle">\n</a>';

      $('#bb-code-email').textContent =
        '<a href="' + url + '" target="_blank" style="text-decoration:none">' +
        '<img src="https://getclient.co.za/assets/badge/' + img + '.png" alt="' + alt + '" width="' + Math.round(BADGE_W[img] * 0.8) +
        '" height="42" style="display:block;border:0"></a>';

      $('#bb-code-link').textContent = url;
    }

    function choose(b) {
      el.id.value = b.id; el.name.value = b.name; el.slug.value = b.slug || '';
      el.tier.value = b.tier === 'gold' || b.tier === 'blue' ? b.tier : 'none';
      el.find.value = b.name;
      el.list.classList.remove('on');
      build();
    }

    // look a business up by name, or arrive with ?id=gc-123456 from a profile
    var timer = null;
    el.find.addEventListener('input', function () {
      clearTimeout(timer);
      var q = el.find.value.trim();
      if (q.length < 2 || !LIVE) { el.list.classList.remove('on'); return; }
      timer = setTimeout(function () {
        sb.from(T('listings_public')).select('id,slug,name,tier,city_name').ilike('name', '%' + q + '%').limit(8)
          .then(function (r) {
            var rows = (r && r.data) || [];
            el.list.innerHTML = rows.length ? rows.map(function (b, i) {
              return '<button type="button" role="option" data-i="' + i + '">' + esc(b.name) + '<small>' + esc(b.city_name || '') + ' · ' + esc(b.id) + '</small></button>';
            }).join('') : '<button type="button" disabled>No listing by that name yet. <a href="/list/">List it free</a></button>';
            el.list.classList.add('on');
            $$('[data-i]', el.list).forEach(function (btn) {
              btn.addEventListener('click', function () { choose(rows[Number(btn.getAttribute('data-i'))]); });
            });
          });
      }, 200);
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.suggest')) el.list.classList.remove('on'); });

    var pre = new URLSearchParams(location.search).get('id');
    if (pre && LIVE) {
      sb.from(T('listings_public')).select('id,slug,name,tier').eq('id', pre).maybeSingle()
        .then(function (r) { if (r && r.data) choose(r.data); else { el.id.value = pre; build(); } });
    }
    el.id.addEventListener('input', function () { el.slug.value = ''; });

    $$('#gc-badge-builder input, #gc-badge-builder select').forEach(function (n) {
      if (n === el.find) return;
      n.addEventListener('input', build); n.addEventListener('change', build);
    });
    if (window.GetclientBadge) build();
    else {
      var s = document.createElement('script');
      s.src = '/badge.js'; s.onload = build; s.onerror = build;
      document.head.appendChild(s);
    }
  }

  /* ================================================== admin queue */
  var admin = $('#gc-admin');
  if (admin) {
    var queue = $('#gc-queue'), loginBox = $('#gc-login');
    var CHECKS = [
      ['check_identity', 'Identity'], ['check_cipc', 'CIPC registration'],
      ['check_insurance', 'Insurance'], ['check_trading_history', 'Trading history'],
      ['check_reviews', 'Client ratings']
    ];
    // A tier may only be set once the checks behind it are actually ticked.
    // This is the whole product promise, so the panel enforces it rather than
    // trusting whoever is clicking.
    var REQUIRED = {
      none: [],
      blue: ['check_identity', 'check_cipc'],
      gold: ['check_identity', 'check_cipc', 'check_insurance', 'check_trading_history', 'check_reviews']
    };

    function show(v) { loginBox.hidden = v === 'queue'; $('#gc-admin-main').hidden = v !== 'queue'; }

    $('#gc-login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = $('#gc-login-msg');
      if (!LIVE) { m.textContent = 'Connect Supabase in config.js first.'; return; }
      m.textContent = 'Signing in…';
      sb.auth.signInWithPassword({ email: $('#gc-email').value, password: $('#gc-password').value })
        .then(function (r) {
          if (r.error) { m.textContent = 'Those credentials did not work.'; return; }
          show('queue'); load('pending');
        });
    });

    function tierBadge(t) {
      return '<span class="tier tier--' + (t || 'none') + '">' +
        (t === 'gold' ? 'Gold Verified' : t === 'blue' ? 'Blue Verified' : 'Basic') + '</span>';
    }

    // Documents are in a private bucket, so each link is a short-lived signed URL
    // minted on demand for the signed-in reviewer. Nothing is ever public.
    function docsBlock(x) {
      if (!x.requested_plan || x.requested_plan === 'basic') return '';
      return '<details class="verify" data-docs="' + esc(x.public_id) + '">' +
        '<summary>Documents' + (x.docs_complete ? ' ✓' : ' — incomplete') + '</summary>' +
        '<div class="verify__body"><p class="lede" style="font-size:.82rem">Loading…</p></div></details>';
    }

    function openDocs(det) {
      var pid = det.getAttribute('data-docs');
      var body = $('.verify__body', det);
      if (det.dataset.loaded) return;
      det.dataset.loaded = '1';
      sb.from(T('documents')).select('kind,path,filename,uploaded_at').eq('listing_id', pid)
        .is('deleted_at', null).then(function (r) {
          if (r.error || !r.data || !r.data.length) {
            body.innerHTML = '<p style="font-size:.84rem;color:var(--err);margin:0">No documents uploaded. ' +
              'Do not issue a badge for this listing.</p>';
            return;
          }
          Promise.all(r.data.map(function (d) {
            return sb.storage.from('gc-docs').createSignedUrl(d.path, 600).then(function (u) {
              return { d: d, url: (u.data && u.data.signedUrl) || null };
            });
          })).then(function (items) {
            body.innerHTML = items.map(function (it) {
              var label = { cipc: 'CIPC document', id: 'ID / passport', sars: 'SARS clearance',
                            insurance: 'Insurance certificate' }[it.d.kind] || it.d.kind;
              return '<div class="doc" style="margin-bottom:.4rem">' +
                '<span class="doc__i">📄</span><span class="doc__t"><b>' + label + '</b><span>' +
                esc(it.d.filename || '') + '</span></span>' +
                (it.url ? '<a class="btn btn-g btn-s" href="' + it.url + '" target="_blank" rel="noopener">Open</a>'
                        : '<span class="doc__s" style="color:var(--err)">link failed</span>') + '</div>';
            }).join('') +
            '<p style="font-size:.72rem;color:var(--mut2);margin:.5rem 0 0">Links expire in 10 minutes. ' +
            'Delete documents once the check is recorded — POPIA retention is 90 days.</p>' +
            '<button class="btn btn-g btn-s" data-purge="' + esc(pid) + '" style="margin-top:.5rem">' +
            'Delete documents</button>';
          });
        });
    }

    function rowHTML(x, status) {
      var checks = CHECKS.map(function (c) {
        return '<label class="chk" style="font-size:.82rem"><input type="checkbox" data-ck="' + c[0] +
          '"' + (x[c[0]] ? ' checked' : '') + '><span>' + c[1] + '</span></label>';
      }).join('');

      var verify = status === 'approved'
        ? '<details class="verify"><summary>Set verification tier</summary>' +
            '<div class="verify__body" data-vid="' + x.id + '">' +
            '<div class="verify__checks">' + checks + '</div>' +
            '<div class="verify__foot">' +
            '<label style="font-size:.78rem;font-weight:600;color:var(--mut)">Tier' +
            '<select data-tier style="margin-left:.5rem">' +
            ['none', 'blue', 'gold'].map(function (t) {
              return '<option value="' + t + '"' + (x.tier === t ? ' selected' : '') + '>' +
                (t === 'none' ? 'Basic (no badge)' : t === 'blue' ? 'Blue Verified' : 'Gold Verified') + '</option>';
            }).join('') + '</select></label>' +
            '<button class="btn btn-p btn-s" data-save="' + x.id + '">Save verification</button>' +
            '<span class="verify__msg"></span></div>' +
            '<p style="font-size:.74rem;color:var(--mut2);margin:.6rem 0 0">' +
            'Blue needs identity + CIPC. Gold needs all five. Saving stamps today\'s date and the badge ' +
            'goes live on the listing and on their website within minutes.</p>' +
            '</div></details>'
        : '';

      var actions = status === 'pending'
        ? '<button class="btn btn-p btn-s" data-act="approved" data-id="' + x.id + '">Approve</button> ' +
          '<button class="btn btn-g btn-s" data-act="rejected" data-id="' + x.id + '">Reject</button>'
        : status === 'approved'
          ? '<a class="btn btn-g btn-s" href="/b/' + esc(x.slug || '') + '/" target="_blank">View</a> ' +
            '<button class="btn btn-g btn-s" data-act="suspended" data-id="' + x.id + '">Suspend</button>'
          : '<button class="btn btn-p btn-s" data-act="approved" data-id="' + x.id + '">Approve</button>';

      return '<tr><td><strong>' + esc(x.name) + '</strong> ' + tierBadge(x.tier) +
        '<br><span class="listing__mt">' + esc(x.email || '') + ' · ' + esc(x.phone || '') + '</span>' +
        '<br><span class="listing__mt">CIPC: ' + esc(x.cipc || '—') + ' · ID: ' + esc(x.public_id || '') + '</span>' +
        docsBlock(x) + verify + '</td>' +
        '<td>' + esc(x.category || '') + '</td><td>' + esc(x.city || '') + '</td>' +
        '<td>' + esc(x.requested_plan || 'basic') +
        (x.paid_plan ? '<br><span class="listing__mt" style="color:var(--grn)">paid: ' + esc(x.paid_plan) + '</span>' : '') +
        '</td><td>' + new Date(x.created_at).toLocaleDateString('en-ZA') + '</td>' +
        '<td>' + actions + '</td></tr>';
    }

    function load(status) {
      queue.innerHTML = '<p class="lede">Loading…</p>';
      sb.from(T('listings')).select('*').eq('status', status).order('created_at', { ascending: false })
        .then(function (r) {
          if (r.error) {
            queue.innerHTML = '<div class="empty"><h3>Could not load the queue</h3>' +
              '<p>Your session may have expired, or this account is not in gc_admins.</p></div>';
            return;
          }
          var rows = r.data || [];
          if (!rows.length) {
            queue.innerHTML = '<div class="empty"><h3>Nothing here</h3><p>No ' + status + ' listings right now.</p></div>';
            return;
          }
          queue.innerHTML = '<div class="scroller"><table class="table"><thead><tr><th>Business</th>' +
            '<th>Category</th><th>City</th><th>Plan</th><th>Added</th><th>Action</th></tr></thead><tbody>' +
            rows.map(function (x) { return rowHTML(x, status); }).join('') + '</tbody></table></div>';
        });
    }

    admin.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-status]');
      if (tab) {
        $$('[data-status]').forEach(function (t) { t.classList.remove('on'); });
        tab.classList.add('on'); load(tab.getAttribute('data-status')); return;
      }

      // ---- save verification tier + checks ----
      var save = e.target.closest('[data-save]');
      if (save) {
        var body = save.closest('.verify__body');
        var out = $('.verify__msg', body);
        var patch = {}, ticked = [];
        $$('[data-ck]', body).forEach(function (cb) {
          patch[cb.getAttribute('data-ck')] = cb.checked;
          if (cb.checked) ticked.push(cb.getAttribute('data-ck'));
        });
        var tier = $('[data-tier]', body).value;
        var missing = (REQUIRED[tier] || []).filter(function (k) { return ticked.indexOf(k) === -1; });
        if (missing.length) {
          out.className = 'verify__msg err';
          out.textContent = tier.toUpperCase() + ' needs: ' + missing.map(function (k) {
            return (CHECKS.filter(function (c) { return c[0] === k; })[0] || [, k])[1];
          }).join(', ');
          return;
        }
        patch.tier = tier;
        patch.verified_at = tier === 'none' ? null : new Date().toISOString();
        save.disabled = true;
        out.className = 'verify__msg';
        out.textContent = 'Saving…';
        sb.from(T('listings')).update(patch).eq('id', save.getAttribute('data-save')).then(function (r) {
          save.disabled = false;
          if (r.error) {
            out.className = 'verify__msg err';
            out.textContent = 'Did not save: ' + (r.error.message || 'unknown error');
            return;
          }
          out.className = 'verify__msg ok';
          out.textContent = tier === 'none'
            ? 'Badge set to Listed. Their website badge shows Listed on Getclient within the hour.'
            : (tier === 'gold' ? 'Gold' : 'Blue') + ' Verified saved and live.';
          var badge = body.closest('td').querySelector('.tier');
          if (badge) {
            badge.className = 'tier tier--' + tier;
            badge.textContent = tier === 'gold' ? 'Gold Verified' : tier === 'blue' ? 'Blue Verified' : 'Basic';
          }
        });
        return;
      }

      // ---- approve straight to the tier they paid for ----
      var issue = e.target.closest('[data-issue]');
      if (issue) {
        var tier = issue.getAttribute('data-tier');
        var det = issue.closest('tr').querySelector('[data-docs]');
        if (!det || !det.dataset.loaded) {
          alert('Open the Documents panel and check every document before issuing a badge.');
          if (det) { det.open = true; openDocs(det); }
          return;
        }
        if (!confirm('Issue ' + tier.toUpperCase() + ' Verified?\n\nOnly continue if you have opened every ' +
                     'document and confirmed the CIPC number on the register. This badge is a public claim.')) return;
        var patch = {
          status: 'approved', reviewed_at: new Date().toISOString(), tier: tier,
          check_identity: true, check_cipc: true, verified_at: new Date().toISOString()
        };
        if (tier === 'gold') {
          patch.check_insurance = true;
          patch.check_trading_history = true;
        }
        issue.disabled = true;
        sb.from(T('listings')).update(patch).eq('id', issue.getAttribute('data-issue')).then(function (r) {
          if (r.error) { issue.disabled = false; alert('Could not save: ' + r.error.message); return; }
          issue.closest('tr').remove();
        });
        return;
      }

      // ---- purge documents after verification ----
      var purge = e.target.closest('[data-purge]');
      if (purge) {
        if (!confirm('Permanently delete the uploaded documents for this listing?')) return;
        var pid2 = purge.getAttribute('data-purge');
        purge.disabled = true;
        sb.from(T('documents')).select('path').eq('listing_id', pid2).then(function (r) {
          var paths = (r.data || []).map(function (d) { return d.path; });
          return sb.storage.from('gc-docs').remove(paths).then(function () {
            return sb.from(T('documents')).update({ deleted_at: new Date().toISOString() }).eq('listing_id', pid2);
          });
        }).then(function () { purge.textContent = 'Documents deleted'; });
        return;
      }

      var act = e.target.closest('[data-act]');
      if (!act) return;
      act.disabled = true;
      sb.from(T('listings')).update({
        status: act.getAttribute('data-act'), reviewed_at: new Date().toISOString()
      }).eq('id', act.getAttribute('data-id'))
        .then(function (r) { r.error ? (act.disabled = false) : act.closest('tr').remove(); });
    });

    admin.addEventListener('toggle', function (e) {
      var det = e.target.closest ? e.target.closest('[data-docs]') : null;
      if (det && det.open) openDocs(det);
    }, true);

    if (LIVE) {
      sb.auth.getSession().then(function (r) {
        r.data && r.data.session ? (show('queue'), load('pending')) : show('login');
      });
    } else { show('login'); }
  }

  /* ================================================== PWA */
  if ('serviceWorker' in navigator) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        // Take a new version the moment it is available rather than waiting for
        // every tab to close. Without this a returning visitor can keep running
        // an old build's JavaScript indefinitely.
        if (reg.waiting) reg.waiting.postMessage('skip-waiting');
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('skip-waiting');
            }
          });
        });
        reg.update();
      }).catch(function () {});

      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloaded) return;           // guard against a reload loop
        reloaded = true;
        location.reload();
      });
    });
  }
  var deferred = null, bar = $('#gc-install');
  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (bar && !localStorage.getItem('gc_install_dismissed')) bar.classList.add('on');
  });
  if (bar) {
    var go = $('#gc-install-go'), x = $('#gc-install-x');
    go.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; bar.classList.remove('on'); });
    });
    x.addEventListener('click', function () {
      bar.classList.remove('on');
      localStorage.setItem('gc_install_dismissed', '1');
    });
  }
  addEventListener('appinstalled', function () { if (bar) bar.classList.remove('on'); });
})();
