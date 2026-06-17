# M365 Split Tunnel Automation

> Provided as-is for educational and reference purposes. See [LICENSE](LICENSE) for details.

A Cloudflare Worker that automatically syncs Microsoft 365 IP and FQDN endpoints into a Cloudflare Zero Trust device profile's Split Tunnel EXCLUDE list, keeping the list current as Microsoft publishes endpoint changes.

## Quick Start

**What you need before you start:**

- A Cloudflare account with Zero Trust enabled
- A Cloudflare API token with Zero Trust device policy permissions
- A custom domain added to your Cloudflare account (or a workers.dev subdomain)

**1. Clone and install**

```bash
git clone <repo-url> split-tunnel-automation
cd split-tunnel-automation
npm install
```

**2. Configure your domain**

Edit `wrangler.jsonc` and replace `your-worker.your-domain.com` in the `routes` section with your own custom domain. This domain is required for Cloudflare Access authentication. The domain must be added to your Cloudflare account (DNS does not need to be proxied). If you prefer to use a `workers.dev` subdomain instead, set `workers_dev: true` and remove the `routes` block entirely.

**3. Create KV namespace and configure**

```bash
npm run setup
```

This creates the KV namespace and patches `wrangler.jsonc` with the namespace ID. If you prefer to do this manually, run `npx wrangler kv namespace create STATE` and update the `id` field in `wrangler.jsonc`.

**4. Generate TypeScript types**

```bash
npm run cf-typegen
```

Re-run this command whenever you change `wrangler.jsonc`.

**5. Set environment variables**

Copy `.dev.vars.example` to `.dev.vars` and replace the placeholder values:

```bash
cp .dev.vars.example .dev.vars
```

At minimum, set `CF_API_TOKEN` and `CF_ACCOUNT_ID`. For local development, `ACCESS_TEAM_DOMAIN=dev` and `ACCESS_POLICY_AUD=dev` bypass auth.

For production, set these via the Cloudflare dashboard (**Workers & Pages > split-tunnel-automation > Settings > Variables and Secrets**):

- `CF_API_TOKEN` (secret, required)
- `CF_ACCOUNT_ID` (required)
- `ACCESS_TEAM_DOMAIN` (required for Access auth)
- `ACCESS_POLICY_AUD` (required for Access auth)

**6. Deploy**

```bash
npm run deploy
```

**7. Configure Cloudflare Access**

After deploying, visit your Worker's URL. If Access is not yet configured, the dashboard will show a guided checklist to help you set it up. Follow the steps to create an Access application and set the required environment variables.

**8. Verify**

The dashboard loads with Dry Run mode enabled by default. Use the Preview button to see what changes would be applied, then disable Dry Run in Settings when ready. Monitor Worker logs for the first few days to confirm syncs are succeeding and the split tunnel list remains correct.

## Configuration

### Required

| Name | Default | Description |
|------|---------|-------------|
| `CF_ACCOUNT_ID` | (none) | Cloudflare account ID |
| `CF_API_TOKEN` | (none) | Cloudflare API token with Zero Trust edit permissions (secret) |
| `ACCESS_TEAM_DOMAIN` | (none) | Cloudflare Access team domain URL (e.g. `https://your-team.cloudflareaccess.com`). Set via the dashboard only |
| `ACCESS_POLICY_AUD` | (none) | Cloudflare Access application AUD tag. Set via the dashboard only. Use `dev` locally in `.dev.vars` to bypass auth in development |

### M365 Endpoints

| Name | Default | Description |
|------|---------|-------------|
| `M365_INSTANCE` | `Worldwide` | M365 cloud instance. Options: `Worldwide`, `China`, `USGovDoD`, `USGovGCCHigh` |
| `M365_SERVICES` | `all` | Fallback default for service area filtering when no selection has been saved via the dashboard. Comma-separated service areas to include, or `all` for no filter. Options: `Exchange`, `SharePoint`, `Skype`. The `Common` service area is always included regardless of this setting, as Common endpoints are shared dependencies required by all M365 services. If a selection has been saved via the dashboard (KV key `m365:services`), that value takes priority over this env var. |
| `M365_CATEGORIES` | `Optimize` | Comma-separated categories to include. Options: `Optimize`, `Allow`, `Default`. Microsoft recommends Optimize-only for VPN split tunneling |
| `M365_TENANT_NAME` | (empty) | Your M365 tenant name (e.g., `contoso`). When set, the M365 API resolves tenant-specific wildcards like `autodiscover.*.onmicrosoft.com` |

### Feature Flags

| Name | Default | Description |
|------|---------|-------------|
| `INCLUDE_IPV6` | `true` | Whether to include IPv6 addresses in split tunnel entries |
| `INCLUDE_URLS` | `true` | Whether to include URL/host entries in split tunnel entries |
| `DRY_RUN` | `true` | When `true`, compute changes but do not apply them to the Cloudflare API. Ships with Dry Run enabled for safe first runs. Disable in the dashboard after verifying the preview |
| `MANAGED_TAG` | `[m365-auto]` | Tag prefix used in entry descriptions to identify entries managed by this Worker |
| `MAX_ENTRIES` | `1000` | Maximum number of entries per split tunnel list. Sync is aborted if the merged list would exceed this limit |

### Device Profile

| Name | Default | Description |
|------|---------|-------------|
| `CF_POLICY_ID` | (empty) | Split tunnel policy ID. When empty, targets the default device profile. Can also be set from the dashboard via the device-profile picker in Settings |
| `cfPolicyId` | (none) | Dashboard-only override for the device profile to target. When set via the Settings tab, takes priority over `CF_POLICY_ID`. Clear the override to revert to the env var |

### Schedule

| Name | Default | Description |
|------|---------|-------------|
| `CRON_EXPRESSION` | `17 6 * * *` | Cron expression displayed in the dashboard. Must match the `triggers.crons` value in `wrangler.jsonc` |
| `CRON_DESCRIPTION` | `Daily at 06:17 UTC` | Human-readable description of the schedule, displayed in the dashboard |

**Dashboard-configurable settings:** The following settings can be changed at runtime via the Settings tab in the web dashboard, without redeploying: `M365_INSTANCE`, `M365_CATEGORIES`, `INCLUDE_IPV6`, `INCLUDE_URLS`, `DRY_RUN`, `MAX_ENTRIES`, `cfPolicyId`. Dashboard-saved values take priority over environment variables. To revert a setting to its environment variable default, remove the override in the Settings tab. Settings that are not exposed in the dashboard (`CF_ACCOUNT_ID`, `CF_POLICY_ID`, `CF_API_TOKEN`, `ACCESS_TEAM_DOMAIN`, `ACCESS_POLICY_AUD`, `MANAGED_TAG`, `CRON_EXPRESSION`, `CRON_DESCRIPTION`) can only be changed by updating environment variables and redeploying. Note: `cfPolicyId` is a dashboard-only override; when set, it takes priority over the `CF_POLICY_ID` environment variable.

## How it works

1. A cron trigger runs daily (default: 06:17 UTC).
2. The Worker checks the M365 version endpoint to see if endpoint data has changed since the last sync.
3. If the version is new, it fetches the full endpoint set from Microsoft, filtered by the configured service areas and categories.
4. Endpoints are transformed into Cloudflare split tunnel entries (IPs become `address` entries, FQDNs become `host` entries) and deduplicated.
5. The Worker fetches the current split tunnel list from the Cloudflare API and partitions entries into "managed" (description starts with `[m365-auto]`) and "preserved" (everything else).
6. Managed entries are replaced with the latest M365 data. Preserved entries are kept verbatim.
7. The merged list is PUT back to the Cloudflare API. Because the API requires a full replacement, the reconciliation step ensures no data loss.

Tag-based ownership uses the `[m365-auto]` prefix in entry descriptions (configurable via `MANAGED_TAG`).

> **Alternative approach:** Microsoft recommends an alternative where M365 traffic is sent through the tunnel but [inspection is bypassed](https://developers.cloudflare.com/cloudflare-one/traffic-policies/application-app-types/#microsoft-365-integration), rather than excluding it from the tunnel entirely. Cloudflare also offers a [global toggle for M365 traffic](https://github.com/Vortexmind/cf-zt-m365-split-tunnel-automation) if a granular approach is not required.

## Web Dashboard

The dashboard is a static single-page application (SPA) served as static assets alongside the Worker. It is protected by Cloudflare Access; when a user navigates to the dashboard, Access presents a login page and sets a `CF_Authorization` cookie on success. The dashboard reads this cookie and passes it as the `CF-Access-JWT-Assertion` header on API calls.

The header includes a Sun/Moon toggle button for switching between light and dark mode. The initial mode is selected from the user's browser or system preference (`prefers-color-scheme`). The selection is persisted in `localStorage`.

The dashboard has five cards on the Dashboard tab:

- **Activity**: Shows last sync time, M365 version, entry counts, dry-run flag, and any errors. Auto-refreshes every 60 seconds.
- **Schedule**: Displays the cron schedule and whether syncs are active or paused. Shows the timestamp and outcome of the most recent cron run (including skipped runs where the M365 feed version had not changed), so you can confirm the schedule is executing even when no entries were updated. Provides a pause/resume toggle, a "Sync Now" button, and a "Remove Managed" button (requires confirmation).
- **Services**: Toggle switches for each configurable service area (Exchange, SharePoint, Skype). At least one service must remain selected. The Common service area is always included and is shown as a read-only info row. Changes are saved to KV via `POST /api/services` and take effect on the next sync (scheduled or manual). See [Configuring service areas](#configuring-service-areas) below.
- **Preview**: Shows a "Run Preview" button that fetches and displays the diff of entries that would be added or removed on the next sync.
- **Current Configuration**: Shows a "Load Configuration" button that fetches and displays the current split tunnel exclude list, partitioned into managed and preserved entries in scrollable tables.

The dashboard also has a **Settings** tab with controls for the device profile, M365 Instance, M365 Categories, Include IPv6, Include URLs, Dry Run, and Max Entries. Changes are saved to KV and take effect on the next sync. Each setting shows its source (Custom, Env, or Default). When Dry Run mode is active, a warning banner is displayed on the Dashboard tab.

The **History** tab shows a chronological log of all sync and remove operations from the last 30 days. Each entry displays the operation type (sync/remove), trigger source (manual/cron), outcome (success, error, skipped, dry run), and a summary of changes or error details. History entries are stored in KV and pruned automatically on each write.

---

## API Reference

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/healthz` | No | Liveness check. Returns `200 OK` with a simple status body |
| GET | `/api/config-status` | No | Returns `{ accessConfigured: boolean }` indicating whether Cloudflare Access is configured |
| GET | `/api/status` | Yes | Last sync metadata, including version, timestamp, result summary, and last error |
| GET | `/api/preview` | Yes | Dry-run diff of what would change on the next sync, without writing anything |
| POST | `/api/sync` | Yes | Trigger an immediate sync |
| GET | `/api/schedule` | Yes | Current schedule state: cron expression, paused flag, and last cron run info |
| POST | `/api/schedule` | Yes | Update the schedule pause state |
| GET | `/api/services` | Yes | Returns `{ services: string[] \| null }` — the currently persisted service area selection (`null` means all services) |
| POST | `/api/services` | Yes | Save the service area selection. Body: `{ services: string[] \| null }`. Valid service names: `Exchange`, `SharePoint`, `Skype`. `null` means all services |
| GET | `/api/services/summary` | Yes | Returns per-service-area entry counts and sample domains from the current M365 endpoint feed |
| GET | `/api/profiles` | Yes | Lists device profiles available in the account (from the Cloudflare API) |
| DELETE | `/api/managed` | Yes | Remove all M365-managed entries from the split tunnel exclude list, preserving non-managed entries |
| GET | `/api/entries` | Yes | Fetch the current split tunnel exclude list, partitioned into managed and preserved entries |
| GET | `/api/history` | Yes | Returns the run history log (sync and remove operations from the last 30 days) |
| GET | `/api/settings` | Yes | Returns current settings with effective values and source (KV override, env var, or default) |
| POST | `/api/settings` | Yes | Save settings overrides. Body: partial JSON with keys to override. Omit keys to revert to env/default |

All authenticated endpoints require a valid Cloudflare Access JWT, passed via the `cf-access-jwt-assertion` header. Access sets this automatically for browser users (via the `CF_Authorization` cookie) and for API callers using service tokens (Access injects the header after validating `CF-Access-Client-Id`/`CF-Access-Client-Secret`).

### Cloudflare Access Setup

1. In the Cloudflare Zero Trust dashboard, create a new **Self-hosted** Access application for your Worker's hostname (e.g. `your-worker.your-account.workers.dev`).
2. Note the **Application AUD** tag from the application settings.
3. Set the `ACCESS_TEAM_DOMAIN` environment variable to your team domain (e.g. `https://your-team.cloudflareaccess.com`) via the Cloudflare dashboard.
4. Set the `ACCESS_POLICY_AUD` environment variable to the AUD tag from step 2 via the Cloudflare dashboard.
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

```bash
# Get current settings
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
     http://localhost:8787/api/settings

# Override specific settings
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
              -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
              -H "Content-Type: application/json" \
              -d '{"includeIpv6": false, "dryRun": true}' \
              http://localhost:8787/api/settings

# Revert all settings to environment variable defaults
curl -X POST -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
              -H "CF-Access-Client-Secret: YOUR_CLIENT_SECRET" \
              -H "Content-Type: application/json" \
              -d '{}' \
              http://localhost:8787/api/settings
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
| `paused` | boolean | Whether the scheduled handler is currently paused |
| `lastCronRun` | object | Info about the most recent cron-triggered sync run. Omitted if no cron has run yet |
| `lastCronRun.timestamp` | string | ISO 8601 timestamp of the cron run |
| `lastCronRun.outcome` | string | Result: `success`, `skipped`, `dry_run`, or `error` |
| `lastCronRun.version` | string | M365 endpoint version at the time of the run (omitted if unavailable) |

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

### GET /api/history response

Returns an array of `HistoryEntry` objects, newest first. Entries are automatically pruned after 30 days.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp of the operation (also serves as the unique key) |
| `opType` | string | Operation type: `sync` or `remove` |
| `trigger` | string | How the operation was triggered: `manual` or `cron` (cron only applies to sync) |
| `outcome` | string | Result: `success`, `error`, `skipped`, or `dry_run` |
| `version` | string | (sync only) M365 endpoint version |
| `candidates` | number | (sync only) Number of M365 endpoints matching filters |
| `added` | number | (sync only) Entries added in this sync |
| `removed` | number | (sync only) Entries removed in this sync |
| `managedAfter` | number | (sync only) Managed entries after this sync |
| `preserved` | number | (sync only) Preserved entries in the list |
| `dryRun` | boolean | (sync only) Whether dry run mode was active |
| `removedCount` | number | (remove only) Number of managed entries removed |
| `preservedCount` | number | (remove only) Number of preserved entries kept |
| `totalAfter` | number | (remove only) Total entries after removal |
| `errorType` | string | (error only) Error category (e.g. `permission_denied`, `cf_api`) |
| `errorMessage` | string | (error only) Human-readable error description |

### GET /api/settings response

| Field | Type | Description |
|-------|------|-------------|
| `m365Instance` | `{ value: string, source: "kv" \| "env" \| "default" }` | M365 cloud instance |
| `m365Categories` | `{ value: string, source: "kv" \| "env" \| "default" }` | Comma-separated categories |
| `includeIpv6` | `{ value: boolean, source: "kv" \| "env" \| "default" }` | Whether IPv6 addresses are included |
| `includeUrls` | `{ value: boolean, source: "kv" \| "env" \| "default" }` | Whether URL/host entries are included |
| `dryRun` | `{ value: boolean, source: "kv" \| "env" \| "default" }` | Whether dry run mode is active |
| `maxEntries` | `{ value: number, source: "kv" \| "env" \| "default" }` | Maximum entries per split tunnel list |
| `cfPolicyId` | `{ value: string, source: "kv" \| "env" \| "default" }` | Device profile policy ID. Empty string means the default profile is used |

The `source` field indicates where the effective value comes from: `kv` (saved via dashboard), `env` (from environment variable), or `default` (hardcoded default).

### GET /api/services/summary response

Returns a summary of M365 endpoints grouped by service area.

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | M365 endpoint data version |
| `versionWarning` | string | Warning if version check failed (omitted on success) |
| `services` | ServiceSummary[] | Per-service-area summary |

Each `ServiceSummary` object:

| Field | Type | Description |
|-------|------|-------------|
| `serviceArea` | string | Service area name: `Common`, `Exchange`, `SharePoint`, or `Skype` |
| `entryCount` | number | Number of split tunnel entries for this service area |
| `sampleDomains` | string[] | Up to 5 sample domain entries from this service area |

### GET /api/profiles response

Returns the list of device profiles available in the Cloudflare account.

| Field | Type | Description |
|-------|------|-------------|
| `profiles` | DeviceProfile[] | List of device profiles |

Each `DeviceProfile` object:

| Field | Type | Description |
|-------|------|-------------|
| `policyId` | string | Policy ID (use as CF_POLICY_ID) |
| `name` | string | Profile name |
| `description` | string | Profile description (may be empty) |
| `isDefault` | boolean | Whether this is the default profile |
| `match` | string | Wirefilter expression for device matching (may be empty for default profile) |

### POST /api/settings body

| Field | Type | Description |
|-------|------|-------------|
| `m365Instance` | string | (optional) M365 cloud instance. Valid values: `Worldwide`, `China`, `USGovDoD`, `USGovGCCHigh` |
| `m365Categories` | string | (optional) Comma-separated categories. Valid values: `Optimize`, `Allow`, `Default` |
| `includeIpv6` | boolean | (optional) Whether to include IPv6 addresses |
| `includeUrls` | boolean | (optional) Whether to include URL/host entries |
| `dryRun` | boolean | (optional) Whether to enable dry run mode |
| `maxEntries` | number | (optional) Maximum entries per split tunnel list (must be a positive integer) |
| `cfPolicyId` | string | (optional) Device profile policy ID. Empty string or null clears the override |

Only include keys you want to override. Omitted keys will retain their current override (if any). To revert a specific key to its environment variable default, include it with a `null` or empty string value. To revert all settings, send an empty object `{}`.

## Reconciliation Strategy

The Worker uses a tag-based approach to distinguish between entries it owns and entries that were added manually or by other tools:

- **Managed entries** have descriptions starting with the configured tag (default: `[m365-auto]`). These are fully replaced on each sync with the latest M365 endpoint data.
- **Preserved entries** are everything else. They are never modified or removed by this Worker.
- On each sync, the Worker fetches the current split tunnel list from the Cloudflare API, partitions it into managed and preserved entries, replaces the managed entries with fresh M365 data, and merges the two sets back together.
- The Cloudflare API requires a full list replacement (PUT), so the reconciliation ensures that preserved entries are included verbatim in the PUT payload, preventing data loss.

### Wildcard URL handling

The Microsoft 365 endpoints feed uses wildcard notation that the Cloudflare Split Tunnel API does not accept verbatim. The Worker normalizes these before building the split tunnel list:

| M365 URL pattern | Example | Treatment | Sent to API as |
|-----------------|---------|-----------|----------------|
| `*.domain.tld` | `*.sharepoint.com` | Strip leading `*.` | `sharepoint.com` |
| `*domain.tld` | `*cdn.onenote.net` | Strip leading `*` | `cdn.onenote.net` |
| `prefix.*.domain.tld` | `autodiscover.*.onmicrosoft.com` | Skip — mid-domain wildcard unsupported | (dropped, warning logged) |

The overwhelming majority of M365 wildcard URLs use the standard `*.` prefix pattern. The only mid-domain wildcard in the live Worldwide feed (`autodiscover.*.onmicrosoft.com`) is already covered by the `*.onmicrosoft.com` entry in the same feed, which normalizes to `onmicrosoft.com`, so dropping it causes no coverage gap.

When a URL is skipped, a `console.warn` is emitted with the original URL. These warnings are visible in Workers Logs and can be used to detect if Microsoft introduces new unsupported patterns in a future feed update.

Cloudflare's Split Tunnel host entries match the domain and all its subdomains, so `sharepoint.com` in the exclude list covers `*.sharepoint.com` traffic as intended.

## Error Handling

All errors are persisted to KV with a typed reason (`rate_limit`, `permission_denied`, `cf_api`, `fetch_endpoints`, `version_check`, `cf_unknown`, `max_entries_exceeded`) and surfaced in the `/api/status` endpoint. The error is cleared on the next successful sync.

| Error type | Behavior |
|------------|----------|
| M365 429 (rate limit) | Skip this run entirely. Error is saved to KV. The next cron cycle will retry naturally. |
| Cloudflare API 403 (permission denied) | Permanent error. Saved to KV. Requires manual intervention (check API token permissions). |
| Cloudflare API 5xx | Single retry with a 1-second delay. If the retry also fails, the sync is aborted and the error is saved to KV. |
| Request timeout | External API calls (Cloudflare API: 30s, M365 API: 60s) abort on timeout. The error is saved to KV. |
| Other errors | Saved to KV with details. The next cron cycle retries naturally. |

## Operational Notes

### Pausing syncs

Use the dashboard toggle or `POST /api/schedule` with `{"paused": true}`. When paused, the cron handler logs a skip message and does not execute the sync. The pause state is stored in KV and persists across deployments.

### Resuming syncs

Use the dashboard toggle or `POST /api/schedule` with `{"paused": false}`. KV is eventually consistent; changes may take up to 60 seconds to propagate, which is negligible compared to the daily cron interval.

### Force sync

Use the dashboard's "Force Sync Now" button or `POST /api/sync` with `{"force": true}`. This bypasses the M365 version check and always fetches and applies the latest endpoints, even when the schedule is paused.

### Changing the cron schedule

Edit the `triggers.crons` array in `wrangler.jsonc` and update `CRON_EXPRESSION` and `CRON_DESCRIPTION` env vars to match. Redeploy with `npm run deploy`. The dashboard reads these values at runtime.

The default schedule is `17 6 * * *`, which runs daily at 06:17 UTC. The non-round minute (17 instead of 00) is intentional. Many automated systems poll the M365 endpoints API at the top of the hour. Staggering the request to an off-peak time reduces the chance of hitting rate limits or experiencing latency from the thundering herd effect.

### Configuring service areas

Use the **Services** card in the dashboard to select which M365 service areas (Exchange, SharePoint, Skype) are included in the split tunnel list. The Common service area is always included and cannot be deselected. At least one service area must remain selected; the last remaining toggle cannot be turned off.

The selection is saved to KV under the key `m365:services` and takes priority over the `M365_SERVICES` environment variable. If no selection has ever been saved via the dashboard, the `M365_SERVICES` env var default is used.

After saving a new selection, trigger a Sync Now or Force Sync, or wait for the next scheduled sync, for the change to take effect.

### Removing managed entries

Use the dashboard's "Remove Managed" button or `DELETE /api/managed`. This removes all M365-managed entries from the split tunnel exclude list while preserving manually-added or third-party entries. After removal, the next scheduled sync (or force sync) will re-fetch and re-apply the latest M365 endpoints.

Note: If a scheduled sync runs immediately after a remove operation (before the KV state update propagates), the managed entries may be re-added. This is unlikely with a daily cron schedule but can occur if a force sync is triggered manually right after removal.

### Feed coverage limitations

This tool manages only the endpoints published by the [Microsoft 365 IP Address and URL web service](https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-ip-web-service?view=o365-worldwide). The following endpoints are **not** included in the feed and must be managed manually (added as preserved entries) if required:

- **Teams mobile push notifications**: Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs) endpoints used for incoming call alerts and message notifications on mobile devices.
- **Trusted Sites**: FQDNs that must be added to Internet Explorer or Microsoft Edge Trusted Sites zones for Teams, SharePoint, and Viva Engage.
- **Network Connection Status Indicator (NCSI)**: `www.msftconnecttest.com`, used by Windows to determine internet connectivity. If unreachable, Microsoft 365 Apps may fail to activate.

See [Other endpoints not included in the web service](https://learn.microsoft.com/en-us/microsoft-365/enterprise/additional-office365-ip-addresses-and-urls?view=o365-worldwide) for the full list.

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

## Migration Notes

### Upgrading from pre-v1 defaults

If you are upgrading from a version that shipped with `M365_CATEGORIES=Optimize,Allow` and `DRY_RUN=false` as defaults, and you relied on these defaults (i.e., you never explicitly set these values in your environment variables or dashboard), your deployment will now use the new defaults:

- **M365_CATEGORIES** defaults to `Optimize` (Microsoft-recommended for split tunneling). If you want to include `Allow` category endpoints as before, set `M365_CATEGORIES=Optimize,Allow` in your environment variables or dashboard.
- **DRY_RUN** defaults to `true` (safe first runs). If you want syncs to apply changes immediately, set `DRY_RUN=false` in your environment variables or dashboard.

If you have explicitly set these values in your environment or dashboard, your configuration is unaffected.

## Future Enhancements

These items are out of scope for v1 but represent potential directions:

- Webhook notifications on sync failure (Slack, email, or generic HTTP webhook)
- Support for syncing to multiple Cloudflare accounts or profiles from a single Worker instance
- Integration with Cloudflare Gateway DNS policies for split-tunnel-by-DNS mode as an alternative to IP-based exclude lists
- Terraform provider for managing M365 split tunnel entries declaratively
