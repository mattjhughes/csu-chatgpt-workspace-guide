# CSU ChatGPT Workspace Guide — v0.6.0

Read-only Chrome/Edge extension and reference site using the November 13 reviewed recommendations. The extension adds CSU pills beside matching settings on Workspace settings, Permissions, and Models. Hover or focus a pill for a summary; click for the same detailed guidance panel used by the site. Green = Enabled, red = Disabled, yellow = Limited Access, gray = pending/no CSU access recommendation. Parameter recommendations use their recorded values.

## Install or update

Extract `csu-workspace-overlay.zip`. In `chrome://extensions` (or `edge://extensions`), use Developer mode → Load unpacked and select the folder containing `manifest.json`. To update an existing unpacked installation, replace the files in its original folder, click Reload on its extension card, and refresh Admin Console. Code changes require this one-time update; subsequent recommendation-only releases synchronize from GitHub. This ZIP is not a Chrome Web Store release.

The extension does not change workspace settings and has no editing controls. No additional Chrome permissions were added in this release.

## One reviewed source

`guide/recommendations.json` is the editable source for the site and extension. It preserves categories, concern, effort, audiences, reasoning, callouts, pending/provisional status, references, and model preferences. Run `python3 sync-guide.py` after editing it to regenerate `guide/data.js`, root `recommendations.json`, and `baseline.js`. Copy changed shared `guidance-ui.js`/`.css` to both root and `guide/` when changing the common component. Publish `guide/` through the separate Sites checkout after review.

Root `recommendations.json` keeps schema version 1 and simple decisions for older installations, with a validated optional `guidance` object for v0.6. Stable permission IDs distinguish repeated labels. Unique display-label aliases support earlier releases. Generic guide IDs such as `general-1` are not treated as live Admin Console identifiers.

The new review Site is separate from the original Site. It starts owner-private. Agent security is documentation-only. Task insights remains pending CO leadership review. Unassigned ratings and working Teams proposals are not silently finalized. No complete coverage of unselected tabs or tenant settings is claimed.

## GitHub synchronization

The service worker reads only:
https://raw.githubusercontent.com/mattjhughes/csu-chatgpt-workspace-guide/main/recommendations.json

Checks occur at installation, browser startup, page load/panel opening, and hourly while the browser runs, with a 15-minute freshness window. **Refresh from GitHub** bypasses that window. Failed, oversized, unsafe, or malformed downloads preserve the last valid cache; a new offline install uses bundled data. The content script rejects data older than its packaged baseline. No credentials, screenshots, or workspace content are uploaded. Only JSON data is downloaded; the extension does not execute remote code. All remote display text is escaped and reference links must use HTTPS.

## Matching and limits

Stable permission row IDs take precedence, then exact normalized labels within the current page. Repeated labels require an unambiguous section or stable ID. Unknown or ambiguous settings are left untouched rather than assigned a guessed recommendation. The current selectors support information buttons and exact leaf labels; Admin Console layout/label changes can require a matching update. Default-model labels match Model, Effort, Speed, and New chats only within an unambiguous Chat or Work & Codex product group. The Dots Settings tab was not captured or reviewed.

## Verification

Run `node --test tests/sync.test.cjs` for safe rich-data validation, offline/cache behavior, source checks and audience/pending exceptions. Browser fixture checks cover Permissions, Workspace settings, Models, repeated local-access labels, unknown settings, the shared detail panel, and preserving native controls. Fixtures do not prove an installed extension works against every current Admin Console layout; installation/live-page verification remains separate.

The CSU wordmark was reused from the existing guide. No trademark license is granted by this repository.
