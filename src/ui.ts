export const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M365 Split Tunnel Automation</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #1a1a2e;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 1.5rem;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f97316;
    }

    .header p {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-top: 0.25rem;
    }

    /* Login */
    #login-view {
      max-width: 400px;
      margin: 4rem auto;
    }

    #login-view h2 {
      text-align: center;
      margin-bottom: 1rem;
      font-size: 1.25rem;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .login-form input {
      padding: 0.625rem 0.875rem;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      background: #0f172a;
      color: #e2e8f0;
      font-size: 0.9375rem;
      outline: none;
    }

    .login-form input:focus {
      border-color: #f97316;
    }

    .login-error {
      color: #f87171;
      font-size: 0.8125rem;
      text-align: center;
      min-height: 1.25rem;
    }

    /* Dashboard grid */
    #dashboard-view { display: none; }

    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      max-width: 960px;
      margin: 0 auto;
    }

    @media (min-width: 720px) {
      .cards {
        grid-template-columns: 1fr 1fr;
      }
      .card--preview {
        grid-column: 1 / -1;
      }
      .card--config {
        grid-column: 1 / -1;
      }
    }

    /* Card */
    .card {
      background: #16213e;
      border: 1px solid #1e293b;
      border-radius: 0.75rem;
      padding: 1.25rem;
    }

    .card h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.875rem;
      color: #f97316;
    }

    .card h3 {
      font-size: 0.875rem;
      font-weight: 600;
      margin: 0.875rem 0 0.5rem;
      color: #94a3b8;
    }

    /* Fields */
    .field {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.375rem 0;
      font-size: 0.875rem;
    }

    .field__label { color: #94a3b8; }

    .field__value {
      font-weight: 500;
      text-align: right;
      word-break: break-word;
    }

    /* Status badges */
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .badge--active  { background: #065f46; color: #6ee7b7; }
    .badge--paused  { background: #713f12; color: #fde047; }
    .badge--dryrun  { background: #1e3a5f; color: #93c5fd; }

    /* Error box */
    .error-box {
      background: #450a0a;
      border: 1px solid #7f1d1d;
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.8125rem;
    }

    .error-box__type {
      font-weight: 600;
      color: #f87171;
    }

    .error-box__msg {
      color: #fca5a5;
      margin-top: 0.25rem;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn--primary   { background: #f97316; color: #1a1a2e; }
    .btn--primary:hover:not(:disabled) { background: #fb923c; }

    .btn--secondary { background: #334155; color: #e2e8f0; }
    .btn--secondary:hover:not(:disabled) { background: #475569; }

    .btn--danger    { background: #991b1b; color: #fca5a5; }
    .btn--danger:hover:not(:disabled) { background: #b91c1c; }

    .btn--success   { background: #065f46; color: #6ee7b7; }
    .btn--success:hover:not(:disabled) { background: #047857; }

    .btn-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    /* Tables */
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .preview-table th {
      text-align: left;
      padding: 0.5rem 0.625rem;
      border-bottom: 1px solid #334155;
      color: #94a3b8;
      font-weight: 600;
    }

    .preview-table td {
      padding: 0.375rem 0.625rem;
      border-bottom: 1px solid #1e293b;
      word-break: break-all;
    }

    .preview-table tr:last-child td { border-bottom: none; }

    .type-tag {
      display: inline-block;
      padding: 0.0625rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .type-tag--address { background: #1e3a5f; color: #93c5fd; }
    .type-tag--host    { background: #3b1f5e; color: #c4b5fd; }

    /* Loading */
    .loading {
      color: #64748b;
      font-style: italic;
      font-size: 0.8125rem;
    }

    /* Empty state */
    .empty {
      color: #64748b;
      font-size: 0.8125rem;
      padding: 0.5rem 0;
    }

    .entries-scroll {
      max-height: 400px;
      overflow-y: auto;
      margin-top: 0.5rem;
    }

    /* Warning */
    .warning-box {
      background: #422006;
      border: 1px solid #78350f;
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.8125rem;
      color: #fde047;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>M365 Split Tunnel Automation</h1>
    <p>Cloudflare Zero Trust split tunnel EXCLUDE list sync</p>
  </div>

  <!-- Login View -->
  <div id="login-view">
    <h2>Authenticate</h2>
    <form class="login-form" id="login-form">
      <input
        type="password"
        id="login-token"
        placeholder="Webhook secret"
        autocomplete="off"
        required
      />
      <button type="submit" class="btn btn--primary" style="width:100%">Sign In</button>
      <div class="login-error" id="login-error"></div>
    </form>
  </div>

  <!-- Dashboard View -->
  <div id="dashboard-view">
    <div class="cards">
      <!-- Activity Card -->
      <div class="card">
        <h2>Activity</h2>
        <div id="activity-content">
          <div class="loading">Loading...</div>
        </div>
        <div class="btn-group">
          <button class="btn btn--secondary" id="btn-refresh-status">Refresh</button>
        </div>
      </div>

      <!-- Schedule Card -->
      <div class="card">
        <h2>Schedule</h2>
        <div id="schedule-content">
          <div class="loading">Loading...</div>
        </div>
        <div class="btn-group">
          <button class="btn btn--secondary" id="btn-toggle-pause">Pause</button>
          <button class="btn btn--primary" id="btn-force-sync">Force Sync Now</button>
          <button class="btn btn--danger" id="btn-remove-managed">Remove Managed</button>
        </div>
      </div>

      <!-- Preview Card -->
      <div class="card card--preview">
        <h2>Preview</h2>
        <div id="preview-content">
          <div class="empty">Click "Run Preview" to compare current state with latest M365 endpoints.</div>
        </div>
        <div class="btn-group">
          <button class="btn btn--primary" id="btn-preview">Run Preview</button>
        </div>
      </div>

      <!-- Current Configuration Card -->
      <div class="card card--config">
        <h2>Current Configuration</h2>
        <div id="config-content">
          <div class="empty">Click "Load Configuration" to view the current split tunnel exclude list.</div>
        </div>
        <div class="btn-group">
          <button class="btn btn--primary" id="btn-load-entries">Load Configuration</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      var TOKEN_KEY = "cfzt_token";
      var refreshTimer = null;

      // --- Helpers ---
      function getToken() {
        return sessionStorage.getItem(TOKEN_KEY);
      }

      function setToken(val) {
        sessionStorage.setItem(TOKEN_KEY, val);
      }

      function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
      }

      function authHeaders() {
        return { "Authorization": "Bearer " + getToken() };
      }

      function apiFetch(path, options) {
        var opts = options || {};
        var headers = Object.assign({}, authHeaders(), opts.headers || {});
        return fetch(path, Object.assign({}, opts, { headers: headers }))
          .then(function(res) {
            if (res.status === 401) {
              clearToken();
              showLogin();
              throw new Error("Unauthorized");
            }
            return res;
          });
      }

      function formatDate(iso) {
        if (!iso) return "Never";
        try {
          var d = new Date(iso);
          return d.toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
          });
        } catch (e) {
          return iso;
        }
      }

      function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      }

      // --- View switching ---
      function showLogin() {
        document.getElementById("login-view").style.display = "";
        document.getElementById("dashboard-view").style.display = "none";
        stopAutoRefresh();
      }

      function showDashboard() {
        document.getElementById("login-view").style.display = "none";
        document.getElementById("dashboard-view").style.display = "block";
        loadStatus();
        loadSchedule();
        startAutoRefresh();
      }

      // --- Login ---
      document.getElementById("login-form").addEventListener("submit", function(e) {
        e.preventDefault();
        var input = document.getElementById("login-token");
        var errEl = document.getElementById("login-error");
        var token = input.value.trim();
        if (!token) return;
        errEl.textContent = "";
        setToken(token);
        // Validate by fetching status
        apiFetch("/api/status")
          .then(function(res) {
            if (!res.ok) throw new Error("Invalid credentials");
            showDashboard();
          })
          .catch(function(err) {
            clearToken();
            errEl.textContent = err.message === "Unauthorized" ? "Invalid credentials" : err.message;
          });
      });

      // --- Activity card ---
      function loadStatus() {
        var container = document.getElementById("activity-content");
        container.innerHTML = '<div class="loading">Loading...</div>';
        apiFetch("/api/status")
          .then(function(res) { return res.json(); })
          .then(function(data) { renderActivity(container, data); })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              container.innerHTML = '<div class="error-box"><div class="error-box__msg">' + escapeHtml(err.message) + '</div></div>';
            }
          });
      }

      function renderActivity(container, state) {
        var summary = state.lastResultSummary;
        var html = "";

        html += '<div class="field"><span class="field__label">Last Synced</span><span class="field__value">' + formatDate(state.lastSyncedAt) + '</span></div>';
        html += '<div class="field"><span class="field__label">M365 Version</span><span class="field__value">' + escapeHtml(state.lastVersion || "-") + '</span></div>';

        if (summary) {
          html += '<div class="field"><span class="field__label">Candidates</span><span class="field__value">' + summary.candidates + '</span></div>';
          html += '<div class="field"><span class="field__label">Added</span><span class="field__value" style="color:#6ee7b7">' + summary.added + '</span></div>';
          html += '<div class="field"><span class="field__label">Removed</span><span class="field__value" style="color:#f87171">' + summary.removed + '</span></div>';
          if (summary.dryRun) {
            html += '<div style="margin-top:0.5rem"><span class="badge badge--dryrun">Dry Run</span></div>';
          }
        }

        if (state.lastError) {
          html += '<div class="error-box">';
          html += '<div class="error-box__type">' + escapeHtml(state.lastError.type || "Error") + '</div>';
          html += '<div class="error-box__msg">' + escapeHtml(state.lastError.message) + '</div>';
          html += '</div>';
        }

        container.innerHTML = html;
      }

      document.getElementById("btn-refresh-status").addEventListener("click", function() {
        loadStatus();
      });

      // --- Schedule card ---
      var currentPaused = false;

      function loadSchedule() {
        var container = document.getElementById("schedule-content");
        container.innerHTML = '<div class="loading">Loading...</div>';
        apiFetch("/api/schedule")
          .then(function(res) { return res.json(); })
          .then(function(data) { renderSchedule(container, data); })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              container.innerHTML = '<div class="error-box"><div class="error-box__msg">' + escapeHtml(err.message) + '</div></div>';
            }
          });
      }

      function renderSchedule(container, data) {
        currentPaused = !!data.paused;
        var html = "";

        html += '<div class="field"><span class="field__label">Cron</span><span class="field__value" style="font-family:monospace">' + escapeHtml(data.cron || "-") + '</span></div>';
        html += '<div class="field"><span class="field__label">Description</span><span class="field__value">' + escapeHtml(data.description || "-") + '</span></div>';
        html += '<div class="field"><span class="field__label">State</span><span class="field__value">';
        html += currentPaused ? '<span class="badge badge--paused">Paused</span>' : '<span class="badge badge--active">Active</span>';
        html += '</span></div>';

        container.innerHTML = html;
        updatePauseButton();
      }

      function updatePauseButton() {
        var btn = document.getElementById("btn-toggle-pause");
        if (currentPaused) {
          btn.textContent = "Resume";
          btn.className = "btn btn--success";
        } else {
          btn.textContent = "Pause";
          btn.className = "btn btn--danger";
        }
      }

      document.getElementById("btn-toggle-pause").addEventListener("click", function() {
        var btn = document.getElementById("btn-toggle-pause");
        btn.disabled = true;
        apiFetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: !currentPaused })
        })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            renderSchedule(document.getElementById("schedule-content"), data);
          })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              alert("Failed to toggle schedule: " + err.message);
            }
          })
          .finally(function() { btn.disabled = false; });
      });

      document.getElementById("btn-force-sync").addEventListener("click", function() {
        var btn = document.getElementById("btn-force-sync");
        btn.disabled = true;
        btn.textContent = "Syncing...";
        apiFetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true })
        })
          .then(function(res) { return res.json(); })
          .then(function() {
            loadStatus();
          })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              alert("Sync failed: " + err.message);
            }
          })
          .finally(function() {
            btn.disabled = false;
            btn.textContent = "Force Sync Now";
          });
      });

      document.getElementById("btn-remove-managed").addEventListener("click", function() {
        var btn = document.getElementById("btn-remove-managed");
        if (!confirm("This will remove all M365-managed entries from the split tunnel exclude list. Preserved entries will be kept. Continue?")) return;
        btn.disabled = true;
        apiFetch("/api/managed", {
          method: "DELETE"
        })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            alert("Removed " + data.removed + " managed entries. " + data.preserved + " preserved entries remain.");
            loadStatus();
          })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              alert("Remove failed: " + err.message);
            }
          })
          .finally(function() {
            btn.disabled = false;
          });
      });

      // --- Preview card ---
      document.getElementById("btn-preview").addEventListener("click", function() {
        var btn = document.getElementById("btn-preview");
        var container = document.getElementById("preview-content");
        btn.disabled = true;
        container.innerHTML = '<div class="loading">Fetching preview...</div>';

        apiFetch("/api/preview")
          .then(function(res) { return res.json(); })
          .then(function(data) { renderPreview(container, data); })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              container.innerHTML = '<div class="error-box"><div class="error-box__msg">' + escapeHtml(err.message) + '</div></div>';
            }
          })
          .finally(function() { btn.disabled = false; });
      });

      function renderPreview(container, data) {
        var html = "";

        html += '<div class="field"><span class="field__label">Version</span><span class="field__value">' + escapeHtml(data.version || "-") + '</span></div>';
        html += '<div class="field"><span class="field__label">Candidates</span><span class="field__value">' + (data.candidates || 0) + '</span></div>';
        html += '<div class="field"><span class="field__label">Total After Merge</span><span class="field__value">' + (data.totalAfter || 0) + '</span></div>';

        if (data.versionWarning) {
          html += '<div class="warning-box">' + escapeHtml(data.versionWarning) + '</div>';
        }

        // Added entries
        html += '<h3>Added (' + (data.added ? data.added.length : 0) + ')</h3>';
        if (data.added && data.added.length > 0) {
          html += '<table class="preview-table"><thead><tr><th>Key</th><th>Type</th><th>Description</th></tr></thead><tbody>';
          for (var i = 0; i < data.added.length; i++) {
            var e = data.added[i];
            html += '<tr>';
            html += '<td>' + escapeHtml(e.key) + '</td>';
            html += '<td><span class="type-tag type-tag--' + escapeHtml(e.type) + '">' + escapeHtml(e.type) + '</span></td>';
            html += '<td>' + escapeHtml(e.description || "") + '</td>';
            html += '</tr>';
          }
          html += '</tbody></table>';
        } else {
          html += '<div class="empty">No additions</div>';
        }

        // Removed entries
        html += '<h3>Removed (' + (data.removed ? data.removed.length : 0) + ')</h3>';
        if (data.removed && data.removed.length > 0) {
          html += '<table class="preview-table"><thead><tr><th>Key</th><th>Type</th><th>Description</th></tr></thead><tbody>';
          for (var j = 0; j < data.removed.length; j++) {
            var r = data.removed[j];
            html += '<tr>';
            html += '<td>' + escapeHtml(r.key) + '</td>';
            html += '<td><span class="type-tag type-tag--' + escapeHtml(r.type) + '">' + escapeHtml(r.type) + '</span></td>';
            html += '<td>' + escapeHtml(r.description || "") + '</td>';
            html += '</tr>';
          }
          html += '</tbody></table>';
        } else {
          html += '<div class="empty">No removals</div>';
        }

        container.innerHTML = html;
      }

      // --- Current Configuration card ---
      document.getElementById("btn-load-entries").addEventListener("click", function() {
        var btn = document.getElementById("btn-load-entries");
        var container = document.getElementById("config-content");
        btn.disabled = true;
        container.innerHTML = '<div class="loading">Loading configuration...</div>';

        apiFetch("/api/entries")
          .then(function(res) { return res.json(); })
          .then(function(data) { renderConfig(container, data); })
          .catch(function(err) {
            if (err.message !== "Unauthorized") {
              container.innerHTML = '<div class="error-box"><div class="error-box__msg">' + escapeHtml(err.message) + '</div></div>';
            }
          })
          .finally(function() { btn.disabled = false; });
      });

      function renderConfig(container, data) {
        var html = "";

        html += '<div class="field"><span class="field__label">Total</span><span class="field__value">' + data.totalCount + ' (M365-managed: ' + data.managedCount + ', Preserved: ' + data.preservedCount + ')</span></div>';

        // Managed entries
        html += '<h3>Managed Entries (' + data.managedCount + ')</h3>';
        if (data.managed && data.managed.length > 0) {
          html += '<div class="entries-scroll"><table class="preview-table"><thead><tr><th>Address/Host</th><th>Type</th><th>Description</th></tr></thead><tbody>';
          for (var i = 0; i < data.managed.length; i++) {
            var e = data.managed[i];
            var key = e.address || e.host;
            var type = e.address ? "address" : "host";
            html += '<tr>';
            html += '<td>' + escapeHtml(key) + '</td>';
            html += '<td><span class="type-tag type-tag--' + escapeHtml(type) + '">' + escapeHtml(type) + '</span></td>';
            html += '<td>' + escapeHtml(e.description || "") + '</td>';
            html += '</tr>';
          }
          html += '</tbody></table></div>';
        } else {
          html += '<div class="empty">No entries</div>';
        }

        // Preserved entries
        html += '<h3>Preserved Entries (' + data.preservedCount + ')</h3>';
        if (data.preserved && data.preserved.length > 0) {
          html += '<div class="entries-scroll"><table class="preview-table"><thead><tr><th>Address/Host</th><th>Type</th><th>Description</th></tr></thead><tbody>';
          for (var j = 0; j < data.preserved.length; j++) {
            var p = data.preserved[j];
            var pkey = p.address || p.host;
            var ptype = p.address ? "address" : "host";
            html += '<tr>';
            html += '<td>' + escapeHtml(pkey) + '</td>';
            html += '<td><span class="type-tag type-tag--' + escapeHtml(ptype) + '">' + escapeHtml(ptype) + '</span></td>';
            html += '<td>' + escapeHtml(p.description || "") + '</td>';
            html += '</tr>';
          }
          html += '</tbody></table></div>';
        } else {
          html += '<div class="empty">No entries</div>';
        }

        container.innerHTML = html;
      }

      // --- Auto-refresh ---
      function startAutoRefresh() {
        stopAutoRefresh();
        refreshTimer = setInterval(function() {
          loadStatus();
          loadSchedule();
        }, 60000);
      }

      function stopAutoRefresh() {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
      }

      // --- Init ---
      if (getToken()) {
        showDashboard();
      } else {
        showLogin();
      }
    })();
  </script>
</body>
</html>`;
