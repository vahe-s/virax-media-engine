# Troubleshooting

| Symptom | Check and action |
| --- | --- |
| `node:sqlite` is unavailable | Use Node.js 22.16 through 24.x. Run `node --version`. |
| Native image package fails to install | Use a supported Node version and operating system. Run `npm ci` on the destination system. |
| Port 4318 is occupied | Set `PORT` to a free port. Do not stop an unrelated service. |
| Blank interface after an update | Reload the page. Inspect the browser console and the server log. |
| Private session expired | Reload the app. Enter the remote studio token if required. |
| Required font fails | Upload a valid licensed TTF or OTF file. Use the family name reported by the app. |
| Text does not fit | Shorten the copy. The exporter refuses text that exceeds its safe area. |
| Approval is unavailable | Export the current version and inspect every slide. Resolve the quality errors. |
| Old approval disappeared | A post edit or brand change requires a new review. |
| An image hash changed | Import the changed file as a new asset. Export and review a new post version. |
| Queue did not run | Keep the service online. Check the timezone, due time, permission expiry, and worker log. |
| Local time occurs twice | Choose the first or second occurrence during the clock change. |
| Local time does not exist | Choose another time after the clock moves forward. |
| Meta is not connected | Configure your own app, token, API version, and account IDs. Run `meta-verify`. |
| Meta cannot read an image | Check its direct public HTTPS URL and bytes. A private Drive share page is insufficient. |
| Publication result is uncertain | Check the native account and saved external IDs. Do not press retry or duplicate the post. |
| Music is required | Use the native manual path. Verify the track before the final action. |
| Dot produces a different style | Give it START-HERE.md, the current private profile, and the approved examples. |

## Inspect state with the agent

```sh
npm run engine -- doctor
npm run engine -- status
npm run engine -- post-show POST_ID
npm run engine -- quality POST_ID
```

State can contain private business content.
Do not paste it into a public issue without review and redaction.
Never include tokens or private account identifiers in a public support request.

## Uncertain publication

An uncertain result is a deliberate hold, not a safe retry.
Inspect the destination account and the operation record.
If a post exists, record its actual URL through the native result path.
The result remains reported unless the API independently verifies it.
If no post is visible, do not assume the commit failed.
Resolve the provider state before a new publication action.
