# M365 Split Tunnel Automation

A Cloudflare Worker that automatically syncs Microsoft 365 IP and FQDN endpoints into a Cloudflare Zero Trust device profile's Split Tunnel EXCLUDE list, keeping the list current as Microsoft publishes endpoint changes.

## What this Worker provides

This Worker gives you control over how Microsoft 365 endpoints are managed in your Cloudflare Zero Trust split tunnel configuration. It supports:

- **Custom profile targeting.** Select any device profile via the `CF_POLICY_ID` environment variable, including custom profiles used by specific user groups or device types.
- **Entry preservation.** Uses tag-based reconciliation to keep manually-added or third-party entries intact while replacing only the entries it manages.
- **Fine-grained filtering.** Include only the endpoints relevant to your organization by filtering Microsoft service area (Exchange, SharePoint, Skype) or category (Optimize, Allow, Default) via `M365_SERVICES` and `M365_CATEGORIES`.
- **FQDN and wildcard support.** Includes both IP addresses and domain entries with wildcard support (e.g., `*.sharepoint.com`) for more precise split tunnel control.
- **Web dashboard.** Built-in UI at `/` for monitoring sync activity, controlling the schedule, and triggering on-demand syncs.
- **Observability.** Exposes `/api/status`, `/api/preview`, structured logging, and last-error tracking in KV for visibility into sync operations.
- **On-demand sync.** Supports daily cron scheduling plus immediate updates outside the schedule via `POST /api/sync`.

> **Alternative approach:** Microsoft recommends an alternative where M365 traffic is sent through the tunnel but [inspection is bypassed](https://developers.cloudflare.com/cloudflare-one/traffic-policies/application-app-types/#microsoft-365-integration), rather than excluding it from the tunnel entirely.

## How it works

1. A cron trigger runs daily (default: 06:17 UTC).
2. The Worker checks the M365 version endpoint to see if endpoint data has changed since the last sync.
3. If the version is new, it fetches the full endpoint set from Microsoft, filtered by the configured service areas and categories.
4. Endpoints are transformed into Cloudflare split tunnel entries (IPs become `address` entries, FQDNs become `host` entries) and deduplicated.
5. The Worker fetches the current split tunnel list from the Cloudflare API and partitions entries into "managed" (description starts with `[m365-auto]`) and "preserved" (everything else).
6. Managed entries are replaced with the latest M365 data. Preserved entries are kept verbatim.
7. The merged list is PUT back to the Cloudflare API. Because the API requires a full replacement, the reconciliation step ensures no data loss.

Tag-based ownership uses the `[m365-auto]` prefix in entry descriptions (configurable via `MANAGED_TAG`).

## Setup

1. Clone the repo:
   ```bash
   git clone <repo-url> split-tunnel-automation
   cd split-tunnel-automation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the KV namespace for state storage:
   ```bash
   npx wrangler kv namespace create STATE
   ```
   Copy the `id` from the output and update the `kv_namespaces` entry in `wrangler.jsonc`.

4. Generate TypeScript types from your Wrangler config:
   ```bash
   npm run cf-typegen
   ```
   Re-run this command whenever you change `wrangler.jsonc`.

5. Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder values with your own:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

6. Test locally:
   ```bash
   npm run dev
   ```
   Then in another terminal:
   ```bash
   curl http://localhost:8787/healthz
   ```

7. Preview the diff (auth bypassed in local dev with `ACCESS_POLICY_AUD=dev`):
     ```bash
     curl http://localhost:8787/api/preview
     ```

8. Set production secrets:
    ```bash
    npx wrangler secret put CF_API_TOKEN
    ```

9. Configure Cloudflare Access:
    - Create a Self-hosted Access application for the Worker's hostname
    - Note the Application AUD tag
    - Set `ACCESS_TEAM_DOMAIN` and `ACCESS_POLICY_AUD` via the Cloudflare dashboard (**Workers & Pages > split-tunnel-automation > Settings > Variables and Secrets**) or at deploy time with `--var`

10. Set production variables via the Cloudflare dashboard (**Workers & Pages > split-tunnel-automation > Settings > Variables and Secrets**) or at deploy time with `--var`:
    ```bash
    npx wrangler deploy --keep-vars --var CF_ACCOUNT_ID:your_account_id --var CF_POLICY_ID:your_policy_id
    ```
    The `--keep-vars` flag ensures that dashboard-set variables are not overwritten on subsequent deploys. The `npm run deploy` script includes `--keep-vars` by default.

11. First deploy with `DRY_RUN` set to `"true"` (via dashboard or `--var DRY_RUN:true`) to validate without writing changes:
    ```bash
    npm run deploy
    ```

12. After validating logs and confirming the diff looks correct, set `DRY_RUN` to `"false"` (via dashboard or `--var DRY_RUN:false`) and redeploy:
    ```bash
    npm run deploy
    ```

## Configuration

| Name | Default | Required | Description |
|------|---------|----------|-------------|
| `CF_ACCOUNT_ID` | (none) | Yes | Cloudflare account ID |
| `CF_POLICY_ID` | (empty) | No | Split tunnel policy ID. When empty, targets the default device profile |
| `M365_INSTANCE` | `Worldwide` | No | M365 cloud instance. Options: `Worldwide`, `China`, `USGovDoD`, `USGovGCCHigh` |
| `M365_SERVICES` | `all` | No | Comma-separated service areas to include, or `all` for no filter. Options: `Exchange`, `SharePoint`, `Skype`. The `Common` service area is always included regardless of this setting, as Common endpoints are shared dependencies required by all M365 services |
| `M365_CATEGORIES` | `Optimize,Allow` | No | Comma-separated categories to include. Options: `Optimize`, `Allow`, `Default` |
| `INCLUDE_IPV6` | `true` | No | Whether to include IPv6 addresses in split tunnel entries |
| `INCLUDE_URLS` | `true` | No | Whether to include URL/host entries in split tunnel entries |
| `MANAGED_TAG` | `[m365-auto]` | No | Tag prefix used in entry descriptions to identify entries managed by this Worker |
| `DRY_RUN` | `false` | No | When `true`, compute changes but do not apply them to the Cloudflare API |
| `MAX_ENTRIES` | `1000` | No | Maximum number of entries per split tunnel list. Sync is aborted if the merged list would exceed this limit |
| `CF_API_TOKEN` | (none) | Yes (secret) | Cloudflare API token with Zero Trust edit permissions |
| `ACCESS_TEAM_DOMAIN` | (none) | Yes | Cloudflare Access team domain URL (e.g. `https://your-team.cloudflareaccess.com`) |
| `ACCESS_POLICY_AUD` | (none) | Yes | Cloudflare Access application AUD tag. Set to `dev` to bypass auth in local development |
| `CRON_EXPRESSION` | `17 6 * * *` | No | Cron expression displayed in the dashboard. Must match the `triggers.crons` value in `wrangler.jsonc` |
| `CRON_DESCRIPTION` | `Daily at 06:17 UTC` | No | Human-readable description of the schedule, displayed in the dashboard |

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | No | Web dashboard (embedded HTML UI) |
| GET | `/healthz` | No | Liveness check. Returns `200 OK` with a simple status body |
| GET | `/api/status` | Yes | Last sync metadata, including version, timestamp, result summary, and last error |
| GET | `/api/preview` | Yes | Dry-run diff of what would change on the next sync, without writing anything |
| POST | `/api/sync` | Yes | Trigger an immediate sync |
| GET | `/api/schedule` | Yes | Current schedule state: cron expression, description, and paused flag |
| DELETE | `/api/managed` | Yes | Remove all M365-managed entries from the split tunnel exclude list, preserving non-managed entries |
| GET | `/api/entries` | Yes | Fetch the current split tunnel exclude list, partitioned into managed and preserved entries |
| POST | `/api/schedule` | Yes | Update the schedule pause state |

All authenticated endpoints require a valid Cloudflare Access JWT, passed via the `cf-access-jwt-assertion` header. Access sets this automatically for browser users (via the `CF_Authorization` cookie) and for API callers using service tokens (Access injects the header after validating `CF-Access-Client-Id`/`CF-Access-Client-Secret`).

### Cloudflare Access Setup

1. In the Cloudflare Zero Trust dashboard, create a new **Self-hosted** Access application for your Worker's hostname (e.g. `your-worker.your-account.workers.dev`).
2. Note the **Application AUD** tag from the application settings.
3. Set the `ACCESS_TEAM_DOMAIN` environment variable to your team domain (e.g. `https://your-team.cloudflareaccess.com`).
4. Set the `ACCESS_POLICY_AUD` environment variable to the AUD tag from step 2.
5. Create an Access policy that allows the appropriate users or groups.

For API access from automated systems, create a **Service Token** in Zero Trust > Access > Service Auth > Service Tokens, then add a **Service Auth** policy to the same Access application that accepts that token. When calling the API, include the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers. Access validates these at the edge and injects the JWT header before forwarding to the Worker.

> **Important:** Attach the Service Auth policy to the *existing* Access application, not a separate one. Creating a separate application for the same hostname can cause conflicts.

### Local Development

For local development, set both `ACCESS_TEAM_DOMAIN` and `ACCESS_POLICY_AUD` to `dev` in your `.dev.vars` file. This bypasses JWT verification entirely. **Never use the `dev` sentinel in production.**

### Examples

```bash
# Health check (no auth)
curl http://localhost:8787/healthz

# Check last sync status (using Access service token)
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
     http://localhost:8787/api/status

# Preview the diff without applying changes
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
     http://localhost:8787/api/preview

# Trigger an immediate sync
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
             -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
             http://localhost:8787/api/sync

# Force sync, skipping version check
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
             -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
             -H "Content-Type: application/json" \
             -d '{"force": true}' \
             http://localhost:8787/api/sync

# Check schedule state
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
     http://localhost:8787/api/schedule

# Pause the scheduled sync
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
             -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
             -H "Content-Type: application/json" \
             -d '{"paused": true}' \
             http://localhost:8787/api/schedule

# Resume the scheduled sync
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
             -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
             -H "Content-Type: application/json" \
             -d '{"paused": false}' \
             http://localhost:8787/api/schedule

# Remove all M365-managed entries (preserved entries are kept)
curl -X DELETE -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
               -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
               http://localhost:8787/api/managed

# Fetch the current split tunnel exclude list
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
     http://localhost:8787/api/entries
```

### POST /api/sync body

The optional JSON body supports:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `force` | boolean | `false` | When `true`, skips the M365 version check and always fetches and applies the latest endpoints |

### POST /api/schedule body

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `paused` | boolean | (required) | When `true`, the scheduled handler skips sync. When `false`, scheduled sync resumes |

### GET /api/schedule response

| Field | Type | Description |
|-------|------|-------------|
| `cron` | string | The cron expression for the scheduled trigger (from `CRON_EXPRESSION` env var) |
| `description` | string | Human-readable schedule description (from `CRON_DESCRIPTION` env var) |
| `paused` | boolean | Whether the scheduled handler is currently paused |

### DELETE /api/managed response

| Field | Type | Description |
|-------|------|-------------|
| `removed` | number | Number of managed entries that were removed |
| `preserved` | number | Number of preserved entries kept intact |
| `totalAfter` | number | Total entries in the list after removal |
| `timestamp` | string | ISO 8601 timestamp of the operation |
| `error` | string | Error message if the operation failed (omitted on success) |

### GET /api/entries response

| Field | Type | Description |
|-------|------|-------------|
| `managed` | SplitTunnelEntry[] | Entries managed by this Worker (description starts with managed tag) |
| `preserved` | SplitTunnelEntry[] | Entries not managed by this Worker |
| `managedCount` | number | Count of managed entries |
| `preservedCount` | number | Count of preserved entries |
| `totalCount` | number | Total count of all entries |

## Web Dashboard

The dashboard is served at `GET /` and provides a visual interface for the Worker. It is protected by Cloudflare Access; when a user navigates to the dashboard, Access presents a login page and sets a `CF_Authorization` cookie on success. The dashboard reads this cookie and passes it as the `CF-Access-JWT-Assertion` header on API calls.

The dashboard has three cards:

- **Activity**: Shows last sync time, M365 version, entry counts, dry-run flag, and any errors. Auto-refreshes every 60 seconds.
- **Schedule**: Displays the cron schedule and description, shows whether syncs are active or paused, provides a pause/resume toggle, a "Force Sync Now" button, and a "Remove Managed" button to remove all M365-managed entries while preserving others (requires confirmation).
- **Preview**: Shows a "Run Preview" button that fetches and displays the diff of entries that would be added or removed on the next sync.
- **Current Configuration**: Shows a "Load Configuration" button that fetches and displays the current split tunnel exclude list, partitioned into managed and preserved entries in scrollable tables.

## Cron Schedule

The default schedule is `17 6 * * *`, which runs daily at 06:17 UTC. To change it, edit the `crons` array in `wrangler.jsonc`.

The non-round minute (17 instead of 00) is intentional. Many automated systems poll the M365 endpoints API at the top of the hour. Staggering the request to an off-peak time reduces the chance of hitting rate limits or experiencing latency from the thundering herd effect.

## Reconciliation Strategy

The Worker uses a tag-based approach to distinguish between entries it owns and entries that were added manually or by other tools:

- **Managed entries** have descriptions starting with the configured tag (default: `[m365-auto]`). These are fully replaced on each sync with the latest M365 endpoint data.
- **Preserved entries** are everything else. They are never modified or removed by this Worker.
- On each sync, the Worker fetches the current split tunnel list from the Cloudflare API, partitions it into managed and preserved entries, replaces the managed entries with fresh M365 data, and merges the two sets back together.
- The Cloudflare API requires a full list replacement (PUT), so the reconciliation ensures that preserved entries are included verbatim in the PUT payload, preventing data loss.

## Error Handling

All errors are persisted to KV with a typed reason (`rate_limit`, `permission_denied`, `cf_api`, `fetch_endpoints`, `version_check`, `cf_unknown`, `max_entries_exceeded`) and surfaced in the `/api/status` endpoint. The error is cleared on the next successful sync.

| Error type | Behavior |
|------------|----------|
| M365 429 (rate limit) | Skip this run entirely. Error is saved to KV. The next cron cycle will retry naturally. |
| Cloudflare API 403 (permission denied) | Permanent error. Saved to KV. Requires manual intervention (check API token permissions). |
| Cloudflare API 5xx | Single retry with a 1-second delay. If the retry also fails, the sync is aborted and the error is saved to KV. |
| Request timeout | External API calls (Cloudflare API: 30s, M365 API: 60s) abort on timeout. The error is saved to KV. |
| Other errors | Saved to KV with details. The next cron cycle retries naturally. |

## Development

```bash
# Start local dev server (includes scheduled handler support)
npm run dev

# Type-check without emitting
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Deploy to production
npm run deploy

# Regenerate TypeScript types (run after any wrangler.jsonc change)
npm run cf-typegen
```

### Testing the scheduled handler locally

The dev server started by `npm run dev` includes the `--test-scheduled` flag, which enables the scheduled handler. To trigger it manually:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

## Production Rollout Recommendations

1. Deploy first with `DRY_RUN` set to `"true"` (via dashboard or `--var`). This computes all changes without writing them to the Cloudflare API.
2. Wait for one cron cycle to run, or trigger `POST /api/sync` manually.
3. Check Worker logs and the `/api/status` endpoint for the sync result.
4. Verify the diff using `/api/preview` to confirm the entries that would be added and removed.
5. Once satisfied, set `DRY_RUN` to `"false"` (via dashboard or `--var`) and redeploy.
6. Monitor Worker logs for the first few days to confirm syncs are succeeding and the split tunnel list remains correct.

## Operational Notes

### Pausing syncs

Use the dashboard toggle or `POST /api/schedule` with `{"paused": true}`. When paused, the cron handler logs a skip message and does not execute the sync. The pause state is stored in KV and persists across deployments.

### Resuming syncs

Use the dashboard toggle or `POST /api/schedule` with `{"paused": false}`. KV is eventually consistent; changes may take up to 60 seconds to propagate, which is negligible compared to the daily cron interval.

### Force sync

Use the dashboard's "Force Sync Now" button or `POST /api/sync` with `{"force": true}`. This bypasses the M365 version check and always fetches and applies the latest endpoints, even when the schedule is paused.

### Changing the cron schedule

Edit the `triggers.crons` array in `wrangler.jsonc` and update `CRON_EXPRESSION` and `CRON_DESCRIPTION` env vars to match. Redeploy with `npm run deploy`. The dashboard reads these values at runtime.

### Removing managed entries

Use the dashboard's "Remove Managed" button or `DELETE /api/managed`. This removes all M365-managed entries from the split tunnel exclude list while preserving manually-added or third-party entries. After removal, the next scheduled sync (or force sync) will re-fetch and re-apply the latest M365 endpoints.

Note: If a scheduled sync runs immediately after a remove operation (before the KV state update propagates), the managed entries may be re-added. This is unlikely with a daily cron schedule but can occur if a force sync is triggered manually right after removal.

## Future Enhancements

These items are out of scope for v1 but represent potential directions:

- Webhook notifications on sync failure (Slack, email, or generic HTTP webhook)
- Support for syncing to multiple Cloudflare accounts or profiles from a single Worker instance
- Integration with Cloudflare Gateway DNS policies for split-tunnel-by-DNS mode as an alternative to IP-based exclude lists
- Terraform provider for managing M365 split tunnel entries declaratively
