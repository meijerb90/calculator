# How this project was built — and why

This is a record of the decisions and setup steps behind this calculator app,
written so you can understand (and redo) each piece yourself. It's organized
by *what happened* and *why*, not just a list of files.

## 1. The architecture

A browser can't talk to Postgres directly — there's no database driver in
JavaScript running in a browser, and even if there were, it would mean
shipping your database password to every visitor. So there are three pieces:

- **Frontend** (`public/`) — plain HTML/CSS/JS. Runs the calculator logic
  entirely in the browser; only talks to the backend when you hit **Save**.
- **Backend** (`server.js`, `db.js`) — a small Express server. It's the only
  thing that holds the database credentials and the only thing allowed to
  talk to Postgres.
- **Postgres** — one table, `calculations`, storing `id`, `calculation`,
  `answer`.

The flow: click Save → browser sends `{calculation, answer}` as JSON to
`POST /api/calculations` → Express runs an `INSERT` → Postgres stores it.

**Why this matters:** this three-tier shape (client / API / database) is the
standard pattern for basically any web app that needs persistent storage —
not just calculators. Once you've built one, the pattern repeats everywhere.

## 2. Finding and connecting to Postgres

You had Postgres installed, but `psql` didn't work out of the box. Diagnosis:
it was installed via the **EnterpriseDB (EDB) installer** at
`/Library/PostgreSQL/18`, not Homebrew — so its binaries were never added to
your shell's `PATH`. The server itself was already running on port 5432; it
just wasn't reachable by name from a terminal.

**Why this matters:** "command not found" for a tool almost always means
*not installed* or *not on PATH* — two very different problems. Checking
`find / -iname "*postgres*"` (or similar) before assuming a reinstall is
needed saves a lot of wasted effort.

Fix: added the bin directory to `~/.bash_profile`:
```bash
export PATH="/Library/PostgreSQL/18/bin:$PATH"
```

## 3. The database and table

```sql
CREATE TABLE IF NOT EXISTS calculations (
    id SERIAL PRIMARY KEY,
    calculation TEXT NOT NULL,
    answer NUMERIC NOT NULL
);
```
- `SERIAL PRIMARY KEY` auto-increments the id — you never set it yourself.
- `NUMERIC` (not `FLOAT`) for the answer, so results like `0.1 + 0.2` store
  exactly rather than picking up floating-point rounding errors.

## 4. The backend's one job: a safe INSERT

```js
pool.query('INSERT INTO calculations (calculation, answer) VALUES ($1, $2)', [calculation, answer]);
```

**Why `$1, $2` instead of building the string directly (e.g. with template
literals):** this is a *parameterized query*. The values are sent to Postgres
separately from the SQL text, so there's no way for user input to be
interpreted as SQL. Building queries by concatenating strings is how SQL
injection vulnerabilities happen — always use parameters for anything that
comes from outside your own code.

## 5. The Node version problem

Your system Node was **v10.16.0**, from 2019 — long past end of support. The
`pg` (Postgres driver) package used modern JavaScript syntax (`?.`) that
Node 10 couldn't parse, so the server crashed on startup.

Two ways to fix this: replace the system Node entirely, or install a version
manager. **We chose `nvm`** (Node Version Manager) rather than overwriting
`/usr/local/bin/node`, because:
- It doesn't touch or risk breaking anything else on your Mac that might
  depend on the old Node.
- It's trivially reversible — nothing system-level was replaced.
- It lets you switch Node versions per-project in the future, which matters
  once you have more than one JS project with different requirements.

`nvm install --lts` pulled Node v24 and set it as the default.

## 6. Querying the database directly (`psql`)

```bash
psql -U postgres -h localhost -d calculator
```
Then plain SQL, e.g. `SELECT * FROM calculations;`.

Two gotchas worth remembering:
- **Which database you're connected to matters.** `psql -U postgres` alone
  connects to the default `postgres` database, not `calculator` — the table
  won't exist there. `SELECT current_database();` tells you where you are;
  `\c calculator` switches without reconnecting.
- `SELECT current_database();` **correctly** returns exactly one row (the
  database's name) — that's not a sign of missing data, it's just what that
  particular query does.

## 7. The pgAdmin / DBeaver detour

pgAdmin (bundled with the EDB installer) failed to launch from Finder with a
cryptic macOS error. Running the actual binary directly from Terminal
(bypassing Finder) worked, which pointed at a **Gatekeeper** problem rather
than the app itself being broken: `spctl -a -vv` on the app confirmed the
code signature's integrity seal was invalid. Re-signing it locally
(`sudo codesign --force --deep --sign -`) fixed the seal, but macOS then
gave the standard "unidentified developer" rejection — the normal block for
any app that isn't signed by an Apple Developer ID.

That block requires a human, at the keyboard, explicitly overriding it
(Control-click → Open, or the "Open Anyway" button in System Settings →
Privacy & Security) — it's not something that can be scripted, by design.

Given the friction, we moved to **DBeaver** (free, open source, properly
signed) as the GUI client instead — connected with the same host/port/user/
password/database as everything else in this doc.

## 8. Quick reference: the connection details

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `postgres` |
| Database | `calculator` |
| Password | `meijer` |

Used identically whether connecting via `psql`, DBeaver, or the app's own
`.env` (`DATABASE_URL=postgresql://postgres:meijer@localhost:5432/calculator`).

## The big picture

What you now have is a small, complete example of the pattern behind most
web apps: a stateless frontend, a backend that owns the only path to your
data, and a database that backend talks to with parameterized queries over a
known host/port/credentials. The specific detours (PATH issues, an outdated
Node, a broken app signature) are exactly the kind of environment friction
you'll hit on real projects — the diagnostic approach (check what's actually
installed, read the real error instead of the surface symptom, isolate
whether it's the app or the OS blocking it) matters more than memorizing
these specific fixes.
