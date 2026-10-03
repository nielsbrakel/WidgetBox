# Releasing

Each Homey app has its own version and is released on its own. Releases are automatic after a
one-time setup; publishing always waits for the owner's approval.

## How a change reaches the App Store

1. **A pull request adds a changeset** for each app it changes (`pnpm changeset`), with one
   `en:` and one `nl:` line. See [.changeset/README.md](../.changeset/README.md).
2. **Merging to `main`** runs [release.yml](../.github/workflows/release.yml). It opens or updates
   a pull request called **Release: version apps** that bumps each changed app's version and
   writes its store changelog into `.homeychangelog.json` (`pnpm release:version`, which runs
   `changeset version` and then `scripts/sync-homey-versions.mjs`).
3. **Merging the version pull request** tags each bumped app
   (`com.nielsvanbrakel.widgetbox-clocks@0.2.0`), creates a GitHub release, validates the app and
   then waits in the **homey-app-store** environment for your approval.
4. **After approval** the Homey CLI uploads the build (`homey app publish`, headless). The run
   summary links to the app in the Homey developer tools.
5. **You release the build** to Test or Live in the
   [Homey developer tools](https://tools.developer.homey.app). Athom reviews Live releases.

Apps listed in the repository variable `HOMEY_RELEASE_HOLD` (for example `weather,games`) are
versioned and tagged but never uploaded automatically. To upload one anyway, or to retry an
upload, run the **Release** workflow by hand: pick the app and untick **dry run**. A manual run
with **dry run** ticked only validates.

The Games app is excluded from changesets until the aquarium rebuild is ready (`ignore` in
`.changeset/config.json`).

## One-time setup (owner)

1. **Homey token.** Create a personal access token at
   <https://tools.developer.homey.app/me> (the account that owns the apps).
2. **Environment.** Settings → Environments → New environment `homey-app-store`:
   - Required reviewers: yourself.
   - Deployment branches and tags: only `main`.
   - Environment secret `HOMEY_PAT`: the token from step 1. Don't add it as a repository secret.
3. **Variable.** Settings → Secrets and variables → Actions → Variables: `HOMEY_RELEASE_HOLD` =
   `weather,games` until Buienradar and Windy have given written permission and the aquarium is
   ready. Remove an app from the list to release it automatically.
4. **Actions permissions.** Settings → Actions → General → Workflow permissions: tick **Allow
   GitHub Actions to create and approve pull requests** (for the version pull request).
5. **Dependency graph.** Settings → Security → enable **Dependency graph** (the dependency review
   job in CI needs it), and **Private vulnerability reporting** (SECURITY.md).
6. **Branch protection.** A ruleset for `main` and `dev`: require pull requests and the status
   check **ci-ok**. A tag ruleset for `com.nielsvanbrakel.widgetbox-*` that only allows
   creation by GitHub Actions.

Pull requests opened by the workflow's own token don't start CI. Close and reopen the version
pull request to run CI on it, or add a GitHub App token later if that gets annoying.

## Versioning rules

- **patch**: fixes and small polish.
- **minor**: new widgets, new settings, new options in a dropdown.
- **major**: a change that breaks widgets people already placed, such as removing or renaming a
  widget or setting id, or changing what a setting value means.

Widget ids and setting ids are frozen once an app is in the store (docs/decisions.md D-008).

## Manual fallback

```bash
cd apps/com.nielsvanbrakel.widgetbox-layout
pnpm exec homey app validate --level publish
pnpm exec homey app publish
```

Answer **No** when the CLI offers to bump the version: the version comes from changesets.
