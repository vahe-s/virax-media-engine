# Work through the project chat

The user talks to their existing agent.
The agent performs the work with its actual tools.
The companion supports visual review and file controls.

## First conversation

Ask for the business name, what it does, and its website.
Save these answers before the next questions.
Study the actual site when access exists.
Offer two equal paths: "I have references" and "I do not have references. Give me ideas."
Let the user combine both paths or give a custom request.
Never require a reference to continue.
Suggest relevant content ideas from the business, audience, and verified research.
Show seven distinct visual directions, with actual previews tailored to the business.
Use the style catalog as a starting point; respect supplied references and brand rules.
Let the user select, combine, refine, or replace the directions.

Continue through the interview topics in docs/onboarding.md.
Ask up to three relevant questions at a time.
Skip questions that the profile already answers.
Accept free text, exact counts, random choices, and custom prompts.
Show real style samples before a full batch.
After the user chooses a direction, create one finished sample for approval.
Save the approved sample's post ID and exact version in the brand's approved-example records.
Do not treat a catalog selection as approval of a finished sample.
Read docs/helpful-tips.md and give useful tips during normal work.

Do not expose internal command names or JSON fields unless the user needs them.
Ask the user to act only when their account, consent, file, or choice is required.

## A separate project for each business

Use a separate ChatGPT project, local agent project, or equivalent work area.
Keep the public engine code separate from private business data.
Put PROJECT-INSTRUCTIONS.md in the project's instruction field when supported.
Attach or connect the current profile and approved examples.

A ChatGPT project shares instructions and connected sources across its chats.
It does not grant local folder access by itself.
See [official project guidance](https://learn.chatgpt.com/docs/projects?surface=app).

A Dot environment can use its own computer or an authorized connected computer.
Access and browser sessions depend on that environment.
See [official computer and app guidance](https://learn.chatgpt.com/docs/dots/computers-and-apps).

Do not promise that another agent can reach this computer's localhost.
Start the companion in an environment that the active browser can reach.
A repository link alone does not create that connection.

## Save lasting changes

Interpret the owner's request in context.
“From now on” or “always” usually defines a lasting rule.
“Only this post” defines a task change.
Ask a short question only when the scope is unclear and changes the result.

Use brand-save for structured preferences such as colors or frequency.
Use brand-rule for named instructions such as a rule against hands in product images.
Use the same key when the owner changes an existing rule.

Example rule file:

```json
{
  "version": 3,
  "key": "product-framing",
  "text": "Show complete jewelry without hands."
}
```

Agent command:

```sh
npm run engine -- brand-rule BRAND_ID rule.json
npm run engine -- chat-context BRAND_ID
```

The engine rejects a stale version.
It retains the old profile in history.
It exports the current profile and project instructions into `.data/brands/BRAND_ID/`.
Changed brand rules invalidate affected approvals and schedules.

Check the returned version before you report success.
Copy or synchronize the latest profile to the user's authorized project sources.
Native Drive sync can do that after connection.
Without native sync, use an authorized file tool and verify the result.

## One-post changes

Read the current post and version.
Use post-save to apply the requested change.
Do not change the permanent profile for a temporary instruction.
The revised post needs a fresh factual and visual review.

## Reference requests

A link in chat is a request for the agent to inspect and adapt it.
Use docs/references.md.
The local server records the work; it does not generate media by itself.

## Open the companion when useful

Use the companion for:

- Comparison of final images.
- Review and exact-version approval.
- Asset uploads and the library.
- The publication calendar.
- Manual settings and connection controls.

The agent starts the server and opens its reachable address.
Return to chat for normal requests.
Do not build a second fake chat that only repeats scripted answers.

## Background work

Active chat tasks use the agent's available execution environment.
Scheduled posts need the selected worker to remain online.
Drive sync needs the sync service online when it runs.
Do not describe local schedules as guaranteed cloud execution.
