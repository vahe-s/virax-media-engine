# Online deployment

## What must stay online

The app includes a worker that checks due posts every 30 seconds.
The process and its private data must remain available at the due time.
The worker checks overdue items when the service returns.
An item with expired permission fails instead of publishing.

Use one persistent service for each private data folder.
Do not run two independent server replicas against the same database.
This release has no distributed worker leases or hosted service.

An online service removes the need for your personal computer to stay awake.
It still needs hosting, storage, backups, and credentials for any selected provider.
No hosting account or paid plan is created by installation.

## Local use

`npm start` binds to `127.0.0.1` by default.
Only that computer can reach the app through this address.
The default interface is intended for a trusted local user.
Do not forward the port or expose it through a public tunnel.

## Remote use

1. Choose a host with persistent storage and a supported Node runtime.
2. Install the app with `npm ci`.
3. Choose a private directory for `ENGINE_DATA_DIR`.
4. Set `ENGINE_HOST=0.0.0.0`.
5. Set `ENGINE_ORIGIN` to the exact HTTPS address for the studio.
6. Create a random `ENGINE_ACCESS_TOKEN` with at least 32 characters through the host's secret controls.
7. Put an HTTPS reverse proxy in front of the app.
8. Preserve the public Host header when the proxy forwards requests.
9. Block direct public access to the app's internal port.
10. Use host-level access controls and sign in through the app's private access screen.
11. Keep live publication off until one authorized test succeeds.
12. Configure backups and service restart controls.

The app refuses remote mode without the HTTPS origin and access token.
Remote cookies use Secure, HttpOnly, and SameSite settings.
The token is a shared studio secret, not a user account system.
Add rate limits at the reverse proxy.
Keep the proxy and the app on a private network.

## Optional container

The Dockerfile is provided as a deployment starting point.
Container deployment needs a separate environment test.

```sh
docker build -t virax-engine-machine .
```

Configure a persistent volume at `/data`.
Run the container behind your HTTPS reverse proxy.
Supply the required remote settings through the container platform's private secrets.
Do not bake tokens into the image.
Do not expose port 4318 directly to the public internet.

## Backups and updates

1. Stop the worker service before a simple file backup.
2. Back up the complete private data folder, including assets and exports.
3. Keep the backup private and encrypted through your storage provider.
4. Restart the service after the backup completes.
5. Test restoration in a separate folder with live publication disabled.

A copied database alone does not contain image files.
Keep uncertain publication records during recovery.
Do not erase them to force another attempt.

## Google Drive

Drive can hold private profiles, sources, and finished packs.
The native connection supports manual and automatic backups for each enabled brand.
Register the hosted studio's exact HTTPS callback with your own Google app.
Follow [Google Drive setup](google-drive.md) and complete an authorized live test.
Drive does not run the server or keep the queue awake.
The app does not automatically synchronize changed rules to other agents.
Give each task the current profile link and version.
