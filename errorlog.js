// Southmead Surgical Teaching — errorlog.js
// v3.7.0 — Admin viewer for the internal error/interaction log (`error_log` table)
// Companion to the logger in config.js (`logError`, `logInteraction`, `logFlowStep`).

let _errorLogState = {
  level: '',        // ''|'error'|'warn'|'info'
  category: '',     // ''|js_error|network_error|auth_failure|user_action|...
  search: '',
  page: 0,
  pageSize: 50,
  total: null,
};

async function loadErrorLog() {
  const container = document.getElementById('errorLogView');
  if (!container) return;
  container.innerHTML = `
    <div style="padding:18px;max-width:1100px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;color:var(--nhs-dark-blue);font-size:20px;">Error & Interaction Log</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="elLevel" onchange="_elRefresh()" style="padding:6px 10px;border:1.5px solid var(--nhs-pale-grey);border-radius:6px;font-size:13px;">
            <option value="">All levels</option>
            <option value="error">Errors only</option>
            <option value="warn">Warn+</option>
            <option value="info">Info+</option>
          </select>
          <select id="elCategory" onchange="_elRefresh()" style="padding:6px 10px;border:1.5px solid var(--nhs-pale-grey);border-radius:6px;font-size:13px;">
            <option value="">All categories</option>
            <option value="js_error">JS errors</option>
            <option value="unhandled_rejection">Unhandled rejections</option>
            <option value="network_error">Network errors</option>
            <option value="db_error">DB errors</option>
            <option value="auth_failure">Auth failures</option>
            <option value="auth_server_error">Auth server errors</option>
            <option value="user_action">User actions</option>
            <option value="flow_step">Flow steps</option>
          </select>
          <input type="search" id="elSearch" placeholder="Search message/email…" oninput="_elDebouncedRefresh()" style="padding:6px 10px;border:1.5px solid var(--nhs-pale-grey);border-radius:6px;font-size:13px;min-width:220px;">
          <button class="btn btn-outline" onclick="_elRefresh()" style="padding:6px 14px;font-size:13px;">Refresh</button>
          <button class="btn btn-outline" onclick="_elExportCsv()" style="padding:6px 14px;font-size:13px;">Export CSV</button>
        </div>
      </div>
      <div style="background:#e0f5fa;border-left:3px solid var(--nhs-aqua);padding:10px 12px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:12px;color:#231f20;">
        Captures JS errors, unhandled rejections, network/DB failures, auth failures, and tagged user actions. Used for QI write-up and feature iteration.
      </div>
      <div id="elStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;"></div>
      <div id="elTable" style="background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow-x:auto;">
        <div style="padding:30px;text-align:center;color:var(--nhs-grey);"><div class="loading-spinner"></div> Loading…</div>
      </div>
      <div id="elPager" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:13px;color:var(--nhs-grey);"></div>
    </div>
  `;
  _errorLogState.page = 0;
  await _elRefresh();
}

let _elDebounce = null;
function _elDebouncedRefresh() {
  if (_elDebounce) clearTimeout(_elDebounce);
  _elDebounce = setTimeout(() => { _errorLogState.page = 0; _elRefresh(); }, 350);
}

function _elQuery() {
  const s = _errorLogState;
  s.level    = (document.getElementById('elLevel')?.value || '').trim();
  s.category = (document.getElementById('elCategory')?.value || '').trim();
  s.search   = (document.getElementById('elSearch')?.value || '').trim();
  let q = 'order=created_at.desc';
  q += `&limit=${s.pageSize}&offset=${s.page * s.pageSize}`;
  if (s.level === 'error') q += '&level=eq.error';
  else if (s.level === 'warn') q += '&level=in.(warn,error)';
  else if (s.level === 'info') q += '&level=in.(info,warn,error)';
  if (s.category) q += `&category=eq.${encodeURIComponent(s.category)}`;
  if (s.search) {
    const t = encodeURIComponent('*' + s.search + '*');
    q += `&or=(message.ilike.${t},actor_email.ilike.${t},source.ilike.${t})`;
  }
  return q;
}

async function _elRefresh() {
  const tableEl = document.getElementById('elTable');
  const pagerEl = document.getElementById('elPager');
  const statsEl = document.getElementById('elStats');
  if (!tableEl) return;
  try {
    const headersWithCount = { ...headers, 'Prefer': 'count=exact' };
    const url = `${SUPABASE_URL}/rest/v1/error_log?select=*&${_elQuery()}`;
    const res = await fetch(url, { headers: headersWithCount });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = parseInt((res.headers.get('content-range') || '').split('/')[1] || '0', 10);
    _errorLogState.total = total;
    const rows = await res.json();
    // Top stats — 24-hour count by level
    const now = Date.now(); const cutoff = new Date(now - 86400000).toISOString();
    const statsUrl = `${SUPABASE_URL}/rest/v1/error_log?select=level&created_at=gte.${encodeURIComponent(cutoff)}`;
    fetch(statsUrl, { headers }).then(r => r.ok ? r.json() : []).then(s => {
      const c = { error:0, warn:0, info:0, debug:0 };
      (s || []).forEach(x => { if (c[x.level] !== undefined) c[x.level]++; });
      statsEl.innerHTML = `
        <div class="stat-card" style="border-left:4px solid var(--nhs-red);"><div class="stat-num" style="color:var(--nhs-red);">${c.error}</div><div class="stat-label">Errors (24h)</div></div>
        <div class="stat-card" style="border-left:4px solid var(--nhs-orange);"><div class="stat-num" style="color:var(--nhs-orange);">${c.warn}</div><div class="stat-label">Warnings (24h)</div></div>
        <div class="stat-card" style="border-left:4px solid var(--nhs-aqua);"><div class="stat-num" style="color:var(--nhs-aqua);">${c.info}</div><div class="stat-label">Interactions (24h)</div></div>
        <div class="stat-card" style="border-left:4px solid var(--nhs-grey);"><div class="stat-num">${total}</div><div class="stat-label">Total (filter)</div></div>
      `;
    }).catch(() => { statsEl.innerHTML = ''; });

    if (!rows.length) {
      tableEl.innerHTML = '<div style="padding:30px;text-align:center;color:var(--nhs-grey);">No log entries match these filters.</div>';
      pagerEl.innerHTML = '';
      return;
    }
    let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:var(--nhs-bg);text-align:left;">
        <th style="padding:8px 10px;">Time</th>
        <th style="padding:8px 10px;">Level</th>
        <th style="padding:8px 10px;">Category</th>
        <th style="padding:8px 10px;">Message</th>
        <th style="padding:8px 10px;">Actor</th>
        <th style="padding:8px 10px;">Context</th>
      </tr></thead><tbody>`;
    rows.forEach(r => {
      const dt = r.created_at ? new Date(r.created_at) : null;
      const tStr = dt ? dt.toLocaleString('en-GB', { hour12: false }) : '';
      const lvlColor = r.level === 'error' ? 'var(--nhs-red)' : r.level === 'warn' ? 'var(--nhs-orange)' : r.level === 'info' ? 'var(--nhs-aqua)' : 'var(--nhs-grey)';
      const actor = r.actor_email ? `${esc(r.actor_email)}<br><span style="font-size:11px;color:var(--nhs-grey);">${esc(r.actor_type || '')}</span>` : (r.actor_type || 'anon');
      let ctx = '';
      if (r.context) {
        try { ctx = '<pre style="margin:0;font-size:11px;white-space:pre-wrap;word-break:break-all;max-width:380px;max-height:80px;overflow:auto;">' + esc(JSON.stringify(r.context, null, 1).slice(0, 600)) + '</pre>'; } catch(_) {}
      }
      const msg = esc(r.message || '');
      const stackBtn = r.stack ? `<details style="margin-top:4px;"><summary style="font-size:11px;color:var(--nhs-blue);cursor:pointer;">stack</summary><pre style="font-size:10px;white-space:pre-wrap;color:var(--nhs-grey);max-height:200px;overflow:auto;">${esc(r.stack)}</pre></details>` : '';
      html += `<tr style="border-bottom:1px solid var(--nhs-pale-grey);">
        <td style="padding:8px 10px;white-space:nowrap;font-family:monospace;font-size:11px;">${tStr}</td>
        <td style="padding:8px 10px;"><span style="background:${lvlColor}22;color:${lvlColor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase;">${esc(r.level || '')}</span></td>
        <td style="padding:8px 10px;font-size:12px;color:var(--nhs-grey);">${esc(r.category || '')}<br><span style="font-size:10px;">${esc(r.source || '')}</span></td>
        <td style="padding:8px 10px;max-width:340px;word-break:break-word;">${msg}${stackBtn}</td>
        <td style="padding:8px 10px;font-size:12px;">${actor}</td>
        <td style="padding:8px 10px;">${ctx}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    tableEl.innerHTML = html;
    const start = _errorLogState.page * _errorLogState.pageSize + 1;
    const end = Math.min(start + rows.length - 1, total);
    pagerEl.innerHTML = `
      <div>Showing ${start}–${end} of ${total}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline" ${_errorLogState.page === 0 ? 'disabled' : ''} onclick="_elPage(-1)" style="padding:4px 12px;font-size:12px;">← Prev</button>
        <button class="btn btn-outline" ${end >= total ? 'disabled' : ''} onclick="_elPage(1)" style="padding:4px 12px;font-size:12px;">Next →</button>
      </div>`;
  } catch(e) {
    tableEl.innerHTML = `<div style="padding:30px;text-align:center;color:var(--nhs-red);">Failed to load error log: ${esc(e.message)}</div>`;
  }
}

function _elPage(delta) {
  _errorLogState.page = Math.max(0, _errorLogState.page + delta);
  _elRefresh();
}

async function _elExportCsv() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/error_log?select=*&${_elQuery().replace(/limit=\d+/, 'limit=5000').replace(/offset=\d+/, 'offset=0')}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!rows.length) { showToast('Nothing to export'); return; }
    const cols = ['created_at','level','category','source','message','actor_type','actor_email','actor_id','url','user_agent','app_version','session_id','stack','context'];
    const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => {
      let v = r[c];
      if (v && typeof v === 'object') v = JSON.stringify(v);
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    }).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `error_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`Exported ${rows.length} log entries`);
  } catch (e) {
    showToast('Export failed: ' + e.message);
  }
}
