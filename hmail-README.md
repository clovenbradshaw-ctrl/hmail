# hmail

An email-shaped Matrix client. Conversations are rooms, replies are threads, and the things email decided not to do thirty years ago — editing, retraction, reactions, structured events, end-to-end encryption, federated identity, programmable everything — are first-class.

This is **Phase 0**: the UI scaffold with mock data. Nothing is wired to a homeserver yet. The data shown is shaped exactly like real Matrix data so the swap to live `matrix-js-sdk` calls in Phase 1 is mechanical.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. You should see a three-pane mail interface with mock conversations.

To verify the build:

```bash
npm run build
npm run preview
```

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui primitives
- Zustand for the small bit of UI state we need
- `react-resizable-panels` for the three-pane layout
- `lucide-react` icons
- `date-fns` for timestamps
- `@hyphae/people` (workspace package, stub for now) — shared identity + relationship layer for the hyphae app suite

## Design

hmail's aesthetic is paper and ink, not dashboard. Off-white warm-cream backgrounds, deep iron-gall text rather than pure black, a wax-seal red accent for unread / starred / important moments. Display type is Fraunces (a literary serif with optical sizing); body type is IBM Plex Sans; monospace data — MXIDs, timestamps — is IBM Plex Mono. No purple gradients, no Inter, no SaaS visual vocabulary.

The intent is for hmail to feel like a piece of considered civic infrastructure rather than a productivity app.

## Architecture sketch

| Email concept | Matrix mapping |
| --- | --- |
| Conversation | Room (`!room:server`) |
| Subject | Room name |
| Reply | `m.thread` event |
| Folder / Label | Space + `m.tag` account data |
| Starred / Archived | Account data tags |
| Read / Unread | `m.read` receipts |
| Sender identity | MXID + `social.hyphae.identity` profile event |
| Edit | `m.replace` relation |
| Retract | `m.room.redaction` (cooperative case) + destroyable AES key (adversarial case) |
| Reaction | `m.annotation` relation |
| Attachment | Media uploaded once, referenced by `mxc://` URI |
| Encryption | Megolm at the room layer, optional second-layer AES-GCM on payload blobs |
| Contacts | `social.hyphae.contacts` account data; names authored by their referent only |

## The naming rule

Every name shown anywhere in hmail (and in any future hyphae app consuming `@hyphae/people`) is authored by the person it refers to. You can prefer one of their published nicknames over another. You cannot create a private nickname for someone they didn't sanction. Notes and tags about *your relationship* with someone stay private to you; nicknames about *who they are* don't exist as private data.

## Phase plan

**Phase 0 — scaffold.** ✅ You are here. Three-pane UI, mock data, design language locked in, `@hyphae/people` types stubbed, GitHub Pages deploy workflow ready.

**Phase 1 — auth + sync.** Login screen, `matrix-js-sdk` init with `IndexedDBCryptoStore` and Rust crypto, sliding sync where supported, session persistence, `.well-known/matrix/client` autodiscovery so users can enter `@alice:matrix.org` and the homeserver resolves itself.

**Phase 2 — read path.** Replace mock rooms with real ones, render the live timeline as a threaded tree, mark-as-read on view.

**Phase 3 — write path.** Compose creates a room (subject becomes room name). Reply uses `m.thread`. Encryption-aware. Local echo.

**Phase 4 — Matrix superpowers.** Edit (`m.replace`), retract (`m.room.redaction` + cache eviction), react, star/archive via account data, attachments via media upload, "read by N" indicators, device-verification surface in the conversation header.

**Phase 4.5 — `@hyphae/people` v1.** Real implementations of identity + contacts on top of account data. Universal contact picker component. Cross-app display-name resolver.

**Phase 5 — polish.** Search, keyboard shortcuts (j/k for nav, R/A/F for reply/all/forward, c for compose, ⌘↵ to send), notifications, mobile responsive layout.

## Deployment

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.

By default the workflow assumes deployment to `https://<user>.github.io/hmail/` and sets Vite's `base` path accordingly. To deploy to a custom domain:

1. Add a `CNAME` file to `public/` containing the domain (e.g. `hmail.hyphae.intelechia.com`).
2. In the repo settings → Secrets and variables → Actions → Variables, add `VITE_BASE_PATH` with value `/`.
3. Configure DNS to point at GitHub Pages.

## CORS note

Matrix client-side apps run in the browser and hit homeservers directly. Synapse sends correct CORS headers by default; some smaller homeservers don't. If a homeserver login fails with a CORS error in the browser console, the homeserver operator needs to add the appropriate `Access-Control-Allow-Origin` headers. hmail does not proxy through a backend (intentionally — the whole app stays static and self-hostable on Pages), so there's no server-side workaround to ship.

## License

MIT. See `LICENSE`.
