/*! Getclient live.js — makes the static directory behave like a live one.
 *
 *  Three jobs:
 *   1. Hydration — a listing approved since the last build appears on its
 *      category, city, province and home pages straight away; a listing that has
 *      since been removed disappears. The next build bakes it in for search engines.
 *   2. Dynamic profiles — /b/<slug>/ (or /b/<listing id>/) with no static page
 *      falls through to b/profile.html, which renders the listing client-side.
 *   3. Photos and payment — gallery rendering, and the Paystack handoff for
 *      paid plans.
 */
(function () {
  'use strict';

  var G = window.GC || {};
  var sb = G.sb, LIVE = G.live, esc = G.esc, T = G.T;
  var CFG = window.GC_CONFIG || {};
  if (!LIVE) return;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var STAR_D = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z';
  var ratingHTML = G.rating, sealSVG = G.seal;
  function photoURL(path) { return G.photoURL(path); }

  var SHARE = [
    ['whatsapp', 'fa-brands fa-whatsapp', 'https://wa.me/?text={t}%20{u}'],
    ['facebook', 'fa-brands fa-facebook-f', 'https://www.facebook.com/sharer/sharer.php?u={u}'],
    ['x', 'fa-brands fa-x-twitter', 'https://x.com/intent/tweet?text={t}&url={u}'],
    ['linkedin', 'fa-brands fa-linkedin-in', 'https://www.linkedin.com/sharing/share-offsite/?url={u}'],
    ['email', 'fa-solid fa-envelope', 'mailto:?subject={t}&body={u}']
  ];
  function shareHTML(b) {
    var url = 'https://getclient.co.za/b/' + b.slug + '/';
    var label = b.tier === 'gold' ? 'Gold Verified' : b.tier === 'blue' ? 'Blue Verified' : 'listed';
    var text = b.name + ' is ' + label + ' on Getclient';
    var u = encodeURIComponent(url), t = encodeURIComponent(text);
    var btns = SHARE.map(function (s) {
      return '<a class="share__b share__b--' + s[0] + '" target="_blank" rel="noopener nofollow" ' +
        'aria-label="Share on ' + s[0] + '" href="' + s[2].replace('{u}', u).replace('{t}', t) +
        '"><i class="' + s[1] + '"></i></a>';
    }).join('');
    return '<div class="share" data-share-url="' + esc(url) + '" data-share-text="' + esc(text) + '">' +
      '<span class="share__l">Share this business</span><div class="share__row">' +
      (navigator.share ? '<button type="button" class="share__b share__b--native" data-share-native ' +
        'aria-label="Share"><i class="fa-solid fa-share-nodes"></i></button>' : '') +
      btns + '<button type="button" class="share__b share__b--copy" data-share-copy aria-label="Copy link">' +
      '<i class="fa-solid fa-link"></i></button></div>' +
      '<input class="share__u" value="' + esc(url) + '" readonly onfocus="this.select()">' +
      '<span class="share__msg" role="status"></span></div>';
  }

  /* ============================================ 1. hydrate listing grids */
  var body = document.body;
  var page = body.getAttribute('data-gc-page') || '';
  var pageCat = body.getAttribute('data-gc-cat') || '';
  var pageCity = body.getAttribute('data-gc-city') || '';
  var pageProv = body.getAttribute('data-gc-prov') || '';
  var built = Date.parse(body.getAttribute('data-gc-built') || '') || 0;
  var host = $('[data-gc-hydrate]');
  var LIMIT = 500;

  if (host && (pageCat || pageCity || pageProv || page === 'home')) {
    var q = sb.from(T('listings_public')).select('*')
      .order('sponsored', { ascending: false })
      .order('tier_rank', { ascending: false })
      .limit(LIMIT);
    if (pageCat) q = q.eq('category', pageCat);
    if (pageCity) q = q.eq('city', pageCity);
    if (pageProv) q = q.eq('province', pageProv);

    q.then(function (r) {
      if (r.error || !r.data) return;
      var live = {};
      r.data.forEach(function (b) { live[b.id] = b; });

      // drop cards for listings that have been suspended or removed since the build
      if (r.data.length < LIMIT) {
        $$('[data-gc-listing]', host).forEach(function (n) {
          if (!live[n.getAttribute('data-gc-listing')]) n.remove();
        });
      }
      var already = {};
      $$('[data-gc-listing]', host).forEach(function (n) { already[n.getAttribute('data-gc-listing')] = 1; });
      // only listings approved after this page was built; the home page shows a selection, not everything
      var fresh = r.data.filter(function (b) {
        return !already[b.id] && (page !== 'home' || (built && Date.parse(b.created_at) > built));
      });
      if (!fresh.length) return;

      var grid = $('.grid', host);
      if (!grid) {                       // the page was in its empty state
        host.innerHTML = '<div class="grid cards"></div>';
        grid = $('.grid', host);
      }
      grid.insertAdjacentHTML('afterbegin', fresh.map(G.card).join(''));
      var note = $('[data-gc-count]');
      if (note) note.textContent = $$('[data-gc-listing]', host).length;
    });
  }

  /* ============================ 1b. real counts, straight from the database */
  (function counts() {
    var needs = $$('[data-gc-n-cat],[data-gc-n-city],[data-gc-n-pair],[data-gc-n-prov],[data-gc-headline],[data-gc-total]');
    if (!needs.length) return;

    sb.from(T('listings_public')).select('category,city,province,tier').limit(5000).then(function (r) {
      if (r.error || !r.data) return;           // keep the build-time figures
      var rows = r.data, cat = {}, city = {}, pair = {}, prov = {}, gold = 0, blue = 0;
      rows.forEach(function (b) {
        cat[b.category] = (cat[b.category] || 0) + 1;
        city[b.city] = (city[b.city] || 0) + 1;
        pair[b.category + '|' + b.city] = (pair[b.category + '|' + b.city] || 0) + 1;
        if (b.province) prov[b.province] = (prov[b.province] || 0) + 1;
        if (b.tier === 'gold') gold++;
        if (b.tier === 'blue') blue++;
      });
      function set(sel, attr, map) {
        $$(sel).forEach(function (n) { n.textContent = map[n.getAttribute(attr)] || 0; });
      }
      set('[data-gc-n-cat]', 'data-gc-n-cat', cat);
      set('[data-gc-n-city]', 'data-gc-n-city', city);
      set('[data-gc-n-pair]', 'data-gc-n-pair', pair);
      set('[data-gc-n-prov]', 'data-gc-n-prov', prov);

      var total = rows.length, np = Object.keys(prov).length;
      $$('[data-gc-total]').forEach(function (n) { n.textContent = total; });
      $$('[data-gc-provinces]').forEach(function (n) { n.textContent = np; });
      $$('[data-gc-gold]').forEach(function (n) { n.textContent = gold; });
      $$('[data-gc-blue]').forEach(function (n) { n.textContent = blue; });
      var h = $('[data-gc-headline]');
      if (h) h.textContent = total === 0 ? 'The first listings are being reviewed'
        : total + ' business' + (total === 1 ? '' : 'es') + ', every one checked';
    });
  })();

  /* ============================================ 2. dynamic profile */
  var dyn = $('#gc-dyn-profile');
  if (dyn) {
    // Apache rewrites /b/<slug>/ to this page internally, so the browser URL is
    // still /b/<slug>/ and ?slug= is never visible here. Read the path first.
    var m = location.pathname.match(/\/b\/([A-Za-z0-9_-]+)\/?$/);
    var slug = (m && m[1] !== 'profile' ? m[1] : '') ||
               new URLSearchParams(location.search).get('slug') || '';
    function miss(h, p) {
      dyn.innerHTML = '<section class="ph"><div class="wrap" style="max-width:640px;text-align:center;padding:3rem 20px">' +
        '<h1>' + h + '</h1><p class="lede" style="margin-inline:auto">' + p + '</p>' +
        '<p style="margin-top:1.4rem"><a class="btn btn-p" href="/search/">Search the directory</a></p></div></section>';
    }
    if (!slug) {
      miss('No listing specified', 'That profile link is incomplete. Search the directory to find the business you were looking for.');
      return;
    }

    // A listing ID (old badge links use /b/gc-123456/), then the exact slug; if
    // both miss (slug drift, an old link, a rebuild that has not run) fall back to
    // the name the slug was made from, so a business is still reachable.
    var first = /^gc-\d+$/i.test(slug)
      ? sb.from(T('listings_public')).select('*').eq('id', slug.toLowerCase()).maybeSingle()
      : sb.from(T('listings_public')).select('*').eq('slug', slug).maybeSingle();
    first.then(function (r) {
      if (r.data) return r;
      var guess = slug.replace(/-\d+$/, '').replace(/-/g, ' ');
      return sb.from(T('listings_public')).select('*').ilike('name', guess).limit(1)
        .then(function (r2) { return { data: (r2.data && r2.data[0]) || null, error: r2.error }; });
    }).then(function (r) {
      var b = r.data;
      if (!b) {
        miss('Listing not found', 'This business is not listed, or its listing has been removed. Try searching the directory instead.');
        return;
      }
      if (b.slug && b.slug !== slug && history.replaceState) history.replaceState(null, '', '/b/' + b.slug + '/');
      document.title = b.name + ' — ' + (b.subcategory || b.category_name || '') + ' in ' + (b.city_name || '') + ' | Getclient';
      var canon = document.querySelector('link[rel=canonical]');
      if (canon) canon.href = 'https://getclient.co.za/b/' + b.slug + '/';

      var checks = [['check_identity', 'Identity'], ['check_cipc', 'CIPC registration'],
                    ['check_insurance', 'Insurance'], ['check_trading_history', 'Trading history'],
                    ['check_reviews', 'Client ratings']];
      var ledger = '<div class="ledger">' + checks.map(function (c) {
        var on = !!b[c[0]];
        return '<div class="ledger__i"><span class="ledger__l">' + c[1] + '</span>' +
          '<span class="ledger__s ledger__s--' + (on ? 'on' : 'off') + '"><span class="ledger__d"></span>' +
          (on ? 'Checked' : 'Not checked') + '</span></div>';
      }).join('') + '</div>';
      var tierChip = b.tier === 'gold' || b.tier === 'blue'
        ? '<span class="tier tier--' + b.tier + '">' + sealSVG(b.tier) + ' ' + (b.tier === 'gold' ? 'Gold' : 'Blue') + ' Verified</span>'
        : '<span class="tier tier--none">Listed</span>';
      var tel = String(b.phone || '').replace(/[^+\d]/g, '');
      var bimg = b.tier === 'gold' || b.tier === 'blue' ? b.tier : 'listed';
      var snippet = '<script src="https://getclient.co.za/badge.js" data-gc-id="' + b.id + '" async><\/script>';
      var loc = G.locText(b);
      var paid = G.isPaid(b), gold = b.tier === 'gold';

      dyn.innerHTML =
        '<section class="prof-h">' + (paid && b.cover_photo ? '<div class="prof-h__cov"><img src="' + esc(photoURL(b.cover_photo)) + '" alt=""></div>' : '') +
        '<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>' +
        '<a href="/c/' + esc(b.category) + '/">' + esc(b.category_name || '') + '</a><span aria-hidden="true">/</span><span>' + esc(b.name) + '</span></nav>' +
        '<div class="prof-h__g">' + G.avatar(b) + '<div><div class="chips" style="margin-bottom:.6rem">' + tierChip +
        (b.sponsored ? '<span class="tier tier--ad">Ad</span>' : '') + '</div>' +
        '<h1>' + esc(b.name) + sealSVG(b.tier, 'seal--lg') + '</h1><div class="prof-h__mt">' +
        '<span><i class="fa-solid fa-briefcase"></i>' + esc(b.subcategory || b.category_name || '') + '</span>' +
        '<span><i class="fa-solid fa-location-dot"></i>' + esc(loc) + '</span>' +
        '<span class="rate" data-gc-rating="' + esc(b.id) + '">' + ratingHTML(b.avg_rating, b.rating_count) + '</span></div></div>' +
        '<div class="prof-h__acts">' + (paid ? '<a class="btn btn-p" href="#quote">Request a quote</a>' : '') +
        (tel ? '<a class="btn btn-o" href="tel:' + esc(tel) + '">Call</a>' : '') + '</div></div></div></section>' +

        '<section class="sec" style="padding-top:2.6rem"><div class="wrap"><div class="profile"><div>' +
        (b.tagline ? '<p class="lede" style="color:var(--head);font-weight:500;margin-bottom:1.4rem">' + esc(b.tagline) + '</p>' : '') +
        '<h2>About</h2><p class="about">' + esc(b.description || '') + '</p>' +
        (paid ? '<h2>Services</h2><div data-gc-services="' + esc(b.id) + '"><p class="mut">Services are being added.</p></div>' : '') +
        (paid ? '<div id="gc-gallery" data-gc-gallery="' + esc(b.id) + '"></div>' : '') +
        '<h2>Verification record</h2>' + ledger +
        '<h2>Rating</h2><div class="rater" data-gc-rater="' + esc(b.id) + '">' +
        '<div style="margin-bottom:.6rem"><span class="rate" data-gc-rating="' + esc(b.id) + '">' + ratingHTML(b.avg_rating, b.rating_count) + '</span></div>' +
        '<p class="mut" style="font-size:.88rem;margin-bottom:.3rem">Worked with ' + esc(b.name) + '? Give them a rating out of five. Stars only, there is no comment box.</p>' +
        '<div class="rater__btns" role="group" aria-label="Rate this business">' +
        [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" data-gc-star="' + n + '" aria-label="' + n + ' stars"><svg viewBox="0 0 24 24"><path class="star-off" d="' + STAR_D + '"/></svg></button>';
        }).join('') + '</div><p class="rater__msg" data-gc-rater-msg></p></div></div>' +

        '<aside><div class="card"><h3>Contact</h3><table class="kv"><tbody>' +
        (b.phone ? '<tr><td>Phone</td><td><a href="tel:' + esc(tel) + '">' + esc(b.phone) + '</a></td></tr>' : '') +
        (b.email ? '<tr><td>Email</td><td><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></td></tr>' : '') +
        (b.website ? '<tr><td>Website</td><td><a href="' + esc(b.website) + '" rel="nofollow noopener" target="_blank">' +
          esc(b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a></td></tr>' : '') +
        '<tr><td>Based in</td><td>' + esc(b.address || loc) + '</td></tr>' +
        '<tr><td>Listing ID</td><td><code>' + esc(b.id) + '</code></td></tr></tbody></table></div>' +
        (!paid ? '<div class="note" style="font-size:.86rem">' + esc(b.name) + ' has a Basic listing. Contact them directly using the details above.</div>' : '<div class="card" id="quote"><h3>Request a quote</h3>' +
        '<form class="form" id="gc-quote-form" data-email="' + esc(b.email) + '" style="margin-top:.8rem">' +
        '<input type="hidden" name="business_id" value="' + esc(b.id) + '">' +
        '<div class="f"><label for="qn">Your name</label><input id="qn" name="name" required></div>' +
        '<div class="f"><label for="qe">Email</label><input id="qe" name="email" type="email" required></div>' +
        '<div class="f"><label for="qp">Phone</label><input id="qp" name="phone" inputmode="tel"></div>' +
        '<div class="f"><label for="qd">What do you need done?</label><textarea id="qd" name="details" required></textarea></div>' +
        '<div class="ts" data-gc-turnstile="quote_request"></div>' +
        '<button class="btn btn-p btn-blk" type="submit">Send request</button>' +
        '<p id="gc-quote-status" class="msg"></p></form></div>') +
        '<div class="card">' + shareHTML(b) + '</div>' +
        '<div class="card own"><h3>Is this your business?</h3><p style="font-size:.86rem">Every Getclient listing displays the badge on its own website. Paste this once, anywhere in your site\'s code.</p>' +
        '<img src="/assets/badge/' + bimg + '-light.svg" alt="Listed on Getclient" height="52">' +
        '<div class="codebox"><button class="btn btn-s copy" data-copy="#own-code">Copy</button><pre id="own-code">' + esc(snippet) + '</pre></div>' +
        '<p style="margin-top:.8rem;font-size:.84rem"><a href="/badge/?id=' + esc(b.id) + '">More badge styles →</a></p></div>' +
        '</aside></div></div></section>';

      if (paid) loadGallery(b.id);
      if (paid) loadServices(b.id);
      wireRater();
      wireQuote();
    });
  }

  /* ============================================ photos */
  function loadGallery(id) {
    var box = $('[data-gc-gallery="' + id + '"]');
    if (!box) return;
    sb.from(T('photos')).select('path,caption').eq('listing_id', id).order('sort').then(function (r) {
      if (r.error || !r.data || !r.data.length) return;
      box.className = 'gallery';
      box.insertAdjacentHTML('beforeend', r.data.map(function (p, i) {
        return '<a class="gallery__i" href="' + esc(photoURL(p.path)) + '" target="_blank" rel="noopener">' +
          '<img src="' + esc(photoURL(p.path)) + '" alt="' + esc(p.caption || '') + '" loading="' +
          (i ? 'lazy' : 'eager') + '" width="600" height="400"></a>';
      }).join(''));
    });
  }
  $$('[data-gc-gallery]').forEach(function (n) { loadGallery(n.getAttribute('data-gc-gallery')); });

  /* re-wire the rating control and quote form on dynamically rendered profiles */
  function wireRater() {
    var rater = $('[data-gc-rater]');
    if (!rater || rater.dataset.wired) return;
    rater.dataset.wired = '1';
    var id = rater.getAttribute('data-gc-rater');
    var msg = $('[data-gc-rater-msg]', rater), btns = $$('[data-gc-star]', rater);
    var key = localStorage.getItem('gc_rater') ||
      (function () { var v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem('gc_rater', v); return v; })();
    var mine = Number(localStorage.getItem('gc_rated_' + id) || 0);
    function paint(n) { btns.forEach(function (b, i) { $('path', b).setAttribute('class', i < n ? 'star-on' : 'star-off'); }); }
    if (mine) { paint(mine); msg.className = 'rater__msg ok'; msg.textContent = 'You rated this ' + mine + ' out of 5.'; }
    btns.forEach(function (b, i) {
      b.addEventListener('mouseenter', function () { paint(i + 1); });
      b.addEventListener('click', function () {
        var n = i + 1;
        paint(n); msg.className = 'rater__msg'; msg.textContent = 'Saving…';
        sb.rpc('gc_rate', { p_listing: id, p_stars: n, p_key: key }).then(function (r) {
          if (r.error) {
            msg.className = 'rater__msg err';
            msg.textContent = 'That did not save: ' + (r.error.message || 'unknown error');
            paint(mine); return;
          }
          mine = n; localStorage.setItem('gc_rated_' + id, String(n));
          msg.className = 'rater__msg ok';
          msg.textContent = 'Thank you. Your rating of ' + n + ' out of 5 is saved.';
          var row = (r.data && r.data[0]) || null;
          if (row) $$('[data-gc-rating="' + id + '"]').forEach(function (el) {
            el.innerHTML = ratingHTML(row.avg_rating, row.rating_count);
          });
        });
      });
    });
    rater.addEventListener('mouseleave', function () { paint(mine); });
  }

  function wireQuote() { if (G.wireQuote) G.wireQuote($('#gc-quote-form')); }

  /* Gold services from gc_services; the static page already shows the build-time list */
  function loadServices(id) {
    var box = $('[data-gc-services="' + id + '"]');
    if (!box) return;
    sb.from(T('services')).select('name,description,price_from,sort').eq('listing_id', id).order('sort').then(function (r) {
      if (r.error || !r.data || !r.data.length) return;
      box.innerHTML = '<div class="svcs">' + r.data.map(function (x, i) {
        return '<div class="svc"><span class="svc__n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><div><b>' + esc(x.name) + '</b>' +
          (x.description ? '<p>' + esc(x.description) + '</p>' : '') + (x.price_from ? '<span class="svc__p">' + esc(x.price_from) + '</span>' : '') + '</div></div>';
      }).join('') + '</div>';
    });
  }
  $$('[data-gc-services]').forEach(function (n) { loadServices(n.getAttribute('data-gc-services')); });

  /* ============================================ 2b. owner stats: views and clicks */
  // Counted once per visitor per day by gc_track(); shown in the business dashboard.
  (function track() {
    if (page !== 'profile') return;
    var tries = 0;
    (function wait() {
      var el = $('[data-gc-rater]');
      if (!el) { if (++tries < 20) setTimeout(wait, 300); return; }      // dynamic profiles render later
      var id = el.getAttribute('data-gc-rater');
      var send = function (kind) { sb.rpc('gc_track', { p_listing: id, p_kind: kind }).then(function () {}, function () {}); };
      var key = 'gc_seen_' + id + '_' + new Date().toISOString().slice(0, 10);
      var seen = null; try { seen = sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (e) { /* private mode */ }
      if (!seen) send(/[?&]ref=badge/.test(location.search) ? 'badge_click' : 'view');
      if (!seen && /[?&]ref=badge/.test(location.search)) send('view');
      document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href]');
        if (!a || !a.closest('main')) return;
        var h = a.getAttribute('href') || '';
        if (/^tel:/.test(h)) send('phone_click');
        else if (/wa\.me\/(?!\?)/.test(h)) send('whatsapp_click');
        else if (a.getAttribute('rel') && /nofollow/.test(a.getAttribute('rel')) && /^https?:/.test(h) && !/wa\.me|facebook|x\.com|linkedin/.test(h)) send('website_click');
      });
    })();
  })();

  /* ============================================ 3. Paystack for paid plans */

  window.GCPay = function (opts) {
    var key = CFG.paystackPublicKey || '';
    if (!key || key.indexOf('pk_') !== 0) {
      alert('Payment is not configured yet. Add your Paystack public key to config.js.');
      opts.onClose && opts.onClose();
      return;
    }
    if (typeof window.PaystackPop === 'undefined') {
      alert('The payment window did not load. Check your connection and try again.');
      opts.onClose && opts.onClose();
      return;
    }
    // The amount is whatever gc_price() returned on the server. verify-payment
    // recomputes it from the stored code before the payment counts, so editing
    // this value in the page buys nothing.
    var amount = Number(opts.amount || 0);
    if (!amount) { opts.onDone && opts.onDone(null); return; }

    var handler = window.PaystackPop.setup({
      key: key,
      email: opts.email,
      amount: amount,
      currency: 'ZAR',
      ref: 'GC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      metadata: {
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: opts.plan },
          { display_name: 'Business', variable_name: 'business', value: opts.name },
          { display_name: 'Discount', variable_name: 'discount', value: opts.code || 'none' }
        ]
      },
      callback: function (res) {
        // Recorded here, but only marked paid once the edge function verifies it
        // against Paystack with the secret key. A client callback is not proof.
        sb.from(T('payments')).insert({
          plan: opts.plan, amount: amount, reference: res.reference,
          discount_code: opts.code || null, status: 'pending_verification'
        }).then(function () {
          fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey },
            body: JSON.stringify({ reference: res.reference })
          }).catch(function () {});
          opts.onDone && opts.onDone(res.reference);
        }).catch(function () { opts.onDone && opts.onDone(res.reference); });
      },
      onClose: function () { opts.onClose && opts.onClose(); }
    });
    handler.openIframe();
  };
})();
