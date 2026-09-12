# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue, discussion, or pull request for security
problems.

The preferred channel is **GitHub's private vulnerability reporting**:

1. Go to <https://github.com/fredrikburmester/streamystats/security/advisories/new>.
2. Fill in a clear title and a description with reproduction steps.
3. Submit. The maintainer is notified privately and can collaborate with you
   on a fix and a CVE in the same draft.

## What to include in your report

A useful report contains, at minimum:

- A short summary of the issue and the impact in one or two sentences.
- The affected version (a release tag or commit SHA).
- Step-by-step reproduction. Concrete `curl` commands or short scripts beat
  prose every time.
- The expected vs. actual behaviour.
- Your assessment of severity and any CVSS vector you'd suggest.
- Whether the issue is exploitable pre-authentication or only post-authentication.
- Any logs, screenshots, or HTTP traces that help.

If you're not sure whether something is a security issue, err on the side of
reporting it privately. We'd rather triage a non-issue than miss a real one.

## Scope

In scope:

- The source code in this repository (`apps/nextjs-app`, `apps/job-server`,
  `packages/database`, the published Docker images, the deployment manifests
  under `docker/`, and the helper scripts at the repo root).
- The published container images on `ghcr.io/fredrikburmester/streamystats-nextjs`
  and `ghcr.io/fredrikburmester/streamystats-job-server`.

Out of scope:

- Jellyfin itself. Report Jellyfin issues to the
  [Jellyfin project](https://github.com/jellyfin/jellyfin/security/policy).
- Vulnerabilities in third-party dependencies. Please report those upstream
  first; if Streamystats is affected by a known dependency CVE, a regular
  issue or PR to bump the version is fine.
- Findings that require an attacker to already be a Streamystats administrator
  or to have host-level access. Admins are trusted in our threat model; please
  still mention them, but they will not be treated as security advisories.
- Misconfigurations of the operator's environment, for example exposing the
  job-server port (3005) to the internet, running with a default
  `POSTGRES_PASSWORD`, or omitting `SESSION_SECRET`. We'll happily improve
  documentation and defaults, but these aren't tracked as vulnerabilities.
- Denial of service that requires an unrealistic request volume against an
  unprotected deployment. Streamystats expects a reverse proxy or platform-level
  rate limiting in front of it.

## Supported versions

Security fixes ship in the latest minor release on `main`. Older versions are
not patched. If you run an older version, the recommended action is to upgrade.

| Version | Supported          |
| ------- | ------------------ |
| Latest minor on `main` | yes |
| Anything older | no |

## Safe-harbour

Good-faith security research is welcome. We won't pursue legal action against
researchers who:

- Stay within the scope above.
- Don't access, modify, or destroy data belonging to other users or other
  Streamystats deployments.
- Don't perform tests against deployments they don't own or have explicit
  permission to test.
- Don't publicly disclose details before a coordinated release window.

If a finding requires interacting with other people's deployments to confirm,
stop, write up what you have, and report it. We'll help you reproduce it
against a controlled instance.

## Credit

Reporters are credited in the published advisory and in the release notes for
the fix, unless they ask to remain anonymous. If you'd like a specific name,
handle, or affiliation listed, mention it in the report.

Thank you for helping keep Streamystats and its users safe.
