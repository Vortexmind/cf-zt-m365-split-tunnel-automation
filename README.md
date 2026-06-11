# M365 Split Tunnel Automation

A Cloudflare Worker that automatically syncs Microsoft 365 IP and FQDN endpoints into a Cloudflare Zero Trust device profile's Split Tunnel EXCLUDE list, keeping the list current as Microsoft publishes endpoint changes.

## Why not the built-in feature?

Cloudflare Zero Trust offers a "Directly route Microsoft 365 traffic" toggle in the dashboard (under Zero Trust > Settings > WARP Client > Device settings > Split Tunnels). This Worker exists because the built-in feature has several limitations:

- **Custom profile support.** The built-in toggle only applies to the default device profile. This Worker targets any profile via the `CF_POLICY_ID` environment variable, including custom profiles used by specific user groups or device types.
- **Entry preservation.** The built-in feature does not preserve manually-added entries when it updates. This Worker uses tag-based reconciliation to keep non-M365 entries intact while replacing only the entries it manages.
- **Fine-grained filtering.** The built-in feature does not allow filtering by Microsoft service area (Exchange, SharePoint, Skype) or category (Optimize, Allow, Default). This Worker provides `M365_SERVICES` and `M365_CATEGORIES` to include only the endpoints relevant to your organization.
- **FQDN and wildcard support.** The built-in feature only includes IP addresses. This Worker includes both IPs and domain entries with wildcard support (e.g., `*.sharepoint.com`), giving you more precise split tunnel control.
- **Observability.** The built-in feature has no logging, status endpoint, or error tracking. This Worker exposes `/status`, `/preview`, structured logging, and last-error tracking in KV.
- **On-demand sync.** The built-in feature cannot be triggered manually. This Worker provides `POST /sync` for immediate updates outside the cron schedule.

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
   Copy the `id` from the output.

4. Create the preview namespace for local development:
   ```bash
   npx wrangler kv namespace create STATE --preview
   ```
   Copy the `preview_id` from the output.

5. Update `wrangler.jsonc`: replace `TODO_REPLACE_WITH_KV_NAMESPACE_ID` with the actual namespace `id`, and `TODO_REPLACE_WITH_KV_PREVIEW_ID` with the actual `preview_id`.

6. Copy `.dev.vars.example` to `.dev.vars` and fill in the secrets:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

7. Set secrets for production:
   ```bash
   npx wrangler secret put CF_API_TOKEN
   npx wrangler secret put WEBHOOK_SECRET
   ```

8. Configure vars in `wrangler.jsonc` (or override via `.dev.vars` for local dev). At minimum, set `CF_ACCOUNT_ID` to your Cloudflare account ID.

9. Test locally:
   ```bash
   npm run dev
   ```
   Then in another terminal:
   ```bash
   curl http://localhost:8787/healthz
   ```

10. Preview the diff (requires auth):
    ```bash
    curl -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" http://localhost:8787/preview
    ```

11. First deploy with `DRY_RUN` set to `"true"` in `wrangler.jsonc` vars to validate without writing changes.

12. Deploy:
    ```bash
    npm run deploy
    ```

13. After validating logs and confirming the diff looks correct, set `DRY_RUN` to `"false"` in `wrangler.jsonc` and redeploy:
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
| `WEBHOOK_SECRET` | (none) | Required for HTTP routes (secret) | Secret for authenticating HTTP trigger requests |

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/healthz` | No | Liveness check. Returns `200 OK` with a simple status body |
| GET | `/status` | Yes | Last sync metadata, including version, timestamp, result summary, and last error |
| GET | `/preview` | Yes | Dry-run diff of what would change on the next sync, without writing anything |
| POST | `/sync` | Yes | Force an immediate sync |

All authenticated endpoints require the `Authorization: Bearer <WEBHOOK_SECRET>` header.

### Examples

```bash
# Health check (no auth)
curl http://localhost:8787/healthz

# Check last sync status
curl -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" http://localhost:8787/status

# Preview the diff without applying changes
curl -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" http://localhost:8787/preview

# Force an immediate sync
curl -X POST -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" http://localhost:8787/sync

# Force sync, skipping version check
curl -X POST -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true}' \
  http://localhost:8787/sync
```

### POST /sync body

The optional JSON body supports:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `force` | boolean | `false` | When `true`, skips the M365 version check and always fetches and applies the latest endpoints |

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

| Error type | Behavior |
|------------|----------|
| M365 429 (rate limit) | Skip this run entirely. No state is mutated in KV. The next cron cycle will retry naturally. |
| Cloudflare API 403 (permission denied) | Permanent error. The error is saved to KV and surfaced in the `/status` endpoint. Requires manual intervention (check API token permissions). |
| Cloudflare API 5xx | Single retry with a 1-second delay. If the retry also fails, the sync is aborted and the error is logged. No state is mutated. |
| Other errors | Logged with details. No state is mutated. The next cron cycle retries naturally. |

## Development

```bash
# Start local dev server (includes scheduled handler support)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Deploy to production
npm run deploy

# Regenerate TypeScript types for Cloudflare bindings
npm run cf-typegen
```

### Testing the scheduled handler locally

The dev server started by `npm run dev` includes the `--test-scheduled` flag, which enables the scheduled handler. To trigger it manually:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

## Production Rollout Recommendations

1. Deploy first with `DRY_RUN` set to `"true"` in `wrangler.jsonc`. This computes all changes without writing them to the Cloudflare API.
2. Wait for one cron cycle to run, or trigger `POST /sync` manually.
3. Check Worker logs and the `/status` endpoint for the sync result.
4. Verify the diff using `/preview` to confirm the entries that would be added and removed.
5. Once satisfied, set `DRY_RUN` to `"false"` in `wrangler.jsonc` and redeploy.
6. Monitor Worker logs for the first few days to confirm syncs are succeeding and the split tunnel list remains correct.

## Future Enhancements

These items are out of scope for v1 but represent potential directions:

- Webhook notifications on sync failure (Slack, email, or generic HTTP webhook)
- Support for syncing to multiple Cloudflare accounts or profiles from a single Worker instance
- Integration with Cloudflare Gateway DNS policies for split-tunnel-by-DNS mode as an alternative to IP-based exclude lists
- Terraform provider for managing M365 split tunnel entries declaratively
