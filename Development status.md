# Deq: Development Status

Last updated: 2026-10-31 · Version: 0.1.0 (pre-release) · License: MIT

> Basis: compiled from the source as built and tested during development (frontend in `src/`, backend in `src-tauri/`). Items marked **(unconfirmed)** were delivered but not yet confirmed in the running app. The original scope lives in the specification file `prompt.md`. Anything not listed under "Completed" must be treated as not implemented.

---

## 1. Project Overview

**Purpose.** Deq is a minimalist, local-first personal dashboard for Windows. It tracks personal money (manually recorded banks and e-wallets), time, and daily history. It is designed to later add a GitHub activity module and a Commissions module (VGen shop management). Data is stored locally and encrypted. No online service is required for anything built so far.

**Stack.**

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (own window frame, `decorations: false`) |
| Backend | Rust (edition 2021) |
| Database | SQLite via `rusqlite`, encrypted with SQLCipher |
| Frontend | React 18 + TypeScript 5 (strict) + Vite 5 |
| Styling | One plain CSS file, CSS variables for theme and accent |
| Target | Windows (NSIS installer configured, not yet built) |

---

## 2. Current Development Phase

**Stage:** Initial development phase complete. The Personal core and the profile/security system are working. The two optional modules (GitHub, Commissions) exist only as toggles and placeholder pages.

| Area | State |
|---|---|
| Shell: window, sidebar, theming, notifications, dialogs | Done |
| Profiles, encryption, optional password, recovery key | Done |
| Personal: Daily, Activity, Bank & E-Wallet, Finance | Done (add/remove only, no editing) |
| Overview: customizable widgets | Done |
| Settings | Partial (3 of 7 sections) |
| GitHub module | Not started (toggle and placeholder pages only) |
| Commissions module | Not started (toggle and placeholder pages only) |
| Backup / export / import | Not started |

---

## 3. Completed Features

### Profiles and security
- **Local profiles.** Each profile is a folder named by a UUID under `user/`. Names are never used as paths, and ids are validated against path traversal.
- **Optional password.** Data is always encrypted. Without a password the data key sits in the Windows Credential Manager and the profile opens automatically on that PC. With a password, the key is wrapped with an Argon2id-derived key.
- **Recovery key.** Generated whenever a password is set or reset. It wraps the same data key and is shown once. "Forgot password" resets the password with the key and issues a new one.
- **Startup flow.** Profile picker, unlock screen, and first-run "create profile" form (name, optional password, module choices). The main profile, or the last used one, opens automatically at startup, but not when switching profiles later.
- **Profile management** (Settings): switch, set as main, remove (a locked profile needs its password; at least one profile must remain), set or remove password.

### Shell and UI
- **Custom title bar:** minimize, maximize/restore, close, and drag. It shows on every screen, including the picker.
- **Sidebar:** Overview and a Personal group (Daily, Activity, Bank & E-Wallet, Finance) at the top. GitHub and Commissions groups appear only when their module is enabled. Settings and the profile switcher sit at the bottom.
- **Theming:** System/Light/Dark, four accent colors, Full/Reduce animation. Reduce also follows the OS reduced-motion setting. Saved in `config/app.json`.
- **Notifications:** top-right toasts for successes, info and errors, with auto-dismiss.
- **Dialogs:** modal dialogs drawn through a React portal. They close on Esc or an outside click.
- **Animations:** page transitions, hover and press states, chart entrances, widget move/resize animation.

### Overview (customizable widgets)
- Customize mode: add, remove, rename, resize, reorder.
- Three sizes: Square 1:1, Wide 1:2, Big 2:2.
- Drag-to-sort in Sway style (outlined slot, snappy shuffle), plus Earlier/Later buttons.
- Widget types: Recorded balance, Today, Time this week (Bar/Line/Radar), Time by project (pie), Spending by account (pie), Recent transactions, Wallets **(unconfirmed)**, Finance this month **(unconfirmed)**, Note, Counter. GitHub commits and Commission income are placeholders that appear only if the module is enabled.
- The layout is saved per profile as encrypted `dashboard.json`.

### Personal pages
- **Daily:** date navigation. Shows time entries, transactions, and totals for the chosen date. Read-only.
- **Activity:** log time (project plus minutes just spent), totals for today, this week, and all time, per-project bars, recent entries, remove an entry.
- **Bank & E-Wallet:** Bank/E-wallet switch, add account (opening balance), add transaction (category and date optional), move money between accounts, remove transaction, remove account, balance total, this month's spent/received, recent transactions.
- **Finance:** period filter (This month, Last 30 days, This year), Income/Outcome/Net, add income or outcome with category, outcome-by-category pie, filtered transaction list, remove transaction.

### Modules
- GitHub and Commissions can be turned on or off per profile in Settings → Modules. The setting is stored in `profile.json`. Turning a module off hides it and keeps its data.

---

## 4. In Progress

No feature is actively being developed. Partially implemented items:

- **Settings:** only Appearance, Modules, and Profiles & Data exist.
- **Setup wizard:** a single create-profile form, not the multi-step wizard from the spec.
- **GitHub and Commissions:** toggles and placeholder pages only. The two Overview placeholder widgets show static text.
- **Time entries:** only "minutes just spent" (start = now − minutes). There is no manual start and end entry.

---

## 5. Pending Features

- **GitHub module:** secure account connection (token in the OS credential store), `github/cache.db`, Projects/Activity/Profile pages, sync with rate-limit/offline/error states, GitHub settings page.
- **Commissions module:** Overview, Products (with images and `detail.json`), Orders (customers, deadlines, status history, payments), `commissions.db`, `product/` folders, statistics cache, Commissions settings page.
- **Settings pages:** General, GitHub, Commissions, About Deq.
- **Editing:** edit transactions, time entries, and accounts; rename a profile.
- **Daily notes/logs** (the spec lists them; only time and transactions are shown).
- **Backup, export, import** of profiles, and the `backups/` and `cache/` folders.
- **`profiles.json` registry** (profiles are currently found by scanning `user/`).
- **Month picker** on Finance, a currency setting, deadline reminders, localization.
- **Automated tests, installer verification, and a real README.**

---

## 6. Architecture

### Structure
```
index.html, vite.config.ts, tsconfig.json, package.json
src/                      React frontend
  main.tsx                mounts ToastProvider, TitleBar and App
  App.tsx                 shell: sidebar, page switching (state-based, no router), config
  Gate.tsx                profile picker, unlock, recovery, create profile
  Overview.tsx            customizable widget grid
  Daily.tsx  Activity.tsx  Bank.tsx  Finance.tsx     Personal pages
  Settings.tsx            Appearance, Modules, Profiles & Data
  Charts.tsx              Pie, Line, Radar (hand-written SVG, no chart library)
  Dialog.tsx  RemoveBtn.tsx  TxRows.tsx  Toast.tsx  TitleBar.tsx   shared components
  api.ts                  typed wrappers around Tauri `invoke` and shared helpers
  styles.css              all styling
src-tauri/
  src/main.rs             commands, profile logic, SQLite access
  src/crypto.rs           Argon2id, XChaCha20-Poly1305, key helpers
  tauri.conf.json  capabilities/default.json  Cargo.toml  build.rs
```

### Data storage (what actually exists on disk)
```
<root>/            exe folder if writable, otherwise %LOCALAPPDATA%\Deq
  config/app.json  theme, accent, motion, last, main (not sensitive)
  user/<uuid>/
    profile.json   id, name, enabled modules, wrapped keys (the only unencrypted file)
    personal.db    SQLCipher database
    dashboard.json widget layout, encrypted with the profile key
```
The spec's `github/`, `product/`, `commissions.db`, `cache/`, `backups/` and `profiles.json` do **not** exist yet.

**`personal.db` schema** (migrations tracked with `PRAGMA user_version`, currently 2):
- `accounts(id, name, kind, opening_cents)`. `kind` is stored as `Bank` or `Wallet`; the UI shows "E-wallet".
- `tx(id, account_id → accounts ON DELETE CASCADE, amount_cents, note, at, category, is_transfer)`
- `time_entries(id, project, note, start_ts, end_ts CHECK end_ts > start_ts)`

**Rules.** Money is stored as integer cents. A balance is `opening_cents + SUM(tx.amount_cents)`, always calculated and never stored. Positive means money in, negative means out. A move between accounts is two `tx` rows with `is_transfer=1`, and these are excluded from spent, received, and Finance totals.

### Application flow
UI component → `api.ts` (`invoke`) → Rust command → session lookup (`Mutex<Option<Session>>` holding the data key) → open `personal.db` with the key (a connection per command, migrations run on open) → serialized result. Locking clears the session.

### Backend commands (32)
Config: `cfg_get`, `cfg_set` · Profiles: `profiles`, `create_profile`, `open_profile`, `lock_now`, `set_password`, `remove_password`, `recover`, `set_module`, `delete_profile` · Layout: `dashboard_get`, `dashboard_set` · Personal data: `add_time`, `add_account`, `add_tx`, `add_transfer`, `list_accounts`, `list_tx`, `list_tx_range`, `list_time`, `list_time_range`, `delete_tx`, `delete_time`, `delete_account` · Statistics: `stats`, `spend_summary`, `spend_by_account`, `spend_by_category`, `finance_sum`, `project_totals`, `list_categories`

---

## 7. Dependencies

| Package | Purpose |
|---|---|
| `tauri` 2, `@tauri-apps/api` 2, `@tauri-apps/cli` 2 | Desktop shell, window control, IPC |
| `rusqlite` 0.32 (`bundled-sqlcipher-vendored-openssl`) | Encrypted SQLite. Building it needs Perl (Strawberry Perl on Windows) |
| `argon2` 0.5 | Password and recovery-key key derivation |
| `chacha20poly1305` 0.10 | Encryption of `dashboard.json` and key wrapping |
| `keyring` 3 (`windows-native`) | Data key for profiles without a password (Windows Credential Manager) |
| `rand`, `base64`, `data-encoding`, `uuid` | Randomness, encoding, recovery-key format, profile ids |
| `serde`, `serde_json` | Serialization |
| `react` / `react-dom` 18.3 | UI |
| `vite` 5, `@vitejs/plugin-react`, `typescript` 5 | Build tooling |

No UI component, chart, or state-management library is used.

---

## 8. Recent Implementation

**Created:** `Toast.tsx`, `TitleBar.tsx`, `Charts.tsx`, `Daily.tsx`, `Activity.tsx`, `Bank.tsx`, `Finance.tsx`, `Dialog.tsx`, `TxRows.tsx`, `RemoveBtn.tsx`.

**Removed:** `Personal.tsx`, which was split into Daily, Activity, and Bank. A leftover `src/Personal.tsx.backup` may still be in the repository.

**Modified:**
- `App.tsx`: the sidebar was redesigned and gained groups, and the page transition was added.
- `Gate.tsx`: main-profile startup and no auto-open when switching profiles.
- `Settings.tsx`: profile list with set main and remove, toast feedback.
- `Overview.tsx`: sizes, drag sorting with animation, chart styles, new widgets.
- `api.ts`: new calls and the `kindName` helper.
- `styles.css`: animation, sidebar, widget grid, page layout, and dialog styles.
- `main.rs`: migration v2 (`category`, `is_transfer`) and the commands added since the first version.
- `tauri.conf.json`: `decorations:false` and `dragDropEnabled:false`.
- `capabilities/default.json`: window permissions for the custom title bar.

**Important changes:**
- Transfers are stored as paired rows and kept out of income and outcome totals.
- Pages use a fit-to-screen layout (`.fit`) where lists scroll inside their cards.
- Add and remove confirmations are dialogs.
- Profile switching no longer auto-reopens the last profile.
- The widget drag handler was fixed so that tiles don't reorder repeatedly during a drag.

---

## 9. Known Issues

**Missing functionality**
- Records can be added and removed but not edited.
- GitHub and Commissions pages are placeholders.
- Settings is missing General, GitHub, Commissions, and About.
- No backup, export, or import.
- The currency is fixed to USD.
- Finance has no custom month or range picker.

**Technical limitations**
- **Moves:** deleting a move or an account finds the other half of a transfer by matching timestamp and amount. Two identical moves recorded in the same second could be paired wrongly.
- **Days:** day boundaries assume 24 hours (no DST handling). A time entry that crosses midnight counts on its start day.
- **Lists:** Overview "Recent" shows 6, Bank and Activity show the latest 100. Older records still count toward all totals.
- **Passwords:** a profile without a password has no recovery path. If its Credential Manager entry is lost, its data cannot be opened. A forgotten password without the recovery key is unrecoverable by design.
- **Unencrypted data:** `profile.json` (name, modules, wrapped keys) and `config/app.json` are plain text.
- **Platform:** Windows only (`keyring` uses `windows-native`, with the `LOCALAPPDATA` fallback).
- **Drag-drop:** `dragDropEnabled:false` is required for widget drag sorting, so OS file drops onto the window are disabled.
- **Build:** the first Rust build compiles OpenSSL and is slow, and it needs Perl on PATH.
- **Quality:** there are no automated tests. TypeScript needs `"DOM.Iterable"` in `tsconfig.json` `lib` for `FormData`.
- **Unconfirmed:** the Wallets and Finance Overview widgets and the NSIS installer build have not been confirmed running.

---

## 10. Development Notes

**Technical decisions**
- **Data is local-first and always encrypted.** One random data key per profile. The password only changes how it is unlocked.
- **Derived values are calculated, never stored.** Balances and totals come from records, so removing a record always corrects every total.
- **State-based navigation instead of a router.** Pages are components switched in `App.tsx`. Pages that belong to a disabled module redirect to Overview.
- **Charts are hand-written SVG.** This keeps the app small and fully offline.
- **Stored value `Wallet`, displayed as "E-wallet".** This keeps existing data valid. Use `kindName()` for display.
- **Finance belongs to the Personal group**, not Commissions.
- **Pop-ups use a React portal.** A card hover transform otherwise breaks fixed positioning.

**Design direction (do not change without approval)**
- Minimalist, compact sidebar, rounded cards, one accent color through the `--ac` CSS variable.
- Clear text labels. Tooltips on icon-only controls such as the window buttons.
- Forms open in dialogs. Lists scroll inside cards. Pages fit the window.
- Every user action reports through a toast.
- Respect Reduce Animation everywhere, including script-driven animation.

**Constraints for future work**
- Follow the specification and the project's consistency rules: do not add unrequested features, replace libraries, or redesign existing screens without approval, and inspect existing code before creating new code.
- Build functionality and data flow first and polish visuals separately.
- Keep each setting stored in exactly one place: theme, accent and motion in `config/app.json`, enabled modules in `profile.json`, widget layout in `dashboard.json`.
- Never place tokens or financial data in plain-text files. Use the OS credential store for tokens.
- Use migrations (`PRAGMA user_version`) for every schema change, never edit existing ones.
- Profile folders are always named by UUID, never by a user-editable name.
- Disabled modules must not run background work, and disabling must never delete their data.
