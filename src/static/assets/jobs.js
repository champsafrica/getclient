/*! Getclient smart quote matching: the "Get quotes" form, the client's status
 *  page (/job/#t=...) and the business's accept/decline page (/lead/#t=...).
 *  Links carry their one-time token after the # so it never reaches a server log.
 */
(function () {
  'use strict';
  var G = window.GC || {};
  var esc = G.esc, fn = G.fn;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var TIMING = { urgent: 'Urgent (within 24 hours)', week: 'This week', month: 'This month', flexible: 'Flexible' };
  var hashToken = (location.hash.match(/t=([a-f0-9]{64})/) || [])[1] || '';
  function when(d) { return new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }); }
  function notDeployed(r) { return r.status === 404 && (!r.data || !r.data.error) || r.status === 0; }

  /* ---------------------------------------------------------- get quotes */
  var form = $('#gc-job-form');
  if (form) {
    var q = new URLSearchParams(location.search);
    ['category', 'city', 'service'].forEach(function (k) {
      var v = q.get(k === 'category' ? 'cat' : k === 'city' ? 'loc' : 'service');
      if (v && form.elements[k]) form.elements[k].value = v;
    });
    var ts = $('[data-gc-turnstile]', form) ? G.turnstile($('[data-gc-turnstile]', form)) : null;
    var msg = $('#gc-job-msg'), btn = $('#gc-job-submit');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {};
      ['category', 'city', 'service', 'details', 'budget', 'name', 'email', 'phone'].forEach(function (k) { d[k] = (form.elements[k].value || '').trim(); });
      d.timing = (form.querySelector('[name=timing]:checked') || {}).value || '';
      d.consent = $('#jconsent').checked;
      var miss = [];
      if (!d.category) miss.push('a category'); if (!d.city) miss.push('where the job is');
      if (d.service.length < 2) miss.push('the service you need'); if (d.details.length < 20) miss.push('a description (20+ characters)');
      if (d.name.length < 2) miss.push('your name'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) miss.push('a valid email');
      if (miss.length) { msg.className = 'msg err'; msg.textContent = 'Still needed: ' + miss.join(', ') + '.'; return; }
      if (!d.consent) { msg.className = 'msg err'; msg.textContent = 'Please tick the box so we may share your request with the matched businesses.'; return; }
      d.token = ts ? ts.token() : '';
      if (window.GC_CONFIG && window.GC_CONFIG.turnstileSiteKey && !d.token) { msg.className = 'msg err'; msg.textContent = 'Please complete the security check.'; return; }
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Finding verified businesses…';
      fn('submit-job', d).then(function (r) {
        btn.disabled = false; if (ts) ts.reset();
        if (notDeployed(r)) { msg.className = 'msg err'; msg.textContent = 'Quote matching is not switched on yet. Please use a business\'s own quote form, or WhatsApp us.'; return; }
        if (r.status !== 200) { msg.className = 'msg err'; msg.textContent = r.data.message || 'That did not send. Please try again.'; return; }
        form.hidden = true;
        $('#gc-job-done').hidden = false;
        $('#gc-job-ref').textContent = r.data.ref;
        $('#gc-job-status-link').href = r.data.status_url;
        $('#gc-job-done-text').textContent = r.data.offered > 0
          ? 'We sent your request to ' + r.data.offered + ' verified business' + (r.data.offered === 1 ? '' : 'es') + ' near you. The ones that can help will contact you, and we will email you who they are.'
          : 'No verified business near you is available for this right now. Our team has your request and will follow up by email.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* ---------------------------------------------------------- client status */
  var status = $('#gc-job-status');
  if (status) {
    var render = function (r) {
      if (r.status !== 200) { status.innerHTML = '<div class="empty"><h3>We could not open this request</h3><p>' + esc((r.data && r.data.message) || 'The link may be incomplete. Use the button in your email.') + '</p><a class="btn btn-p" href="/get-quotes/">Make a new request</a></div>'; return; }
      var d = r.data, j = d.job;
      var chip = { matching: ['tier--blue', 'Finding businesses'], matched: ['tier--gold', 'Businesses have accepted'], no_match: ['tier--none', 'No match yet'], closed: ['tier--none', 'Closed'] }[j.status] || ['tier--none', j.status];
      var biz = d.businesses.map(function (b) {
        return '<div class="card mbiz"><div class="mbiz__h"><b>' + esc(b.name) + ' ' + (G.seal ? G.seal(b.tier) : '') + '</b><span class="mut">' + esc(b.subcategory || '') + ' · ' + esc(b.city_name || '') + (b.nearby ? ' (nearby)' : '') + '</span></div>' +
          '<div class="mbiz__a">' + (b.phone ? '<a class="btn btn-p btn-s" href="tel:' + esc(b.phone) + '"><i class="fa-solid fa-phone"></i> ' + esc(b.phone) + '</a>' : '') +
          (b.email ? '<a class="btn btn-g btn-s" href="mailto:' + esc(b.email) + '?subject=' + encodeURIComponent('Getclient request ' + j.ref) + '"><i class="fa-solid fa-envelope"></i> Email</a>' : '') +
          '<a class="btn btn-g btn-s" href="/b/' + esc(b.slug) + '/" target="_blank">Profile</a></div>' +
          '<p class="hint" style="margin:.5rem 0 0">Accepted ' + when(b.accepted_at) + '</p></div>';
      }).join('');
      status.innerHTML =
        '<div class="card" style="margin-bottom:1rem"><div class="chips" style="margin-bottom:.6rem"><span class="tier ' + chip[0] + '">' + chip[1] + '</span><span class="tier tier--listed">' + esc(j.ref) + '</span></div>' +
        '<h2 style="font-size:1.3rem;margin:0 0 .3rem">' + esc(j.service) + '</h2><p class="mut" style="margin:0 0 .6rem">' + esc(j.category || '') + ' · ' + esc(j.city || '') + ' · ' + esc(TIMING[j.timing] || '') + (j.budget ? ' · ' + esc(j.budget) : '') + '</p>' +
        '<p style="white-space:pre-wrap;margin:0">' + esc(j.details) + '</p></div>' +
        (d.businesses.length ? '<h2 style="font-size:1.15rem">Businesses that accepted</h2><div class="grid g2">' + biz + '</div>' : '') +
        '<p class="note" style="margin-top:1rem">' +
          (j.status === 'closed' ? 'This request is closed.' :
           d.deciding ? d.deciding + ' verified business' + (d.deciding === 1 ? ' is' : 'es are') + ' still deciding. We email you the moment one accepts.' :
           d.businesses.length ? 'Every business we offered your request to has answered.' :
           'No verified business is available for this right now. Our team has your request.') + '</p>' +
        (j.status !== 'closed' ? '<p style="margin-top:1rem"><button class="btn btn-g btn-s" id="gc-job-close">I found someone: close this request</button></p>' : '');
      var c = $('#gc-job-close');
      if (c) c.addEventListener('click', function () {
        if (!confirm('Close this request? Businesses still deciding will no longer see it.')) return;
        fn('job-status', { token: hashToken, action: 'close' }).then(render);
      });
    };
    if (!hashToken) render({ status: 400, data: { message: 'This page needs the private link from your email.' } });
    else fn('job-status', { token: hashToken }).then(render);
  }

  /* ---------------------------------------------------------- business answers */
  var leadBox = $('#gc-lead');
  if (leadBox) {
    var show = function (r, note) {
      var l = r.data && r.data.lead;
      if (!l) { leadBox.innerHTML = '<div class="empty"><h3>We could not open this job</h3><p>' + esc((r.data && (r.data.message || r.data.error)) || 'The link may be incomplete. Use the button in your email, or your dashboard.') + '</p><a class="btn btn-p" href="/dashboard/">Open my dashboard</a></div>'; return; }
      var j = l.job, open = l.status === 'offered';
      var stat = { offered: 'Waiting for your answer', accepted: 'You accepted this job', declined: 'You declined this job', expired: 'This offer expired', withdrawn: 'The client closed this request' }[l.status];
      leadBox.innerHTML =
        (note ? '<div class="note ' + (r.data.ok === false ? 'note--w' : 'note--ok') + '" style="margin-bottom:1rem">' + esc(note) + '</div>' : '') +
        '<div class="card"><div class="chips" style="margin-bottom:.7rem"><span class="tier tier--blue">For ' + esc(l.listing_name) + '</span>' +
          (l.match === 'possible' ? '<span class="tier tier--none">Possible match</span>' : '<span class="tier tier--gold">Strong match</span>') +
          (l.nearby ? '<span class="tier tier--listed">Nearby</span>' : '') + '<span class="tier tier--listed">' + esc(j.ref) + '</span></div>' +
        '<h2 style="font-size:1.35rem;margin:0 0 .3rem">' + esc(j.service) + ' in ' + esc(j.city) + '</h2>' +
        '<p class="mut" style="margin:0 0 .8rem">' + esc(j.category) + ' · ' + esc(TIMING[j.timing] || '') + (j.budget ? ' · Budget: ' + esc(j.budget) : '') + ' · from ' + esc(j.client_first_name) + '</p>' +
        '<p style="white-space:pre-wrap">' + esc(j.details) + '</p>' +
        '<p class="hint">' + stat + (open ? '. Please answer by <b>' + when(l.expires_at) + '</b>, or the job passes to another business.' : '.') + '</p>' +
        (l.client ? '<div class="note note--ok"><b>Client contact</b><br>' + esc(l.client.name) + '<br>' +
            (l.client.phone ? '<a href="tel:' + esc(l.client.phone) + '">' + esc(l.client.phone) + '</a><br>' : '') +
            (l.client.email ? '<a href="mailto:' + esc(l.client.email) + '?subject=' + encodeURIComponent('Your Getclient request ' + j.ref) + '">' + esc(l.client.email) + '</a>' : '') +
            '<br><span class="hint">Contact them soon: fast replies win work and lift your response rate.</span></div>' : '') +
        (open ? '<div class="lead-acts"><button class="btn btn-p" id="gc-accept"><i class="fa-solid fa-check"></i> Accept and get contact details</button>' +
          '<div class="lead-dec"><select id="gc-reason" class="ainput"><option value="Not my kind of work">Not my kind of work</option><option value="Fully booked">Fully booked</option><option value="Outside my area">Outside my area</option><option value="Budget too low">Budget too low</option><option value="Other">Other</option></select>' +
          '<button class="btn btn-g" id="gc-decline">Decline</button></div></div>' : '') +
        '</div><p class="hint" style="margin-top:1rem">Answer all your job offers in your <a href="/dashboard/">business dashboard</a>.</p>';
      var a = $('#gc-accept'), dcl = $('#gc-decline');
      if (a) a.addEventListener('click', function () { act('accept'); });
      if (dcl) dcl.addEventListener('click', function () { if (confirm('Decline this job? We will offer it to another business.')) act('decline'); });
    };
    var act = function (what) {
      $$('#gc-lead button').forEach(function (b) { b.disabled = true; });
      fn('lead', { token: hashToken, action: what, reason: ($('#gc-reason') || {}).value }).then(function (r) {
        show(r, r.data && r.data.ok ? (what === 'accept' ? 'Accepted. The client\'s details are below, and we have emailed them to you.' : 'Declined. We have offered the job to another business. Thank you for answering.') : (r.data && r.data.error));
      });
    };
    if (!hashToken) show({ data: { message: 'This page needs the link from your job email.' } });
    else fn('lead', { token: hashToken, action: 'view' }).then(function (r) { show(r); });
  }
})();
