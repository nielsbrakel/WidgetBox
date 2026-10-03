# Changesets

Every pull request that changes what users of an app see adds a changeset:

```bash
pnpm changeset
```

Pick the app(s), the bump (patch for fixes, minor for new widgets or settings, major when a
setting changes in a way that breaks existing widgets), and write the summary as one English and
one Dutch line. These lines become the App Store changelog:

```md
---
"com.nielsvanbrakel.widgetbox-clocks": minor
---

en: The timer beeps when it ends.
nl: De timer piept als hij afloopt.
```

Each app is versioned on its own. See [docs/releasing.md](../docs/releasing.md) for what happens
after merge. The Games app is in `ignore` in `config.json` until the aquarium rebuild is ready.
