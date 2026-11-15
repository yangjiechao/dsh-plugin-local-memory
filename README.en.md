# Local memory for DSH

Manual, project-isolated SQLite notes for DeepSeek Harness. Adds **Settings → Local memory** and the `local_memory` tool. No Hindsight server, embeddings, external API key, runtime npm dependencies or install scripts.

## Usage

Select a registered workspace in Settings. Create a note explicitly, then search, open, edit or delete it. Deletion asks for confirmation. Edits and deletion use optimistic versions and refuse to overwrite a newer record.

Alternatively ask the assistant to remember a small project convention, recall a relevant note, or explicitly update/delete it. Tool actions: `status/list/search/get/save/update/delete`. Writes should only follow an explicit user request. update/delete require the ID and current expectedVersion obtained from get.

The plugin never captures transcripts, scans repositories, summarizes conversations, calls an extra model or automatically injects notes. Reading notes through the assistant puts their text into model context; a cloud model provider receives that content. Notes are untrusted historical data, not instructions or authorization.

## Scope and privacy

- The tool is bound to the session's initial project directory, not a temporary working-directory change. No arbitrary path or workspace parameter. The owner-only UI deliberately selects one registered workspace. Canonical real paths merge directory aliases, not unrelated projects.
- Renaming/moving a project does not automatically migrate its notes. Removing a workspace registration does not remove notes.
- Database: `$DSH_PROFILE_DIR/state/local-memory/memory.sqlite`, or `$DSH_HOME/state/local-memory/memory.sqlite` when the Host does not export DSH_PROFILE_DIR. The fallback may be shared across profiles; canonical project paths remain isolated. Settings shows the actual path. Missing absolute roots fail closed.
- Plaintext storage, with owner-only POSIX file/directory modes. Not an encrypted vault. Common credential patterns are rejected, but detection is incomplete: redact sensitive information yourself.
- Deleting a conversation does not delete independently saved notes. Deleting a note does not retract copies in chat logs, cloud requests, backups or other systems.
- SQLite and FTS secure-delete are enabled, with no automatic revision archive or backups. This is not guaranteed SSD erasure. Arrange and manage any desired backups yourself.
- No Hindsight migration, remote calls or remote data deletion. Uninstalling Hindsight does not retract information already injected into old conversations.

## Limits and compatibility

120-character title; 8000-character body; eight tags of up to 24 characters; 1000 notes per project and 10000 total. Settings uses pages of 20. Tool list/search returns at most eight records, with a 6000-character aggregate body/preview budget and disclosed truncation; characters are not precise tokens. Notes render as text, not executable HTML/Markdown.

DSH `0.2.2-rc.3`, Node `>=22.13.0`. Install this directory through DSH Plugin Manager, not by manually editing a profile. Source: https://github.com/yangjiechao/dsh-plugin-local-memory . Install with `github:yangjiechao/dsh-plugin-local-memory` or a local directory. Updating an already loaded Host generation may require restarting DSH; follow the installation outcome.

```bash
npm run check
npm test
npm pack --dry-run
```

Tests use owned temporary databases, never user notes. See [verification](./VERIFICATION.md) for evidence and unverified behavior. MIT license.
