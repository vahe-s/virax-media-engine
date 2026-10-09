# Reuse audit

The engine began with a review of a private jewelry content workflow.
The review covered brand rules, slide design, quality gates, version records, and publication controls.

The public application uses these general patterns:

- A saved brand profile controls each task.
- Each slide has a purpose and visible evidence.
- Claims need source records and qualifications.
- Final images need a phone-size inspection.
- Content approval and publication permission have separate scopes.
- Queue operations need durable checkpoints and duplicate checks.

The implementation in this repository is separate and brand neutral.
No private database, customer message, token, account identifier, live schedule, or business artwork was copied.
The existing private project was left unchanged.

The public examples use a new fictional coffee brand and original generated artwork.
They do not reproduce private jewelry images or supplied social reference artwork.
The interface uses the owner's approved VIRAX logo and two fonts under the SIL Open Font License.
The logo is an engine identity asset, not a client content template.
No unrelated business logo or proprietary font was copied.
Dependencies keep their own package licenses.

The release check scans public text for common credential patterns and private absolute paths.
The final Git file list requires a separate human or agent inspection.
A pattern scan cannot prove that every possible secret is absent.
