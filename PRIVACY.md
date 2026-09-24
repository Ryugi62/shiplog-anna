# ShipLog privacy

Last updated: 2026-09-24

**What ShipLog stores.** When you run ShipLog, it saves one entry per run to your own Anna storage (Anna Persistent Storage, scoped to your account and this app): the first 3,000 characters of the notes you pasted, the three drafts, the tone, language and project name you chose, and the date. It also saves your tone, language and project name as preferences. You can delete any entry from "Past weeks". ShipLog keeps your 20 most recent entries and removes older ones.

**Who writes the drafts.** The drafts are written by the AI model you use in Anna, through Anna's `llm.complete` host API, on your Anna credits or your own API key. ShipLog sends the model a digest of your notes (change lines with their kinds), your project name, tone and language. It never sees or stores API keys.

**GitHub import (optional).** If you use "Import from GitHub", your browser calls `api.github.com` directly to read the commits of the public repository you typed, for the last 7 days. No GitHub account or token is used.

**What ShipLog does not do.** It has no server of its own, no analytics, no tracking, no ads, and it does not post anything anywhere on your behalf. Nothing is shared with the developer.

**Contact.** Open an issue at https://github.com/Ryugi62/shiplog-anna/issues.
