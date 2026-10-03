# Security policy

## Reporting a vulnerability

**Please don't open a public issue for security problems.** Report them privately through
[GitHub private vulnerability reporting](https://github.com/nielsbrakel/WidgetBox/security/advisories/new)
(repository → **Security** → **Report a vulnerability**).

Include the app and widget, the app version, where you view the dashboard, steps to reproduce and the
impact you see.

What to expect:

- An acknowledgement within **7 days**.
- An assessment and a fix plan within **30 days**. Fixes ship in a patch release of the affected app.
- Please give reasonable time to release a fix before you disclose publicly (90 days at most).

## Supported versions

Only the **latest version** of each app in the Homey App Store receives security fixes.

## Threat model

Each WidgetBox app runs in two places: the app process on the Homey Pro (`app.js`, `lib/`,
`widgets/*/api.js`) and the widget pages in the dashboard webview (`widgets/*/public/`).

### Trust boundaries

| Component | Trust | Notes |
| --- | --- | --- |
| App process on the Homey (`app.js`, `lib/`, `api.js`) | **Authority** | The only writer of app storage. Validates every widget API call: ids by pattern, sizes capped, unknown fields dropped. |
| Widget pages | Untrusted input | Treat widget settings and API responses as data: inserted with `textContent` or mapped through allow-lists, never as HTML. |
| Widget settings | Owner-controlled, treated as untrusted | Validated where they are used (for example video links are parsed to an id, colors map to fixed tokens). |
| Buienradar, Windy and YouTube | Untrusted | Fetched from fixed hosts with timeouts; responses are normalised before they reach a widget. Embeds load in cross-origin iframes. |

### What WidgetBox protects

- **No runtime dependencies.** The apps ship no npm packages; everything that runs on the Homey is in this repository.
- **Fixed outbound hosts.** Apps and widgets only talk to the hosts listed in
  `tests/repo/security.test.js`; adding one needs a deliberate test change.
- **No HTML from data.** Widget scripts don't put settings or remote data into `innerHTML`; the
  security test keeps a short allow-list of files that build markup from trusted constants.
- **Supply chain.** Frozen lockfile, pnpm's minimum release age and build-script allow-list,
  SHA-pinned Actions, least-privilege workflow tokens, Dependabot with a cooldown, and the Homey token
  only inside a protected release environment with a required reviewer (docs/releasing.md).

### Non-goals

Anyone who can add widgets to your Homey dashboard is a trusted Homey user; the widget API does not
rate-limit them. Third-party embeds (Windy, YouTube) are subject to those services' own privacy terms.
