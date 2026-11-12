# CSU ChatGPT Workspace Guide

Chrome extension providing one shared recommendation baseline for CSU campuses. CSU pills appear beside information icons on the OpenAI Admin Console Permissions page. Click a pill to open its guidance in the collapsible panel; hover or focus it for the recommendation, category, and rationale.

- Green: Enabled
- Red: Disabled
- Yellow: Limited Access
- Gray: no decision yet in the three-value access scheme

Categories are Baseline, Recommended, or Campus Decision. Pill colors show the CSU recommendation independently of the current workspace toggle. The extension does not change workspace settings.

## Install v0.4.0

Download this repository using **Code → Download ZIP** and extract it. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder containing `manifest.json`. Refresh your Admin Console tab.

To update an existing unpacked installation, replace its files, click **Reload** on the extension card, and refresh the Admin Console tab. This update adds access to raw.githubusercontent.com for downloading public guidance. No GitHub account or token is required for readers.

## Publish recommendation updates

Edit [recommendations.json](recommendations.json) on the `main` branch, update `version` and `publishedAt`, and commit. The file is the source distributed to all installations. The initial content is recovered historical guidance with the October 27 reviewed decisions; some categories and access decisions remain pending. Historical Testing, Managed Rollout, Students Only, and other values have not been silently converted to the new three-value scheme.

Example entry:

```json
"Search the web": {
  "decision": "enable",
  "category": "Baseline",
  "rationale": "Support current information, source discovery, and web-grounded answers.",
  "source": "CSU baseline review"
}
```

`decision` accepts `enable`, `disable`, `limited`, or an empty string for pending review. `category` accepts `Baseline`, `Recommended`, `Campus Decision`, or an empty string. All entries require string `rationale` and `source` fields. Use `schemaVersion: 1`; `version` is a release label and `publishedAt` is an ISO timestamp.

Entries can use stable Admin Console permission row IDs, e.g. `workspace-permission-web-search`. Display labels are supported for recovered guidance. Stable IDs take precedence and distinguish duplicate labels such as Allow local computer access. The extension checks its local draft first, then the published ID, then the published display label. Rename or remap entries if OpenAI changes a label or ID.

## Sync behavior

The service worker fetches only this public URL:

https://raw.githubusercontent.com/mattjhughes/csu-chatgpt-workspace-guide/main/recommendations.json

It checks on installation, browser startup, loading Admin Console, and opening the panel, using a 15-minute freshness window. An hourly Chrome alarm checks while the browser runs; sleeping devices can delay alarms. **Refresh from GitHub** bypasses the freshness window. GitHub caching can cause a short delay after a commit.

The panel shows the baseline version, publication date, and last successful check. Valid downloads replace the cached baseline, including removed entries. Failed downloads, malformed JSON, incompatible schemas, or files over 1 MiB preserve the last valid cache; a fresh offline install uses the packaged baseline. Open tabs receive updates through extension storage events. Only JSON data is downloaded; remote text is rendered with textContent, never executed or inserted as HTML.

## Local drafts

The panel editor saves drafts in this Chrome profile across workspaces. Drafts override the published baseline and are marked Local draft. They are not uploaded to GitHub or shared with other administrators. To return an item to published guidance, edit it, choose Not specified and Not yet categorized, clear its rationale, and save. Publish shared changes by editing recommendations.json in GitHub or by asking Codex to update this repository.

## Development and checks

No build or package dependencies are needed. After editing extension code, reload the extension and Admin Console tab. Recommendation-only changes in GitHub do not require an extension update. Code, schema, or permission changes may require one.

Run `node --test tests/sync.test.cjs` for download validation, caching, offline and invalid-response fallback, replacement, and message-origin checks. Tests simulate Chrome APIs; live extension installation remains a separate check. The pill, tooltip, sidebar, and editor flows were previewed on the actual Admin Console page. The extension service worker has not yet been tested inside an installed Chrome extension.

The packaged CSU wordmark was reused from the existing CSU Workspace Config Guide. The CSU name and wordmark remain their owner's property; no trademark license is granted by this repository.
