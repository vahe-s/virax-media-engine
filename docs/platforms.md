# Platform connections

## Support in version 0.1

| Function | Status | What the user needs |
| --- | --- | --- |
| Brand interview and saved rules | Chat is primary; companion is optional | Capable agent and private files |
| Pasted reference links | Implemented intake and draft records | Agent inspects actual media and creates the adaptation |
| Instagram DM triggers | Excluded from the public engine | Use a pasted public reference link |
| Image creation | Agent-assisted | An authorized image tool or supplied images |
| Original image import and exports | Implemented | JPEG, PNG, or WebP images |
| Instagram Feed single images | Meta adapter; one authorized post verified live | Professional account, authorized app, token, public media URLs |
| Instagram Feed carousels | Meta adapter; mock-tested | Professional account, authorized app, token, public media URLs |
| Instagram image Stories | Meta adapter; mock-tested | Eligible account and permissions |
| Facebook Page photo posts | Meta adapter; mock-tested | Page token and approved permissions |
| Facebook Stories | Manual | Native platform or supported browser tools |
| Music | Manual | Track rights and native format support |
| Reels and other video | Agent-assisted/manual | Video tool and native publication path |
| Other platforms | Manual | Native app or separately verified connector |
| Google Drive backup sync | Native connection; manual and automatic copies verified live | Own Google OAuth app and account consent |
| Google account changes | Separate destinations; mock-tested | Enable each brand backup again after an account change |
| Live Google Drive test | Private account test passed on 2026-10-09 | Each installation still needs its own consent and file check |
| Live Meta account connection | Instagram identity and publication limit reads passed on 2026-10-09 | Each installation needs its own account check and publication test |
| Live Meta publication test | One Instagram Feed image passed on 2026-10-09 | Each account and additional format still needs its own test |

The API adapter supports Instagram Login and Facebook Login tokens.
It does not include an OAuth application or a hosted token exchange.
Each installation supplies its own credentials through the environment.
Identity verification alone does not establish every publication permission.

## Meta setup

1. Create or use your own Meta developer application.
2. Select the Instagram and Facebook functions you actually need.
3. Complete Meta's account, role, permission, and review requirements.
4. Obtain the appropriate token through Meta's supported flow.
5. Copy `.env.example` to `.env.local`.
6. Set the Graph API version supported by your application.
7. Set the token and the intended account IDs.
8. Run `npm run engine -- meta-verify`.
9. Confirm the returned account names and numeric IDs.
10. Stage the approved exports on a public HTTPS media host.
11. Grant permission for one test post in the intended account.
12. Set `ENGINE_LIVE_PUBLISH=true` for that authorized test.
13. Inspect the result and the platform readback before production use.

Do not paste a real token into a chat, issue, or public repository.
Save the numeric account ID in each Meta publication grant.
The adapter checks both the name and ID before publication.
Use the platform's private authorization flow or the host's secret controls.
The engine does not reuse credentials from another application.

For Instagram Login, set `META_LOGIN_TYPE=instagram`.
Use `instagram_business_basic` and `instagram_business_content_publish` for profile access and content publication.
The adapter sends this token only to `graph.instagram.com`.
It checks the token owner's `user_id` and username before publication.
Do not request message or comment permissions for this workflow.
For Facebook Login, use `META_LOGIN_TYPE=facebook` and the corresponding Page or user token.
An Instagram Login token cannot authorize a Facebook Page.

## Public media URLs

Set `META_PUBLIC_MEDIA_BASE` to a controlled HTTPS asset location.
Copy only the approved media into this structure:

```text
BASE/POST_ID/vVERSION/slide-01.jpg
BASE/POST_ID/vVERSION/slide-02.jpg
```

Keep version paths immutable.
Check the uploaded bytes against the export manifest hashes.
Private Drive share pages are not direct image URLs.
This release does not upload to a cloud media host automatically.
An authorized agent can perform that step with a connected storage tool.

## Schedules and music

The engine stores a durable local schedule.
At the due time, its worker calls the selected provider.
Meta does not hold a native schedule from this queue entry.
The worker service must remain online.

Use account activity data for timing when it is available.
Treat external benchmarks as hypotheses to test.
Save the source, check date, audience timezone, and rationale with the plan.
Do not promise an engagement rate from a time slot.

Required music blocks the automatic Meta path in this release.
Use the native manual path and inspect the attached audio.
Never replace a requested carousel with a Reel without permission.
Never assume music can be added after publication.

## Official references

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/docs/pages-api/posts/
- https://www.postman.com/meta/instagram/

Platform capabilities and permissions change.
Check the current official documentation before enabling an account.
Meta's documentation was not fully retrievable during this release audit.
The adapter tests validate request and recovery behavior with mocked responses.
The separate live test verified one Instagram account identity and its publication limit response.
A later authorized test published one Feed image through the local queue.
The API readback confirmed the post ID, caption, image type, and permalink.
The visible Instagram post matched the approved image and caption.
This did not verify every permission.
It does not establish eligibility for other accounts or formats.
