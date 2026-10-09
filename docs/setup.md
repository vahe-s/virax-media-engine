# Setup guide

Start in the project chat with START-HERE.md.
The agent handles these technical steps when its tools permit them.
The browser companion is optional for normal content requests.

## With a computer or cloud development environment

Use Node.js 22.16 through 24.x and Git.
The tested local runtime is Node.js 22.16.
Node 22 may show an experimental SQLite notice.

```sh
git clone https://github.com/vahe-s/virax-media-engine.git
cd virax-media-engine
npm ci
npm run engine -- doctor
npm start
```

Open http://127.0.0.1:4318.
The app runs on Windows, macOS, and Linux with the supported Node version.
Cross-platform installation depends on the native image packages for that system.
The CI workflow checks Linux, Windows, and macOS with Node 22 and 24.
Check its latest result before relying on a specific system.

No external account or API key is needed for the demonstration.
Select **Explore the demo** to load the fictional coffee brand.
Use **Add a brand** for manual setup in the companion.

## With ChatGPT or Dot

Give the agent the repository URL and the request from START-HERE.md.
Use a separate project for each business.
Add PROJECT-INSTRUCTIONS.md and connect the current private profile.
Ask it to inspect its available tools before setup.
Provide the private profile when you continue an existing brand.

Codex reads AGENTS.md within a project.
Other environments may require an explicit instruction to open that file.
Dot needs the relevant apps connected to the right accounts.
Its cloud browser has separate website sessions.
The repository does not transfer browser logins or grant account access.

Official guidance:
- https://learn.chatgpt.com/docs/projects?surface=app
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://learn.chatgpt.com/docs/dots/computers-and-apps

## Without shell access

1. Open START-HERE.md and docs/onboarding.md with the agent.
2. Answer the agent's questions in chat and save a private brand profile.
3. Attach approved examples and references.
4. Use the agent's image tools to create the media.
5. Keep the claim record, caption, and alt text with the images.
6. Ask the agent to inspect each final image.
7. Use a supported platform connection or the native manual path.

This is a guided workflow, not a running server installation.
For the application, use a supported computer or hosted environment.

## Google Drive

Download **Brand instructions** from the Studio page.
Use **Settings → Google Drive sync** for native manual or automatic backups.
Connect your own Google app with the [Drive guide](google-drive.md).
Alternatively, upload private packs through an authorized Drive tool.
Keep each business in a separate private folder.
Give future tasks the folder link and the instruction to read the current profile first.
Drive stores files. It does not execute the publication queue.

## Costs

The engine code and included demo use no paid API calls.
Your chosen image tools, social services, and hosting can have separate costs.
A ChatGPT subscription does not automatically authorize every provider bill.
Confirm the provider and spending limit before paid work.
