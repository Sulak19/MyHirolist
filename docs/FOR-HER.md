# Changing the app

You do not need anything installed. You do not need to touch Home Assistant.
You change files in the GitHub repo, and the app at home updates itself.

## First time only: getting set up

**1. Accept the repo invitation.** You will have an email from GitHub
inviting you to `Sulak19/MyHirolist`, and a notification at
[github.com/notifications](https://github.com/notifications). Accept it.
(If you do not have a GitHub account yet, make one first at
[github.com/signup](https://github.com/signup) — it is free — and say what
your username is so the invitation can be sent to the right place.)

**2. Connect Claude to the repo.** Sign in at [claude.ai](https://claude.ai)
and open **Claude Code** at [claude.ai/code](https://claude.ai/code). It will
ask to connect to GitHub — say yes, and when it asks which repositories it
may see, grant it **MyHirolist**. You can grant only that one; it does not
need access to anything else.

**3. Start working.** Pick `Sulak19/MyHirolist` as the repository, then just
describe what you want in plain English:

> "On the shopping tab, make the checked-off items go grey instead of
> disappearing."

Claude reads the code, makes the change, and pushes it. You never see a
terminal.

That is the whole setup. Steps 2 and 3 are the only ones you repeat.

## The short version, every time after that

1. Ask Claude to make the change, connected to the `MyHirolist` repo.
2. Let it commit and push to `main`.
3. Wait a few minutes.
4. It is live at home.

That is the whole loop.

## What happens after you push

Three things run on their own:

1. **The tests run.** If something is broken, everything stops here and
   nothing reaches home. The app at home keeps working exactly as it was.
2. **A preview goes up** so you can look at your change in a browser
   straight away, without waiting for Home Assistant. The link is in the
   repo under **Settings → Pages**, and it looks like
   `https://sulak19.github.io/MyHirolist/`. It has a yellow banner across
   the top. Anything you tap there is throwaway — it does not touch the
   real household data.
3. **A new version is published**, and Home Assistant picks it up within the
   hour (usually much sooner).

## Where things are

Nearly everything you will want to change is in one file:

**`myhirolist/app/src/App.jsx`**

That is the entire interface — every tab, every button, the colours, the
default meals and cleaning tasks. It is long, but it is organised by tab:
`HomeTab`, `PlanTab`, `MealsTab`, `PrepTab`, `ShoppingTab`, `CleaningTab`,
`DogTab`, `FridgeTab`, `BatchTab`, `RecipesTab`.

The starting content — the meal list, the cleaning schedule, the pantry
staples — is in `DEFAULT_DATA` near the top.

Colours and fonts are in `styles` at the bottom.

## Things worth knowing

**You cannot break the app at home.** If a change does not build, it never
leaves GitHub. The worst case is that nothing happens and there is a red ✗
next to your commit on the repo's front page. If you see one, tell Claude
"the build failed, have a look" — it can read the failure and fix it.

**Your data is safe from your changes.** The meals, lists, and inventory
live in Home Assistant, not in the code. Editing the app does not touch
them.

**If you change how data is shaped**, say by renaming `shopping` to
`groceries`, the server also needs to know — it reads that name to publish
the Home Assistant sensors. Those live in
`myhirolist/server/summary.js`. Tell Claude to update both.

**Don't hand-edit `version:` in `myhirolist/config.yaml`.** It is set
automatically on every build; editing it by hand causes confusing version
numbers.

## If it went wrong

See [ROLLBACK.md](ROLLBACK.md). Short version: undo the commit on GitHub and
the previous version goes back out the same way this one did.
