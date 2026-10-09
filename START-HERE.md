# Start VIRAX in chat

VIRAX works through the user's existing AI agent.
The project chat is the main interface.
The local browser companion is optional.

## For the person

1. Create a separate project for your business.
2. Paste the repository link into a chat in that project.
3. Say: “Set up VIRAX for my business.”
4. Answer the agent's questions in your own words.

Keep future requests in that project.
Paste reference links directly into chat.
Use the companion when you want to see, approve, or organize the work.

If your agent cannot create project instructions, copy [PROJECT-INSTRUCTIONS.md](PROJECT-INSTRUCTIONS.md) into them.
Keep the current private brand profile in the project sources or a connected private folder.

## For the agent

1. Read AGENTS.md and docs/chat-workflow.md.
2. Check your actual file, browser, image, research, and execution tools.
3. Find the current brand profile before any interview.
4. Reuse saved answers and rules.
5. Ask at most three short questions at a time.
6. Save each useful answer.
7. Suggest suitable content and show actual style samples.
8. Accept reference links in chat.
9. Inspect the actual reference before you choose its format.
10. Create finished original media with your authorized tools.
11. Check facts and inspect every final image.
12. Return the result in this chat.
13. Open the companion only when a visual view helps.
14. Use existing publication permission only within its exact scope.

Do technical work yourself when tools and authorization permit it.
Do not give a nontechnical user a terminal checklist when you can run those steps.
Do not force the user through the browser questionnaire.
Use the questions as a conversational guide.

Save lasting owner instructions in the brand profile.
Keep temporary changes in the task.
Explain where the rule was saved and which version now applies.
Do not promise permanent memory without a saved file or connected source.

## Install only what the task needs

When shell access is available:

```sh
git clone https://github.com/vahe-s/virax-engine-machine.git
cd virax-engine-machine
npm ci
npm run engine -- doctor
```

Use Node.js 22.16 through 24.x.
The command interface works without a running browser server.
Use `npm start` when the companion, queue, or native Drive sync is needed.
Private data lives in `.data/` by default.

When shell access is unavailable, save the profile in authorized project files or connected storage.
Use the agent's available media and research tools.
Do not call that a server installation.
Explain a missing capability only when it blocks the current task.

## References

Accept a link pasted into chat or **References → Paste the reference link**.
Do not ask users to send a DM between personal and business Instagram accounts.
Do not install inbox watchers, sender pairing, DM triggers, or messaging webhooks.
Read docs/references.md for the resumable workflow.

## Account connections

A repository link does not grant account access or transfer website sessions.
Use private login or connection controls when needed.
Never request a token or password in normal chat.
No paid service starts by default.

## Continue elsewhere

Give the next chat these current private files:

- PROJECT-INSTRUCTIONS.md
- brand-profile.json
- brand-profile.md
- Approved examples and the current task pack

Read the database's current version when the engine is available.
Check the latest source version when only project files or Drive are available.
An old approval does not authorize a new version.

See docs/platforms.md for tested features and live connection limits.
