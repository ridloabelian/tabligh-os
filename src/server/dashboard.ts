/**
 * Renders the Editorial Dark-First Control Plane HTML (`#08101F` Deep Navy,
 * `#0C172E` Elevated Surface, `#C19F65` Warm Gold, `#298D6B` Emerald) using
 * Plus Jakarta Sans & JetBrains Mono typography.
 */
export function renderDashboardHtml(options: { demoMode: boolean; port: number }): string {
  const modeLabel = options.demoMode ? "DEMO SANDBOX · IN-MEMORY" : "LIVE CONTROL PLANE";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>tabligh-os — Agentic Omnichannel Publishing Control Plane</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-navy: #08101F;
      --surface: #0C172E;
      --surface-alt: #10203D;
      --border: #1C2E52;
      --gold: #C19F65;
      --gold-soft: rgba(193, 159, 101, 0.14);
      --emerald: #298D6B;
      --emerald-soft: rgba(41, 141, 107, 0.16);
      --amber: #D99B3B;
      --red: #D9534F;
      --sky: #5BA4E6;
      --text-main: #EDF2FB;
      --text-muted: #93A6C8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at top right, #10203F 0%, var(--bg-navy) 55%);
      color: var(--text-main);
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.5;
      min-height: 100vh;
    }
    code, pre, .mono {
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
    }
    .container {
      max-width: 1380px;
      margin: 0 auto;
      padding: 24px 20px 64px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--gold), #8C6E3B);
      color: #08101F;
      font-weight: 700;
      display: grid;
      place-items: center;
      font-size: 16px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 2px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      background: var(--surface-alt);
      color: var(--gold);
    }
    .btn {
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--surface-alt);
      color: var(--text-main);
      padding: 8px 14px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.15s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { border-color: var(--gold); transform: translateY(-1px); }
    .btn-primary {
      background: var(--emerald);
      border-color: var(--emerald);
      color: #FFFFFF;
    }
    .btn-gold {
      background: var(--gold);
      border-color: var(--gold);
      color: #08101F;
    }
    .btn-danger {
      background: rgba(217, 83, 79, 0.14);
      border-color: rgba(217, 83, 79, 0.45);
      color: #FFB6B4;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 18px;
    }
    .kpi-label {
      color: var(--text-muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      margin-top: 6px;
      color: var(--text-main);
    }
    .kpi-card.highlight { border-color: rgba(193, 159, 101, 0.55); background: linear-gradient(180deg, rgba(193, 159, 101, 0.08), var(--surface)); }
    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 22px;
    }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .section-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-note {
      font-size: 13px;
      color: var(--text-muted);
    }
    .approval-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
    }
    .approval-card {
      background: var(--surface-alt);
      border: 1px solid rgba(193, 159, 101, 0.45);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .approval-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .caption-box {
      background: #070E1C;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      color: #D9E4F7;
      white-space: pre-wrap;
      max-height: 150px;
      overflow-y: auto;
    }
    .input-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    input[type="text"], select {
      background: #070E1C;
      border: 1px solid var(--border);
      color: var(--text-main);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      font-family: inherit;
      flex: 1;
      min-width: 180px;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th, td {
      text-align: left;
      padding: 10px 10px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      font-family: "JetBrains Mono", monospace;
    }
    .st-PUBLISHED { background: var(--emerald-soft); color: #67E2B6; border: 1px solid rgba(41, 141, 107, 0.5); }
    .st-PENDING_HUMAN_CLICK { background: var(--gold-soft); color: #F1CF8E; border: 1px solid rgba(193, 159, 101, 0.55); }
    .st-SCHEDULED { background: rgba(91, 164, 230, 0.14); color: #9BD0FF; border: 1px solid rgba(91, 164, 230, 0.45); }
    .st-VALIDATED, .st-PLANNED { background: rgba(147, 166, 200, 0.14); color: #C5D2EA; border: 1px solid rgba(147, 166, 200, 0.35); }
    .st-UPLOADING { background: rgba(217, 155, 59, 0.18); color: #FFD089; }
    .st-FAILED { background: rgba(217, 83, 79, 0.18); color: #FFB2AF; border: 1px solid rgba(217, 83, 79, 0.5); }
    .doctor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }
    .doctor-item {
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .dot-ready { color: #67E2B6; }
    .dot-missing { color: var(--gold); }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--surface-alt);
      border: 1px solid var(--gold);
      color: var(--text-main);
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
      display: none;
      z-index: 50;
    }
    a.ext-link { color: var(--gold); text-decoration: none; font-size: 11px; }
    a.ext-link:hover { text-decoration: underline; }
    .two-col {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
    }
    @media (max-width: 980px) {
      .two-col { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-title">
        <div class="brand-mark">T</div>
        <div>
          <h1>tabligh-os <span class="mono" style="color:var(--gold);font-size:13px;">:${options.port}</span></h1>
          <p class="subtitle">Agentic Omnichannel Content Distribution · Pilar 4 Tabligh (Bi qadri 'uqulihim) · Hybrid Dual-Transport + Physical Approval Gate</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="pill" id="mode-pill">${modeLabel}</span>
        <button class="btn btn-gold" onclick="runQueue(null, true)">Run Pending Dry-Run</button>
        <button class="btn" onclick="refreshAll()">Refresh</button>
      </div>
    </header>

    <div class="kpi-grid" id="kpi-grid"></div>

    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Human Approval Queue <span class="pill">Siap Klik Publish</span></h2>
          <div class="section-note">TikTok Web & IG Trending Audio berhenti wajib di <code>PENDING_HUMAN_CLICK</code>. Salin paket, klik Publish di studio browser Anda, lalu konfirmasi di sini.</div>
        </div>
      </div>
      <div class="approval-grid" id="approval-queue"></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Episode × 8-Channel Release Matrix</h2>
          <div class="section-note">Pantau status terbit, link tayang live, dan jalankan simulasi per episode lintas 8 kanal (YouTube, IG, TikTok, X, LinkedIn, Threads, WA Channel, EmDash).</div>
        </div>
      </div>
      <div class="table-wrap" id="matrix-wrap"></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">8-Channel Distribution Queue & edge-funnel Attribution</h2>
          <div class="section-note">Setiap link keluar disuntik parameter <code>utm_source</code>, <code>utm_medium=social</code>, <code>utm_campaign</code>, dan <code>ef_ep</code> + dijaga SHA-256 idempotency hash.</div>
        </div>
        <div class="input-row" style="flex:0 0 auto;">
          <select id="filter-platform" onchange="renderQueueTable()">
            <option value="">All Channels</option>
          </select>
          <select id="filter-status" onchange="renderQueueTable()">
            <option value="">All Statuses</option>
            <option value="PENDING_HUMAN_CLICK">PENDING_HUMAN_CLICK</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="VALIDATED">VALIDATED</option>
            <option value="PLANNED">PLANNED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>
      <div class="table-wrap" id="queue-wrap"></div>
    </section>

    <div class="two-col">
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">Integrations, Webhook & CDP Healthcheck</h2>
            <div class="section-note" id="doctor-summary">Checking environment...</div>
          </div>
        </div>
        <div class="doctor-grid" id="doctor-grid"></div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">waflare & Telegram Status Logs</h2>
            <div class="section-note">Notifikasi kartu rilis terbaru ke WhatsApp & Telegram Bot API.</div>
          </div>
        </div>
        <div id="notifications-wrap"></div>
      </section>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let STATE = null;

    function showToast(msg) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(() => { el.style.display = "none"; }, 3400);
    }

    function esc(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    async function refreshAll() {
      const [ovRes, docRes] = await Promise.all([
        fetch("/api/overview"),
        fetch("/api/doctor")
      ]);
      STATE = await ovRes.json();
      const doctor = await docRes.json();
      populateFilterOptions();
      renderKpis();
      renderApprovalQueue();
      renderMatrix();
      renderQueueTable();
      renderDoctor(doctor);
      renderNotifications();
    }

    function populateFilterOptions() {
      const sel = document.getElementById("filter-platform");
      if (sel.options.length > 1 || !STATE) return;
      for (const p of STATE.platforms) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.label;
        sel.appendChild(opt);
      }
    }

    function renderKpis() {
      const s = STATE.stats;
      const cards = [
        { label: "Total Episodes", value: s.episodesCount, cls: "" },
        { label: "Published Live", value: s.byStatus.PUBLISHED || 0, cls: "" },
        { label: "Scheduled (API)", value: s.byStatus.SCHEDULED || 0, cls: "" },
        { label: "Human Approval Queue", value: s.byStatus.PENDING_HUMAN_CLICK || 0, cls: "highlight" },
        { label: "Queued / Validated", value: (s.byStatus.VALIDATED || 0) + (s.byStatus.PLANNED || 0), cls: "" },
        { label: "Failed", value: s.byStatus.FAILED || 0, cls: "" }
      ];
      document.getElementById("kpi-grid").innerHTML = cards.map((c) => \`
        <div class="kpi-card \${c.cls}">
          <div class="kpi-label">\${esc(c.label)}</div>
          <div class="kpi-value">\${c.value}</div>
        </div>
      \`).join("");
    }

    function buildCopyText(job) {
      let payload = {};
      try { payload = JSON.parse(job.payloadJson); } catch {}
      const tags = Array.isArray(payload.tags) && payload.tags.length
        ? "\\n\\n" + payload.tags.map((t) => t.startsWith("#") ? t : "#" + t).join(" ")
        : "";
      return (payload.body || "") + tags;
    }

    async function copyJobCaption(jobId) {
      const job = STATE.jobs.find((j) => j.id === jobId);
      if (!job) return;
      const text = buildCopyText(job);
      try {
        await navigator.clipboard.writeText(text);
        showToast("Caption & tags disalin untuk " + job.platform + "!");
      } catch {
        showToast("Clipboard tidak tersedia; salin langsung dari kotak teks.");
      }
    }

    async function markJob(episodeId, platform, format, status) {
      const inputEl = document.getElementById("url-" + episodeId + "-" + platform + "-" + format);
      const url = inputEl ? inputEl.value.trim() : "";
      const res = await fetch(\`/api/episodes/\${encodeURIComponent(episodeId)}/platforms/\${encodeURIComponent(platform)}/mark\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, url: url || undefined, format })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("Error: " + (data.error || "Gagal memperbarui status"));
        return;
      }
      showToast(\`\${platform} ditandai \${status}\`);
      await refreshAll();
    }

    async function runQueue(episodeId, dryRun) {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ episodeId: episodeId || undefined, dryRun })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("Error runner: " + (data.error || "Unknown error"));
        return;
      }
      showToast(\`Runner selesai: \${data.summary.processedCount} job diproses (dryRun=\${dryRun})\`);
      await refreshAll();
    }

    function renderApprovalQueue() {
      const items = STATE.approvalQueue;
      const wrap = document.getElementById("approval-queue");
      if (!items.length) {
        wrap.innerHTML = '<div class="section-note">Semua platform Human-in-the-Loop telah selesai diklik Publish. Tidak ada antrean tertunda.</div>';
        return;
      }
      wrap.innerHTML = items.map((job) => {
        const ep = STATE.episodes.find((e) => e.episodeId === job.episodeId);
        const caption = buildCopyText(job);
        const inputId = \`url-\${job.episodeId}-\${job.platform}-\${job.format}\`;
        const placeholderUrl = job.platform === "tiktok"
          ? "https://www.tiktok.com/@ridloabelian/video/..."
          : "https://www.instagram.com/reel/...";
        return \`
          <div class="approval-card">
            <div class="approval-top">
              <div>
                <div class="mono" style="font-size:11px;color:var(--gold);">\${esc(job.episodeId)}</div>
                <div style="font-weight:700;font-size:14px;margin-top:2px;">\${esc(ep ? ep.title : job.episodeId)}</div>
              </div>
              <span class="badge st-PENDING_HUMAN_CLICK">\${esc(job.platform)} · \${esc(job.format)}</span>
            </div>
            <div class="caption-box mono">\${esc(caption)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button class="btn btn-gold" onclick="copyJobCaption(\${job.id})">1-Click Copy Caption & Tags</button>
              \${job.studioUrl ? \`<a class="btn" href="\${esc(job.studioUrl)}" target="_blank" rel="noreferrer">Open Studio Upload ↗</a>\` : ""}
            </div>
            \${job.stagingPath ? \`<div class="mono" style="font-size:11px;color:var(--text-muted);">Packet: \${esc(job.stagingPath)}</div>\` : ""}
            <div class="input-row">
              <input type="text" id="\${esc(inputId)}" placeholder="Paste URL tayang (\${placeholderUrl})" />
              <button class="btn btn-primary" onclick="markJob('\${esc(job.episodeId)}','\${esc(job.platform)}','\${esc(job.format)}','PUBLISHED')">Mark Published</button>
              <button class="btn btn-danger" onclick="markJob('\${esc(job.episodeId)}','\${esc(job.platform)}','\${esc(job.format)}','FAILED')">Fail</button>
            </div>
          </div>
        \`;
      }).join("");
    }

    function renderMatrix() {
      const platforms = STATE.platforms;
      const headCols = platforms.map((p) => \`<th>\${esc(p.label)}</th>\`).join("");
      const rows = STATE.episodes.map((ep) => {
        const epJobs = STATE.jobs.filter((j) => j.episodeId === ep.episodeId);
        const cells = platforms.map((p) => {
          const matches = epJobs.filter((j) => j.platform === p.id);
          if (!matches.length) return '<td style="color:var(--text-muted);">—</td>';
          return "<td>" + matches.map((m) => \`
            <div style="margin-bottom:4px;">
              <span class="badge st-\${esc(m.status)}">\${esc(m.status)}</span>
              <div class="mono" style="font-size:10px;color:var(--text-muted);margin-top:2px;">\${esc(m.format)} · \${m.transport === "cdp_draft" ? "CDP" : "API"}</div>
              \${m.publishedUrl ? \`<div><a class="ext-link" href="\${esc(m.publishedUrl)}" target="_blank" rel="noreferrer">Link Tayang ↗</a></div>\` : ""}
            </div>
          \`).join("") + "</td>";
        }).join("");
        return \`
          <tr>
            <td style="min-width:220px;">
              <div style="font-weight:700;">\${esc(ep.title)}</div>
              <div class="mono" style="font-size:11px;color:var(--gold);margin-top:2px;">\${esc(ep.episodeId)}</div>
              <div style="margin-top:6px;">
                <button class="btn" style="padding:4px 9px;font-size:11px;" onclick="runQueue('\${esc(ep.episodeId)}', true)">Run Dry-Run</button>
              </div>
            </td>
            \${cells}
          </tr>
        \`;
      }).join("");

      document.getElementById("matrix-wrap").innerHTML = \`
        <table>
          <thead><tr><th>Episode</th>\${headCols}</tr></thead>
          <tbody>\${rows}</tbody>
        </table>
      \`;
    }

    function renderQueueTable() {
      const pFilter = document.getElementById("filter-platform").value;
      const sFilter = document.getElementById("filter-status").value;
      const filtered = STATE.jobs.filter((j) =>
        (!pFilter || j.platform === pFilter) && (!sFilter || j.status === sFilter)
      );
      const rows = filtered.map((j) => {
        let payload = {};
        try { payload = JSON.parse(j.payloadJson); } catch {}
        return \`
          <tr>
            <td class="mono">\${esc(j.episodeId)}</td>
            <td><strong>\${esc(j.platform)}</strong> <span class="mono" style="color:var(--text-muted);">(\${esc(j.format)})</span></td>
            <td class="mono">\${j.transport === "cdp_draft" ? "CDP DRAFT · HUMAN GATE" : "OFFICIAL API"}</td>
            <td><span class="badge st-\${esc(j.status)}">\${esc(j.status)}</span></td>
            <td class="mono" style="font-size:11px;">\${esc(j.scheduledAt || "Immediate")}</td>
            <td class="mono" style="font-size:11px;color:var(--text-muted);">\${esc(j.contentHash.slice(0, 12))}</td>
            <td style="max-width:260px;word-break:break-all;">
              \${payload.ctaUrl ? \`<a class="ext-link mono" href="\${esc(payload.ctaUrl)}" target="_blank" rel="noreferrer">ef_ep=\${esc(j.episodeId)}</a>\` : "—"}
            </td>
          </tr>
        \`;
      }).join("");
      document.getElementById("queue-wrap").innerHTML = \`
        <table>
          <thead>
            <tr>
              <th>Episode</th>
              <th>Channel</th>
              <th>Transport</th>
              <th>Status</th>
              <th>Schedule</th>
              <th>SHA-256 Guard</th>
              <th>edge-funnel Link</th>
            </tr>
          </thead>
          <tbody>\${rows}</tbody>
        </table>
      \`;
    }

    function renderDoctor(doc) {
      document.getElementById("doctor-summary").textContent =
        \`OS: \${doc.osPlatform} · Supervisor: \${doc.serviceSupervisor} · \${doc.readyCount}/\${doc.totalCount} checks ready\`;
      document.getElementById("doctor-grid").innerHTML = doc.checks.map((c) => {
        const isGood = c.status === "ready" || c.status === "reachable";
        return \`
          <div class="doctor-item">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <strong style="font-size:13px;">\${esc(c.label)}</strong>
              <span class="mono \${isGood ? "dot-ready" : "dot-missing"}" style="font-size:11px;">● \${esc(c.status.toUpperCase())}</span>
            </div>
            <div class="mono" style="font-size:11px;color:var(--text-muted);margin-top:6px;word-break:break-word;">\${esc(c.detail)}</div>
          </div>
        \`;
      }).join("");
    }

    function renderNotifications() {
      const logs = STATE.notifications;
      const wrap = document.getElementById("notifications-wrap");
      if (!logs.length) {
        wrap.innerHTML = '<div class="section-note">Belum ada log notifikasi.</div>';
        return;
      }
      wrap.innerHTML = logs.map((n) => \`
        <div class="doctor-item" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge st-\${n.status === "sent" ? "PUBLISHED" : n.status === "failed" ? "FAILED" : "PLANNED"}">\${esc(n.channel.toUpperCase())} · \${esc(n.status.toUpperCase())}</span>
            <span class="mono" style="font-size:11px;color:var(--text-muted);">\${esc(n.episodeId)}</span>
          </div>
          <div style="font-size:12px;margin-top:6px;white-space:pre-wrap;color:#D6E2F5;">\${esc(n.summary)}</div>
        </div>
      \`).join("");
    }

    refreshAll();
  </script>
</body>
</html>`;
}
