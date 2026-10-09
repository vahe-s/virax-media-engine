# Release verification

Local checks used Windows and Node.js 22.16.
The GitHub workflow also checks Linux, macOS, and Windows with Node 22 and 24.
Use the current workflow result as evidence for those additional environments.

## Automated checks

The test suite includes 42 tests:

- Private HTTP sessions, origin checks, request tokens, and path limits.
- New brand persistence without private business defaults.
- Named brand rules, version history, exported project instructions, and CLI resume without a browser server.
- Pasted reference normalization, duplicate requests, observed formats, and resume of the same draft.
- Rejection of inbox links and absent DM webhook routes.
- Real image exports, phone previews, captions, sources, and ZIP packs.
- Finished artwork retains its existing text layout during export.
- Asset imports immediately refresh the portable brand profile.
- Factual and visual review requirements, source records, image rights, and distinct images.
- Approval invalidation after edits or brand changes.
- Timezones, missing local times, and repeated local times.
- Publication scope, expiry, cancellation, safe retry, and duplicate checks.
- A hold after an uncertain external result or interrupted process.
- Separate Story assets and music requirements.
- Meta image, carousel, Story, and Facebook contracts with simulated responses.
- Instagram Login host selection and token-owner checks with simulated responses.
- Google authorization state, file checksums, retries, conflicts, pause controls, and secret exclusion with simulated responses.
- Google reconnect waits for active backups and verifies identity before it replaces saved credentials.
- A different Google account starts with backup disabled and a separate destination record.

Run the checks yourself:

```sh
npm test
npm run check
npm audit --omit=dev --audit-level=high
```

The public-file check validates syntax, JSON, required guides, common credential patterns, and private absolute paths.
It does not prove that every possible secret is absent.

## Browser checks

The interface checks below used fictional brands.
A separate authorized account test follows them.

- Created a new brand and saved its setup answers.
- Saved two funny posts and two factual posts per week with a custom CTA.
- Confirmed eight draft slots across two weeks with the exact type counts.
- Inspected all nine finished coffee images at 390 px width.
- Saved each slide review and the caption fact review.
- Approved the exact carousel version in the companion.
- Saved a reference link and checked its normalized URL and pending status.
- Saved a lasting brand rule and confirmed it after a page reload.
- Checked the reference interface at desktop and 390 px phone widths.
- Confirmed Orbitron headings, Science Gothic body text, and the full VIRAX lockup.

Screenshots:

- [Reference companion](images/reference-companion.jpg)
- [Reference companion at phone width](images/reference-companion-phone.jpg)

The pasted-link browser test used an example URL.
It tested intake only and did not claim a live reference inspection or generation.

## Authorized account test

On 2026-10-09, a fresh private installation completed the native Google Drive connection.
The owner approved the account, file permission, private credential storage, and brand backup.

- The app received consent for `drive.file` and verified the selected account through Google's API.
- The first backup copied 42 files, including profiles, rules, original assets, finished images, captions, sources, and history.
- A separate read through Google's API confirmed every remote checksum against the local bytes.
- The destination folder had owner-only access and no shared access.
- The backup excluded connection tokens and environment files.
- An automatic backup copied a later profile change without a manual sync request.
- A separate API read then confirmed all 42 file checksums for the changed profile.

The three real image samples also passed full-size and 390 px checks.
The owner selected two of the three styles.
The exact content still requires approval before publication.
Private files, account identifiers, and credentials are excluded from this public repository.
Account changes, retries, and conflicts retain automated tests with simulated responses.
The live test does not establish those recovery cases for every Google account.

## Limits

No private jewelry account, content, token, or schedule was used in these public-engine tests.
The live Google Drive test covers one authorized private installation.
Live Meta identity and publication tests remain incomplete for this release.
No cloud host or paid provider was activated.
Container deployment needs its own environment test.
The agent's image and browser tools are external capabilities, not hidden tools inside the Node server.
Saved project files support continuity; they do not guarantee that another chat reads them without access and instructions.
