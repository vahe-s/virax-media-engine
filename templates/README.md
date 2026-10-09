# Templates

The agent uses these files behind the project chat.
Users can state their request in ordinary language.
Use `reference.json` for a pasted link and `rule.json` for a lasting owner instruction.

Copy templates into a private folder before you edit them.
Replace the example values with confirmed answers and returned identifiers.
Read the current version before a save.
Do not store real tokens in these files.

| File | Use |
| --- | --- |
| `answers.json` | Save one stage of business answers with `brand-save` |
| `brand-profile.json` | Portable example for a chat without shell access |
| `post-brief.json` | Create a draft with `post-create` |
| `finished-manifest.json` | Import a complete nine-slide image sequence |
| `checks.json` | Record an actual visual inspection with `review` |
| `publication-grant.json` | Record the user's publication permission |
| `schedule.json` | Choose the local time and timezone |
| `receipt.json` | Record an actual native platform result |
| `agent-setup-prompt.md` | Start or continue the workflow in another agent |

`false` quality checks and rights fields are deliberate defaults.
Change them only after the corresponding verification.
The example grant uses the demo provider, which sends nothing.
The example dates are placeholders, not current publication instructions.

The finished manifest resolves image paths relative to its own location.
Add `postId` and the current `version` when you update an existing job.
Omit them only when you intend to create another draft.
Keep the reference format and text approach.
