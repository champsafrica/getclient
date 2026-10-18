/*! Getclient Badge v2 — getclient.co.za
 *  Paste on any website:
 *  <script src="https://getclient.co.za/badge.js" data-gc-id="gc-000001" async></script>
 *
 *  Attributes (all optional except data-gc-id, and unchanged since v1, so every
 *  badge already in the wild keeps working):
 *    data-gc-id      required. Listing ID, e.g. gc-000001
 *    data-gc-theme   light | dark                   (default light)
 *    data-gc-size    default | compact              (default default)
 *    data-gc-layout  inline | float-br | float-bl   (default inline)
 *
 *  Every listing shows "Listed on Getclient". Blue and Gold listings also show
 *  their tier. The badge links to the business's record on getclient.co.za and
 *  removes itself if the listing is no longer in the directory.
 *  It renders inside a shadow root, so it cannot inherit or leak CSS.
 */
(function () {
  'use strict';

  var ORIGIN = 'https://getclient.co.za';
  // Public, read-only key: the same one the directory itself uses in the browser.
  var DB = 'https://nfdzcjwncbpsruieaxis.supabase.co/rest/v1/gc_listings_public';
  var KEY = 'sb_publishable_mV3THsWNHuhgqFe6CfVCxQ_Jak-HAxt';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var MARK = '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">' +
    '<rect width="64" height="64" rx="15" fill="#1652F0"/>' +
    '<path d="M50 32 A18 18 0 1 1 38.16 15.09" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>' +
    '<path d="M50 32 H33" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>' +
    '<circle cx="46.75" cy="21.67" r="3.6" fill="#fff"/></svg>';

  function seal(a, b, id) {
    var pts = '';
    for (var i = 0; i < 24; i++) {
      var ang = (Math.PI / 12) * i - Math.PI / 2, r = i % 2 === 0 ? 15.2 : 12.6;
      pts += (16 + r * Math.cos(ang)).toFixed(2) + ',' + (16 + r * Math.sin(ang)).toFixed(2) + ' ';
    }
    return '<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/>' +
      '<stop offset="1" stop-color="' + b + '"/></linearGradient></defs><polygon points="' + pts.trim() + '" fill="url(#' + id + ')"/>' +
      '<path d="M10.6 16.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  var ICON = { none: MARK, blue: seal('#5A9BFF', '#1D6FF2', 'gcb'), gold: seal('#E0A32E', '#B8860B', 'gcg') };

  function css(o) {
    var dark = o.theme === 'dark', compact = o.size === 'compact';
    return ':host{all:initial;display:' + (o.layout === 'inline' ? 'inline-block' : 'block') + ';vertical-align:middle}' +
      (o.layout === 'float-br' || o.layout === 'float-bl'
        ? '.w{position:fixed;bottom:18px;' + (o.layout === 'float-bl' ? 'left' : 'right') + ':18px;z-index:2147483000}'
        : '.w{display:inline-block}') +
      '.b{position:relative;overflow:hidden;display:inline-flex;align-items:center;box-sizing:border-box;text-decoration:none;' +
      'gap:' + (compact ? '7px' : '10px') + ';padding:' + (compact ? '6px 13px 7px 7px' : '9px 18px 11px 10px') + ';border-radius:999px;' +
      'font-family:Poppins,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.2;' +
      'background:' + (dark ? '#071A47' : '#fff') + ';border:1.5px solid ' + (dark ? '#24407F' : '#D5E0FB') + ';' +
      'box-shadow:0 1px 2px rgba(11,42,111,.08);transition:box-shadow .15s ease,transform .15s ease}' +
      '.b::after{content:"";position:absolute;left:0;right:0;bottom:0;height:' + (compact ? '2px' : '3px') + ';' +
      'background:linear-gradient(90deg,#007749 0 20%,#FFB81C 0 40%,#E03C31 0 60%,#001489 0 80%,#000 0)}' +
      '.b:hover{box-shadow:0 8px 20px -6px rgba(11,42,111,.35);transform:translateY(-1px)}' +
      '.b:focus-visible{outline:3px solid #8FB0FF;outline-offset:2px}' +
      '.i{flex:none;width:' + (compact ? '20px' : '32px') + ';height:' + (compact ? '20px' : '32px') + '}' +
      '.t{display:flex;flex-direction:column}' +
      '.k{font-size:' + (compact ? '12.5px' : '10.5px') + ';font-weight:' + (compact ? '600' : '500') + ';letter-spacing:.01em;color:' +
      (dark ? '#9FB3E6' : '#55658C') + '}' +
      '.k.on{font-weight:600;color:' + (dark ? '#8FB0FF' : '#1652F0') + '}' +
      '.v{font-size:' + (compact ? '12.5px' : '15.5px') + ';font-weight:700;letter-spacing:-.01em;color:' + (dark ? '#fff' : '#0B2A6F') + '}' +
      (compact ? '.k{color:' + (dark ? '#fff' : '#0B2A6F') + '}.k b{color:' + (dark ? '#8FB0FF' : '#1652F0') + '}' : '') +
      '@media (prefers-reduced-motion:reduce){.b{transition:none}}';
  }

  function html(o, d) {
    var tier = d.tier === 'gold' || d.tier === 'blue' ? d.tier : 'none';
    var label = tier === 'gold' ? 'Gold Verified' : tier === 'blue' ? 'Blue Verified' : '';
    var url = ORIGIN + (d.url || '/b/' + encodeURIComponent(o.id) + '/');
    var title = (d.name ? d.name + ' is listed on Getclient' + (label ? ' — ' + label : '') : 'Listed on Getclient') +
      '. Click to view the verification record.';
    var text;
    if (o.size === 'compact') {
      text = '<span class="k">' + (label ? esc(label) + ' · <b>Getclient</b>' : 'Listed on <b>Getclient</b>') + '</span>';
    } else if (label) {
      text = '<span class="k on">Listed on Getclient</span><span class="v">' + label + '</span>';
    } else {
      text = '<span class="k">Listed on</span><span class="v">Getclient</span>';
    }
    return '<style>' + css(o) + '</style><span class="w"><a class="b" href="' + esc(url) + '" target="_blank" rel="nofollow noopener"' +
      ' title="' + esc(title) + '" aria-label="' + esc(title) + '"><span class="i">' + ICON[tier] + '</span>' +
      '<span class="t">' + text + '</span></a></span>';
  }

  /* public API, used by the badge builder on getclient.co.za */
  function mount(host, o, d) {
    var root = host.shadowRoot || (host.attachShadow ? host.attachShadow({ mode: 'open' }) : host);
    root.innerHTML = html(o, d || {});
    return root;
  }
  window.GetclientBadge = { mount: mount, version: 2 };

  /* ---------- auto-mount every <script data-gc-id> ---------- */
  function lookup(id) {
    // 1. the static record published at build time
    return fetch(ORIGIN + '/verify/' + encodeURIComponent(id) + '.json', { mode: 'cors', cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        if (d && d.listed) return d;
        // 2. listings approved since the last build: ask the directory directly
        return fetch(DB + '?select=id,slug,name,tier&id=eq.' + encodeURIComponent(id), {
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, mode: 'cors'
        }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (rows) {
            var b = rows && rows[0];
            return b ? { id: b.id, name: b.name, tier: b.tier, listed: true, url: '/b/' + b.slug + '/' } : { listed: false };
          });
      });
  }

  function boot(script) {
    if (!script || script.getAttribute('data-gc-mounted')) return;
    var id = (script.getAttribute('data-gc-id') || '').trim();
    if (!id) return;
    script.setAttribute('data-gc-mounted', '1');
    var o = {
      id: id,
      theme: script.getAttribute('data-gc-theme') === 'dark' ? 'dark' : 'light',
      size: script.getAttribute('data-gc-size') === 'compact' ? 'compact' : 'default',
      layout: script.getAttribute('data-gc-layout') || 'inline'
    };
    var host = document.createElement('span');
    host.className = 'getclient-badge-host';
    host.setAttribute('data-gc-id', id);
    script.parentNode.insertBefore(host, script);
    mount(host, o, { tier: 'none' });          // "Listed on Getclient" straight away

    if (!window.fetch) return;
    lookup(id).then(function (d) {
      if (d && d.listed) mount(host, o, d);
      else if (d && d.listed === false && host.parentNode) host.parentNode.removeChild(host);  // removed listing
    }).catch(function () { /* network trouble: keep the neutral badge */ });
  }

  var cur = document.currentScript;
  if (cur && cur.getAttribute('data-gc-id')) boot(cur);
  // also pick up badges added before this script ran, or several on one page
  var all = document.querySelectorAll('script[data-gc-id]');
  for (var i = 0; i < all.length; i++) {
    if ((all[i].src || '').indexOf('badge.js') > -1) boot(all[i]);
  }
})();
