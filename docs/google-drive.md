# Google Drive sync

The engine can copy a brand's work to a private Google Drive folder.
The connection uses Google's official API and `drive.file` permission.
That permission covers files created by this app or explicitly shared with it.
It does not request unrestricted access to the whole Drive.
See [Google's scope guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## What is saved

- The current brand profile in JSON and Markdown.
- Instructions for an agent that opens the folder.
- Project instructions and lasting owner rules.
- Pasted reference links, observations, and draft progress.
- Brand versions and post versions.
- Original imported images, logos, fonts, and brand guides.
- Final images and native editable overlays.
- Captions, alt text, claims, and source records.
- Review, schedule, permission, and publication records.

The backup excludes passwords, environment files, browser sessions, and connection tokens.
Keep the Drive folder private because it contains business information.
The engine never makes the folder public or changes its sharing permissions.

## Connect your own Google application

Each installation needs its own OAuth client.
OAuth is Google's flow for a user to grant access without sharing a password.

1. Create a project in the Google Cloud console.
2. Enable the Google Drive API.
3. Configure the Google Auth consent screen for your intended users.
4. Add the `https://www.googleapis.com/auth/drive.file` scope.
5. Create an OAuth client for a web application.
6. Register the exact callback address for your studio.
7. Store its client ID and secret in `.env.local` or your host's secret controls.
8. Restart the engine.
9. Open **Settings → Google Drive sync → Connect Google Drive**.
10. Choose the intended Google account and review its consent screen.
11. Return to Settings and enable sync for the active brand.
12. Choose manual or automatic sync.
13. Select **Sync now / retry** for the first copy.
14. Verify the folder link and the successful sync status.

Local callback example:

```text
http://127.0.0.1:4318/api/drive/callback
```

Environment keys:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-private-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:4318/api/drive/callback
```

For a remote studio, register its exact HTTPS callback instead.
Use the same host, scheme, and port in the browser and callback setting.
Do not put real credentials in a chat or this public repository.

Google testing status can restrict users and token lifetime.
Complete the current Google consent and verification requirements before broad distribution.
Follow [Google's authorization guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## How sync behaves

The engine creates one private folder for each enabled brand.
Automatic sync checks after changes while the app is online.
Manual sync runs when you select the button.
The app saves file identifiers before uploads and verifies the returned file checksums.
It uploads changed files and retains prior version paths.
Google's [upload guide](https://developers.google.com/workspace/drive/api/guides/manage-uploads) describes the resumable upload method.

This release synchronizes from the engine to Drive.
It does not automatically import edits made in Drive.
A changed remote file creates a conflict instead of a silent overwrite.
Preserve or explicitly import that edit before another sync.
Deleted remote files and folders require a manual check.
The app does not mirror deletions into Drive.

Connection errors appear in Settings.
A retry uses the saved file identifiers to avoid duplicate copies.
Disconnect revokes the Google connection and stops sync.
Existing Drive files remain available.

## Continue from your phone

Give Dot access to the private folder through its Google Drive connection.
Ask it to read `READ-ME-FIRST.md`, the current brand profile, and the approved examples.
Keep those sources in the separate project for this business.
Talk to the agent in that project for normal content requests.
Tell it which task and version to continue.
A Drive folder alone does not grant another agent account access or permission to publish.

## Recovery

Download the needed profile, assets, and versioned media from Drive.
Import them into a separate studio with live publication disabled.
Review the restored files before any new publication.
Treat old permissions and schedules as historical records during recovery.
Do not replay them automatically.

Drive stores the work. A computer or server still runs the queue and sync service.
The integration has mock tests; this release does not claim a live account test.
