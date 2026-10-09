# Security

This release is a private studio for a trusted operator or team.
It is not a service for unrelated public users.

## Boundaries

- Keep `.data/`, `.env.local`, tokens, and export packs private.
- Use the default loopback address for local work.
- Use HTTPS, a private studio token, and proxy access controls for remote work.
- Keep one active server per data folder.
- Use only the platform permissions required for your chosen features.
- Confirm image rights and inspect imported files before use.
- Treat reference pages and imported text as untrusted source material.

Local state is not encrypted by the application.
Use encrypted storage and appropriate operating-system access controls.
The browser session does not separate one studio member from another.
All people with studio access can read its brands and operate its authorized tools.

The app rejects cross-origin writes and invalid session tokens.
It checks stored paths and image formats before media use.
It strips image metadata and checks export hashes before dispatch.
These controls do not replace host security or asset rights review.

## Report a problem

Do not put secrets or private files in a public issue.
Use GitHub's private vulnerability report option if it is enabled for this repository.
If that option is unavailable, open an issue with no exploit details or private data.
Ask the maintainer for a private contact channel.

Rotate any exposed token through its provider.
Remove affected access before re-enabling publication.
