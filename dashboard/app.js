// Token Radar dashboard: renders window.RADAR into the board, the detail view and
// the live-token table. Static page, no network: all data comes from ../data.js.
// Hash routes (used by the entry's screenshots): #detail=<slug> opens a protocol,
// #cat=<category> filters to one category, #watchlist=1 shows the watchlist only.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !R.rows) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="8">No radar data loaded.</td></tr>';
    return;
  }
  var watchSet = {};
  R.watchlist.forEach(function (s) { watchSet[s] = true; });
  var bySlug = {};
  R.rows.forEach(function (r) { bySlug[r.slug] = r; });

  function usd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var c = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
    return '<span class="' + c + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
  }
  function age(v) {
    if (v === null || v === undefined) return '—';
    return v + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- header ----
  document.getElementById('as-of').textContent = R.as_of;
  document.getElementById('source').textContent = R.source;
  document.getElementById('model-ver').textContent = R.model_version;
  var totalImplied = R.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  var totalTvl = R.rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
  document.getElementById('stats').innerHTML =
    stat(R.board_size, 'protocols ranked') +
    stat(R.watchlist_size, 'on the watchlist') +
    stat(R.early_size, 'early finds') +
    stat(usd(totalTvl), 'board TVL') +
    stat(usd(totalImplied), 'total implied value');
  function stat(v, label) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(String(v)) + '</dd></div>';
  }

  // ---- controls ----
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var cats = [], chains = [];
  R.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) === -1) chains.push(c); });
  });
  cats.sort().forEach(function (c) { catSel.add(new Option(c, c)); });
  chains.sort().forEach(function (c) { chainSel.add(new Option(c, c)); });

  var q = document.getElementById('q');
  var sortSel = document.getElementById('sort');
  var watchBox = document.getElementById('watch');
  [q, catSel, chainSel, sortSel, watchBox].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  function filtered() {
    var needle = q.value.trim().toLowerCase();
    var list = R.rows.filter(function (r) {
      if (needle && r.name.toLowerCase().indexOf(needle) === -1 && r.slug.indexOf(needle) === -1) return false;
      if (catSel.value && r.category !== catSel.value) return false;
      if (chainSel.value && r.chains.indexOf(chainSel.value) === -1) return false;
      if (watchBox.checked && !watchSet[r.slug]) return false;
      return true;
    });
    var s = sortSel.value;
    if (s === 'tvl') list.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (s === 'growth') list.sort(function (a, b) { return (b.change_7d || -1e9) - (a.change_7d || -1e9); });
    else if (s === 'age') list.sort(function (a, b) { return (b.age_days || -1) - (a.age_days || -1); });
    return list;
  }

  function rowHtml(r) {
    return '<tr data-slug="' + esc(r.slug) + '">' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span>' +
      (watchSet[r.slug] ? ' <span class="badge">watchlist</span>' : '') + '</td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + usd(r.tvl_usd) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + age(r.age_days) + '</td>' +
      '<td class="num"><strong>' + usd(r.implied_value_usd) + '</strong></td></tr>';
  }

  function render() {
    var list = filtered();
    document.getElementById('rows').innerHTML = list.map(rowHtml).join('') ||
      '<tr><td colspan="8">Nothing matches these filters.</td></tr>';
    document.getElementById('count').textContent = list.length + ' of ' + R.rows.length + ' protocols';
    document.querySelectorAll('#rows tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
  }

  // ---- detail view ----
  function parseStep(s) {
    var m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
    if (!m) return { text: s, cost: '', time: '' };
    return { text: m[1], cost: m[2], time: m[3] };
  }
  function openDetail(slug) {
    var r = bySlug[slug];
    var box = document.getElementById('detail');
    if (!r) { box.hidden = true; return; }
    document.querySelectorAll('#rows tr').forEach(function (tr) {
      tr.classList.toggle('open', tr.getAttribute('data-slug') === slug);
    });
    var steps = r.farm_steps.map(function (s, i) {
      var p = parseStep(s);
      return '<li><strong>Step ' + (i + 1) + '.</strong> ' + esc(p.text) +
        (p.cost ? ' <span class="meta">Cost: ' + esc(p.cost) + '. Time: ' + esc(p.time) + '.</span>' : '') + '</li>';
    }).join('');
    box.innerHTML =
      '<h2>#' + r.rank + ' — ' + esc(r.name) + '</h2>' +
      '<p class="sub">' + esc(r.slug) + ' &middot; ' + esc(r.category || 'No category') + ' &middot; ' +
      esc(r.chains.join(', ') || '—') + ' &middot; Records no token in the snapshot.</p>' +
      '<dl class="kv">' +
      '<div><dt>TVL</dt><dd>' + usd(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</dd></div>' +
      '<div><dt>Tracked since</dt><dd>' + esc(r.listed_at || '—') + ' (' + age(r.age_days) + ')</dd></div>' +
      '<div><dt>Implied value</dt><dd>' + usd(r.implied_value_usd) + '</dd></div>' +
      '</dl>' +
      '<h3>Why this value — the model&rsquo;s four factors</h3>' +
      '<table class="factors"><tbody>' +
      '<tr><td>Peer multiple (' + esc(r.category || 'no category') + ')</td><td class="num">&times;' + r.peer_multiple.toFixed(3) + '</td></tr>' +
      '<tr><td>Growth multiplier</td><td class="num">&times;' + r.growth_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Seasoning multiplier</td><td class="num">&times;' + r.seasoning_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Breadth multiplier (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</td><td class="num">&times;' + r.breadth_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Implied value = TVL &times; peer &times; growth &times; seasoning &times; breadth</td><td class="num"><strong>' + usd(r.implied_value_usd) + '</strong></td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — what to do about it</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<p class="hint">Implied value is this board&rsquo;s own claim, not a promise of a token. Never pay to claim anything; claim only from links the protocol itself publishes.</p>';
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- live table ----
  document.getElementById('live-rows').innerHTML = R.live.map(function (p) {
    var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '&times;' : '—';
    return '<tr><td><span class="name">' + esc(p.name) + '</span><br><span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + usd(p.tvl_usd) + '</td>' +
      '<td class="num">' + usd(p.mcap_usd) + '</td>' +
      '<td class="num">' + ratio + '</td></tr>';
  }).join('');

  // ---- methodology ----
  var m = R.model;
  document.getElementById('method-body').innerHTML =
    '<p>Model <strong>' + esc(R.model_version) + '</strong>, computed only from the sealed snapshot of ' +
    esc(R.as_of) + ' (' + R.rows.length + ' rows). ' +
    'Implied value = TVL &times; peer multiple &times; growth &times; seasoning &times; breadth.</p>' +
    '<ul>' +
    '<li><strong>Peer multiple.</strong> The median market-cap/TVL of live-token protocols in the same category, ' +
    'shrunk toward the global median (' + R.global_peer_multiple.toFixed(3) + '&times;, prior weight ' + m.prior_weight + ') ' +
    'and clamped to [' + m.peer_floor + ', ' + m.peer_cap + ']. Categories with no live peers use the global median.</li>' +
    '<li><strong>Growth.</strong> The 7-day TVL change, clamped to [' + m.growth_floor + '%, ' + m.growth_cap + '%], ' +
    'weighted ' + m.growth_weight + ' (multiplier 1 + 0.5 &times; pct/100).</li>' +
    '<li><strong>Seasoning.</strong> ' + m.seasoning_floor + ' + ' + m.seasoning_range + ' &times; (1 &minus; e<sup>&minus;age/' + m.seasoning_days + '</sup>): ' +
    'a protocol tracked longer without a token scores nearer 1.00; unknown age scores ' + m.unknown_age_factor + '.</li>' +
    '<li><strong>Breadth.</strong> 1 + ' + m.breadth_step + ' per extra chain, up to ' + m.breadth_max + ' extra chains (max &times;1.20).</li>' +
    '<li><strong>Coverage.</strong> All ' + R.watchlist_size + ' watchlist protocols, plus ' + R.early_size +
    ' rankable pre-token protocols below the $50M floor — every row computed by the same rule, no name ever special-cased.</li>' +
    '</ul>';

  // ---- hash routes ----
  function applyHash() {
    var h = window.location.hash.replace(/^#/, '');
    var params = new URLSearchParams(h);
    if (params.get('detail')) { openDetail(params.get('detail')); return; }
    if (params.get('cat')) { catSel.value = params.get('cat'); render(); return; }
    if (params.get('watchlist')) { watchBox.checked = true; render(); return; }
  }
  window.addEventListener('hashchange', applyHash);
  render();
  applyHash();
})();
