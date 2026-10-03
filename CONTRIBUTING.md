# Contributing to WidgetBox

Thanks for helping! WidgetBox is a small family of Homey dashboard widgets. Bugs, ideas and pull
requests are all welcome.

## Before you start

- **Bugs:** open an issue with the [bug form](https://github.com/nielsbrakel/WidgetBox/issues/new?template=bug_report.yml).
  Security problems go through [SECURITY.md](SECURITY.md), never a public issue.
- **Features:** open a [feature request](https://github.com/nielsbrakel/WidgetBox/issues/new?template=feature_request.yml) first.

Read [AGENTS.md](AGENTS.md) (ground rules), [docs/CONTEXT.md](docs/CONTEXT.md) (the words we use) and
[docs/decisions.md](docs/decisions.md) (why things are the way they are) before changing code.

## Setup

You need Node 26 (see `.nvmrc`) and pnpm via Corepack.

```bash
corepack enable && pnpm install   # also installs the git hooks
pnpm sandbox                      # every widget in the browser with a fake Homey
pnpm exec playwright install chromium   # once, for e2e tests (or set PW_CHROMIUM_PATH)
```

To try an app on a real Homey: `cd apps/com.nielsvanbrakel.widgetbox-clocks && pnpm exec homey app run`.

## Workflow

1. Branch from `dev`.
2. Work test-first: write a failing unit test, make it pass, then clean up. Logic goes into small
   modules (`lib/` on the Homey side, `public/*.js` next to a widget) so it can be tested without a browser.
3. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with an app
   scope where it fits: `fix(clocks): …`, `feat(weather): …`, `ci: …`. The commit-msg hook checks them.
4. Add a **changeset** for every app with a user-facing change: `pnpm changeset` (see
   [docs/releasing.md](docs/releasing.md)). Its text becomes the App Store changelog.
5. Run `pnpm check`, and `pnpm test:e2e` if a widget or the sandbox changed.
6. Open a pull request into `dev` and fill in the template.

## Hard rules

- Each app stays self-contained: no runtime `dependencies`, no imports from outside the app folder.
  Shared widget helpers are copied in by `pnpm kit:sync` (see [docs/architecture.md](docs/architecture.md)).
- Every user-visible text exists in English and Dutch.
- Widgets use Homey's CSS variables and follow light and dark mode.
- Settings and remote data never go into `innerHTML`.
- No third-party brand names (YouTube, Buienradar, Windy) in app or widget names.
