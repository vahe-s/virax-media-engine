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

The local browser checks used fictional brands only.

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

## Limits

No private jewelry account, content, token, or schedule was used in these public-engine tests.
Live Google Drive and Meta account tests remain incomplete for this release.
No cloud host or paid provider was activated.
Container deployment needs its own environment test.
The agent's image and browser tools are external capabilities, not hidden tools inside the Node server.
Saved project files support continuity; they do not guarantee that another chat reads them without access and instructions.
