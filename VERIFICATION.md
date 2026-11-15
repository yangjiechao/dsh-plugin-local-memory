# Verification

## Environment and evidence

- DSH 0.2.2-rc.3, macOS, Node v26.5.0. Node built-in SQLite/FTS5 availability was exercised.
- Hindsight bundle `@vectorize-io/hindsight-coding-agents` was removed from the current Web profile through Plugin Manager: `application: applied`, no warnings. Host Config Inspect returned zero entries for that package afterwards. No Hindsight cloud data was queried or deleted.
- 25 tests pass: 20 real temporary SQLite/store/service/adapter tests and five non-rendering Client controller unit tests. Tests cover persistence, Chinese and literal SQL/FTS searches, project isolation including known note IDs, two-connection optimistic concurrency, credential-shaped text, quotas, pagination/budgets, database version gates, unsafe links, owner-only RPC, tool scope, late-response isolation, draft retention, duplicate-write locks, conflicts and explicit uncertain-result recovery.
- Client tests do not render React or pretend to be visual/browser evidence. Their VM instrumentation exposes only the controller for deterministic unit tests.
- Static syntax checks pass for Host, store and Client. Source inspection found no remote request calls, automatic session capture hooks, internal Harness UI module imports, unsafe HTML rendering or DOM append operations.
- A subagent UI/UX review used the actual Client source and installed Settings contracts. It identified number-valued timestamps, uncertain-write retries, misleading empty-list states and success-message loss after refresh failure; those were fixed. Controller regressions cover the related state transitions.

## Packaging and display

Chinese/English metadata and documentation, exported original self-contained SVG icon (36 × 36 viewBox), no optional detail image: the README is the detail fallback. The icon follows installed restrained single-glyph artwork. The packed file list includes all runtime and display resources; the icon parses as XML with the intended viewBox.

## Limits

No screenshot, real keyboard/reader test or light/dark visual comparison was available. Windows/Linux native permissions and UI behavior were not tested. Tests use synthetic data; no real user notes or conversation logs were removed. This is a lightweight first local version, not an encrypted vault or secure erasure guarantee.

## Installation/runtime

- First installation into the Web profile reported `application: applied`, no activation warnings. Live Client Inspect confirmed `settings.section` occupant `local-memory` active. This proves registration, not its visual appearance.
- A real tool call exposed a strict-model adapter that fills unused optional fields. The source now normalizes action-specific fields while still rejecting scope overrides; a native adapter regression test covers it. An already-loaded Host generation initially retained the old callback. Installing the tested packed archive activated the final code: Plugin Manager reported `application: applied`, no warnings; a subsequent real `local_memory status` call with all optional standard fields returned `ok: true`, manual-only mode, the current canonical project, and zero notes. The actual Host uses the documented DSH_HOME fallback state root, so that fallback can be shared across profiles while project boundaries remain separate.
