# Local memory plan

User request: remove the current DSH Hindsight integration and implement the lightweight local memory approach discussed in this session.

## Scope

- Current-profile Hindsight bundle removed through Plugin Manager; do not call its cloud API or erase remote/shared application data.
- Own a local SQLite database under the DSH state root, preferring the Host profile-directory variable when available. No extra service, cloud API, embeddings or automatic model calls.
- Manual notes only: create, inspect, edit, search and delete. No transcript capture, repository scan or automatic summarization.
- Canonical workspace path is the project boundary. Tool callers cannot choose another project; authenticated-owner UI selects an existing registered workspace.
- UI in Settings: project selector, bounded search/list, explicit editor, optimistic versions and per-note delete warning.
- One store/service operation used by UI and the Agent tool. Keep a small static instruction describing how to call the tool, but do not auto-inject saved notes.
- Treat note text as untrusted historical data, never authority. Bound all inputs/results and reject common credential patterns.
- Notes remain separate from conversation logs. Deleting a source chat does not remove a note; deleting a note does not retract copies already in chats, provider requests or backups.

## Verification

Use synthetic temp databases for persistence, project isolation, injection-literal queries, corruption/version gates, optimistic edits/deletion, quotas, credential rejection, owner-only RPC and tool adapter tests. Install only after final syntax/test/package and UI/UX review; verify live Settings registration. Report visual limitations honestly.

The user subsequently explicitly requested uploading this plugin to their GitHub. Publish only the final source, tests, metadata and documentation under MIT; exclude databases, journals, local state, credentials, package archives and Git internals.
