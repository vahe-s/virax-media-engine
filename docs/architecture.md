# Architecture

## One private studio

Version 0.1 serves one trusted operator or team.
Several brands can share that private studio.
It has no user roles or isolation between studio members.
Do not expose it as a public service for unrelated customers.

The user's project chat is the main interface.
Their capable agent performs research, media creation, and file actions with its own tools.
The Node.js engine stores the work and provides an optional browser companion.
SQLite stores records, version history, publication operations, and an audit trail in one local database.
No build step or paid model connection is needed for the demo.

```text
Project chat -> Agent tools -> Engine CLI and private files
                                      |
                            Optional browser companion
         |
Interview -> Brand profile -> Brief -> Real assets
                                      |
                               Export and review
                                      |
                           Exact-version approval
                                      |
                     Account permission + local time
                                      |
                           Persistent local queue
                                      |
                 Demo / Native handoff / Meta adapter
                                      |
                    Receipt or reconciliation hold
```

## Modules

| File | Responsibility |
| --- | --- |
| `src/store.mjs` | SQLite records, transactions, snapshots, audit, operation ledger |
| `src/interview.mjs` | Questions, follow-ups, styles, and two-week suggestions |
| `src/references.mjs` | Pasted links, required inspection, draft links, and resume context |
| `src/profile.mjs` | Portable brand files and project instructions |
| `src/creative.mjs` | Post types, exact mixes, repeatable random choices, and CTAs |
| `src/engine.mjs` | Brands, post versions, review rules, permissions, schedules |
| `src/media.mjs` | Asset validation, image exports, hashes, portable packs |
| `src/time.mjs` | Timezones and ambiguous or missing local times |
| `src/providers.mjs` | Provider support and Meta request flow |
| `src/worker.mjs` | Due items, duplicate checks, receipts, failure recovery |
| `src/drive.mjs` | Google authorization, private backup sync, conflicts, and upload verification |
| `src/server.mjs` | Private HTTP interface, session checks, routes, worker timer |
| `src/cli.mjs` | Agent commands against the same private data |
| `public/` | Interface without a framework or external runtime scripts |

## Data and files

```text
.data/
  engine.sqlite
  brands/BRAND_ID/brand-profile.json
  brands/BRAND_ID/brand-profile.md
  brands/BRAND_ID/PROJECT-INSTRUCTIONS.md
  assets/BRAND_ID/ASSET_ID.png
  exports/POST_ID/vVERSION/slide-01.jpg
  exports/POST_ID/vVERSION/slide-01-phone.jpg
  exports/POST_ID/vVERSION/slide-01.svg
  connections/google-drive.json
```

Image files use generated identifiers, rather than user-supplied paths.
Imports normalize JPEG, PNG, and WebP images and remove metadata.
Google connection tokens remain private and never enter Drive backups.
Each source and final image has a SHA-256 hash, which identifies its exact bytes.
The worker checks final hashes before publication.
Required fonts need valid licensed files with an actual readable family name.

The native text exporter provides a basic readable layout.
It does not apply every custom logo or layout instruction automatically.
An agent can import complete artwork from an approved design tool as image-only media.
Keep the original design files beside the exported pack when another tool creates them.

## States and permissions

```text
draft -> ready_for_review -> approved -> scheduled_local
                         |                   |
                      rejected          publishing
                                             |
                     published / simulated_published
                                             |
                          failed / verification_required

scheduled_local -> manual_due -> published_reported
```

`approved` confirms content, not publication permission.
Each grant names a brand, provider, account, platform, placement, scope, and expiry.
Post and batch grants also identify the permitted versions.
Ongoing grants still require approval for each post.

An edit resets approval, quality checks, and the old schedule.
A changed brand profile invalidates affected approvals.
A published version stays locked; create a separate revision.
Feed posts and Stories use separate records, exports, and permission.

## Duplicate prevention

The worker claims a due item in a database transaction.
Its operation key includes the post, version, platform, and placement.
The commit checkpoint is saved before the request that can publish.
An uncertain response creates a reconciliation hold.
The worker never repeats that commit automatically.

This favors a visible hold over a duplicate post.
It cannot guarantee exactly-once delivery across an external network.
Only a confirmed failure before the commit can use the safe retry command.
Operate one active server per private data folder.

## Provider extension

A publication adapter implements `publish(post, grant, checkpoint)`.
It must confirm the destination account before a commit.
It must save a checkpoint before each consequential external action.
It must return a receipt that distinguishes simulation, reporting, and independent verification.
Add contract tests and failure tests before declaring support.

Image creation currently uses the agent task contract.
The server does not inherit tools from ChatGPT, Dot, or Codex.
It does not contain a second chat model or an Instagram inbox listener.
The CLI can save rules and references while the browser server is off.
Add a separate provider only after its cost and permission model is explicit.
