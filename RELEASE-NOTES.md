# v0.6.0 — November 13 reviewed baseline

- Migrated the read-only hover and detail panel to the component used by the review site.
- Added matching on Workspace settings and Models alongside Permissions, with stable IDs for repeated permission labels and context for Chat/Work defaults.
- Synced all 109 reviewed records, including sources, audiences, callouts, scores, parameters and provisional/pending labels.
- Space links: Enabled, Campus Decision, Medium concern, Low effort. Task insights stays pending. Retention follows campus policy without a CSU duration.
- Kept schema 1 compatibility for older extensions; v0.6 uses validated rich guidance. Offline fallback and outdated-cache protection retained.

Validation: seven sync/data tests, syntax checks, record parity, and browser fixtures for 75/15/19 entries. New unknown labels received no guessed recommendation; native controls were untouched. Live installed-extension validation and the uncaptured Dots Settings tab remain outstanding.

Update an unpacked installation by replacing its files, Reload in chrome://extensions, then refresh Admin Console. No additional permissions. Store publication is a separate distribution step.
