# Rolling back

Two different things can go wrong, and they have different fixes.

- **The app itself is broken or worse than before** → roll back the *code*.
- **The lists got wiped or mangled** → roll back the *data*.

---

## Rolling back the code

Home Assistant expects add-on versions to move forward, so you do not
downgrade — you publish the old code as a new version. It takes one action
and uses the same path every other update takes.

### On GitHub

1. Open the repository's **Commits** list.
2. Find the commit that caused the trouble and open it.
3. Top right, **⋮ → Revert**.
4. Confirm. GitHub creates a commit that undoes it.

That is it. The tests run, a new version is published, and Home Assistant
picks it up within the hour. The app goes back to how it behaved before.

### If you want it back immediately

In Home Assistant, open **Settings → Apps → MyHiroList** and click
**Update** as soon as it appears, rather than waiting for the hourly check.

### Finding what to revert

Every build is tagged under **Releases** with the version number Home
Assistant shows on the add-on page. So if the add-on says `1.0.42` and
things broke at `1.0.43`, the release page for `1.0.43` tells you which
commit to revert.

---

## Rolling back the data

The add-on keeps its own restore points, separate from Home Assistant's
backups: hourly for the last two days, then daily for a fortnight.

### From the app

Open the app and use the restore option in settings. Pick a point from
before things went wrong.

Restoring does not erase anything — it writes the old contents back as a new
version, so restoring the wrong one can itself be undone.

### From Home Assistant's own backups

If it is older than a fortnight, the data is in your Home Assistant backups
along with everything else. **Settings → System → Backups**, restore the
add-on's data.

---

## If the add-on will not start at all

1. **Settings → Apps → MyHiroList → Log** — the reason is usually the
   last few lines.
2. If it started failing right after an update, revert the code as above.
3. The household data is untouched by a failed start. It lives in `/data`
   inside the add-on, which survives restarts, updates, and reinstalls.
