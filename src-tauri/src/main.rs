#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod crypto;
use base64::{engine::general_purpose::STANDARD as B, Engine};
use crypto::*;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::{Path, PathBuf}, sync::Mutex, time::{SystemTime, UNIX_EPOCH}};
use tauri::State;

type R<T> = Result<T, String>;
fn e<E: ToString>(x: E) -> String { x.to_string() }

// ---- Data model. Ownership: profile.json = name, modules, lock blob, currency, week start. Everything else is encrypted. ----
#[derive(Serialize, Deserialize, Clone)]
struct Lock { salt: String, pw: String, rsalt: String, rk: String } // pw/rk = data key wrapped by password / recovery key
#[derive(Serialize, Deserialize, Clone, Copy)]
struct Mods { github: bool, commissions: bool }
fn d_cur() -> String { "USD".into() }
fn d_week() -> u8 { 1 } // 1 = Monday, 0 = Sunday
#[derive(Serialize, Deserialize, Clone)]
struct Meta { id: String, name: String, modules: Mods, lock: Option<Lock>, #[serde(default = "d_cur")] currency: String, #[serde(default = "d_week")] week_start: u8 }
#[derive(Serialize)] struct Info { id: String, name: String, locked: bool }
#[derive(Serialize)] struct Opened { name: String, modules: Mods, locked: bool, currency: String, week_start: u8 }
#[derive(Serialize)] struct Created { id: String, recovery: Option<String> }
#[derive(Serialize)] struct Acc { id: i64, name: String, kind: String, balance_cents: i64 }
#[derive(Serialize)] struct Stats { balance_cents: i64, week: Vec<i64> }

struct Session { id: String, dek: Key, dir: PathBuf }
struct App { root: PathBuf, s: Mutex<Option<Session>> }

// ---- Helpers ----
/// Portable mode: next to deq.exe when writable (user/, config/), otherwise %LOCALAPPDATA%\Deq.
fn data_root() -> PathBuf {
    if let Some(d) = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)) {
        if fs::create_dir_all(d.join("user")).is_ok() && fs::write(d.join("user/.w"), b"").is_ok() {
            let _ = fs::remove_file(d.join("user/.w"));
            return d;
        }
    }
    PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into())).join("Deq")
}
/// Profile folders are named by UUID, never by the editable name. Rejects anything else (path traversal).
fn pdir(a: &App, id: &str) -> R<PathBuf> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') { return Err("Bad profile id".into()); }
    Ok(a.root.join("user").join(id))
}
fn read_meta(d: &Path) -> R<Meta> { serde_json::from_slice(&fs::read(d.join("profile.json")).map_err(e)?).map_err(e) }
fn write_atomic(p: &Path, b: &[u8]) -> R<()> { let t = p.with_extension("tmp"); fs::write(&t, b).map_err(e)?; fs::rename(&t, p).map_err(e) }
fn save_meta(d: &Path, m: &Meta) -> R<()> { write_atomic(&d.join("profile.json"), &serde_json::to_vec_pretty(m).map_err(e)?) }
fn b64(x: &[u8]) -> String { B.encode(x) }
fn unb(s: &str) -> R<Vec<u8>> { B.decode(s).map_err(e) }
fn entry(id: &str) -> R<keyring::Entry> { keyring::Entry::new("Deq", id).map_err(e) }

fn fmt_key(k: &str) -> String { k.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap()).collect::<Vec<_>>().join("-") }
/// Wraps the data key twice: once with the password, once with a fresh random recovery key.
fn make_lock(dek: &Key, pw: &str) -> R<(Lock, String)> {
    if pw.chars().count() < 6 { return Err("Use at least 6 characters".into()); }
    let rec = data_encoding::BASE32_NOPAD.encode(&rnd::<20>());
    let (s1, s2) = (rnd::<16>(), rnd::<16>());
    let l = Lock {
        salt: b64(&s1), pw: b64(&seal(&kdf(pw.as_bytes(), &s1)?, dek)?),
        rsalt: b64(&s2), rk: b64(&seal(&kdf(rec.as_bytes(), &s2)?, dek)?),
    };
    Ok((l, fmt_key(&rec)))
}
fn unwrap_dek(l: &Lock, secret: &str, recovery: bool) -> R<Key> {
    let (salt, blob) = if recovery { (&l.rsalt, &l.rk) } else { (&l.salt, &l.pw) };
    let secret: String = if recovery { secret.chars().filter(|ch| ch.is_ascii_alphanumeric()).collect::<String>().to_uppercase() } else { secret.to_string() };
    let v = open(&kdf(secret.as_bytes(), &unb(salt)?)?, &unb(blob)?)?;
    v.try_into().map_err(|_| "Corrupt key".to_string())
}

fn migrate(c: &Connection) -> R<()> {
    let v: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(e)?;
    if v < 1 {
        // Balance = opening_cents + SUM(tx.amount_cents). Positive = money in, negative = money out.
        c.execute_batch("BEGIN;
            CREATE TABLE accounts(id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, opening_cents INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE tx(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, amount_cents INTEGER NOT NULL, note TEXT, at INTEGER NOT NULL);
            CREATE INDEX tx_acc ON tx(account_id);
            CREATE TABLE time_entries(id INTEGER PRIMARY KEY, project TEXT NOT NULL, note TEXT, start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL CHECK(end_ts > start_ts));
            CREATE INDEX te_start ON time_entries(start_ts);
            PRAGMA user_version = 1; COMMIT;").map_err(e)?;
    }
    if v < 2 {
        c.execute_batch("BEGIN;
            ALTER TABLE tx ADD COLUMN category TEXT;
            ALTER TABLE tx ADD COLUMN is_transfer INTEGER NOT NULL DEFAULT 0;
            PRAGMA user_version = 2; COMMIT;").map_err(e)?;
    }
    Ok(())
}
/// Opens the active profile's encrypted personal.db (SQLCipher raw key).
fn db(a: &App) -> R<Connection> {
    let g = a.s.lock().map_err(e)?;
    let s = g.as_ref().ok_or("Profile is locked")?;
    let c = Connection::open(s.dir.join("personal.db")).map_err(e)?;
    c.execute_batch(&format!("PRAGMA key=\"x'{}'\"; PRAGMA foreign_keys=ON;", hex(&s.dek))).map_err(e)?;
    migrate(&c)?;
    Ok(c)
}

// ---- App config (config/app.json: theme, accent, animation, last profile, auto-lock). Not sensitive. ----
#[tauri::command]
fn cfg_get(a: State<App>) -> Value {
    fs::read(a.root.join("config/app.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or(serde_json::json!({}))
}
#[tauri::command]
fn cfg_set(a: State<App>, v: Value) -> R<()> {
    let d = a.root.join("config"); fs::create_dir_all(&d).map_err(e)?;
    write_atomic(&d.join("app.json"), &serde_json::to_vec_pretty(&v).map_err(e)?)
}

// ---- Profiles ----
#[tauri::command]
fn profiles(a: State<App>) -> Vec<Info> {
    let mut v: Vec<Info> = fs::read_dir(a.root.join("user")).into_iter().flatten().flatten()
        .filter_map(|d| read_meta(&d.path()).ok())
        .map(|m| Info { id: m.id, name: m.name, locked: m.lock.is_some() }).collect();
    v.sort_by(|x, y| x.name.to_lowercase().cmp(&y.name.to_lowercase()));
    v
}
#[tauri::command]
fn create_profile(a: State<App>, name: String, password: Option<String>, modules: Mods) -> R<Created> {
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count() > 40 { return Err("Enter a profile name (up to 40 characters)".into()); }
    let dek = rnd::<32>();
    let (lock, rec) = match password.filter(|p| !p.is_empty()) {
        Some(p) => { let (l, r) = make_lock(&dek, &p)?; (Some(l), Some(r)) }
        None => (None, None),
    };
    let id = uuid::Uuid::new_v4().to_string();
    let d = pdir(&a, &id)?;
    fs::create_dir_all(&d).map_err(e)?;
    if lock.is_none() { entry(&id)?.set_password(&hex(&dek)).map_err(e)?; } // no password: key lives in Windows Credential Manager
    save_meta(&d, &Meta { id: id.clone(), name, modules, lock, currency: d_cur(), week_start: d_week() })?;
    Ok(Created { id, recovery: rec })
}
#[tauri::command]
fn open_profile(a: State<App>, id: String, password: Option<String>) -> R<Opened> {
    let d = pdir(&a, &id)?;
    let m = read_meta(&d)?;
    let dek = match &m.lock {
        Some(l) => unwrap_dek(l, &password.unwrap_or_default(), false)?,
        None => {
            let h = entry(&id)?.get_password().map_err(|_| "This profile can’t be opened on this PC without its password. Restore it from a backup.".to_string())?;
            unhex(&h).ok_or("Corrupt key")?
        }
    };
    *a.s.lock().map_err(e)? = Some(Session { id, dek, dir: d });
    db(&a)?; // creates / migrates personal.db
    Ok(Opened { name: m.name, modules: m.modules, locked: m.lock.is_some(), currency: m.currency, week_start: m.week_start })
}
#[tauri::command]
fn lock_now(a: State<App>) { if let Ok(mut g) = a.s.lock() { *g = None; } }

#[tauri::command]
fn set_password(a: State<App>, password: String) -> R<String> {
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    let mut m = read_meta(&s.dir)?;
    if m.lock.is_some() { return Err("A password is already set".into()); }
    let (l, r) = make_lock(&s.dek, &password)?;
    m.lock = Some(l); save_meta(&s.dir, &m)?;
    let _ = entry(&s.id)?.delete_credential();
    Ok(r) // new recovery key, shown once
}
#[tauri::command]
fn remove_password(a: State<App>, current: String) -> R<()> {
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    let mut m = read_meta(&s.dir)?;
    let l = m.lock.clone().ok_or("No password is set")?;
    unwrap_dek(&l, &current, false)?; // must know the current password
    entry(&s.id)?.set_password(&hex(&s.dek)).map_err(e)?;
    m.lock = None; save_meta(&s.dir, &m)
}
/// Forgot password: unwrap the data key with the recovery key, set a new password, issue a NEW recovery key.
#[tauri::command]
fn recover(a: State<App>, id: String, recovery: String, password: String) -> R<String> {
    let d = pdir(&a, &id)?; let mut m = read_meta(&d)?;
    let l = m.lock.clone().ok_or("This profile has no password")?;
    let dek = unwrap_dek(&l, &recovery, true)?;
    let (nl, nr) = make_lock(&dek, &password)?;
    m.lock = Some(nl); save_meta(&d, &m)?;
    Ok(nr)
}
#[tauri::command]
fn set_module(a: State<App>, name: String, on: bool) -> R<()> {
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    let mut m = read_meta(&s.dir)?;
    match name.as_str() { "github" => m.modules.github = on, "commissions" => m.modules.commissions = on, _ => return Err("Unknown module".into()) }
    save_meta(&s.dir, &m)
}
/// Renames any profile (the name is only a label, the folder stays named by its UUID).
#[tauri::command]
fn rename_profile(a: State<App>, id: String, name: String) -> R<()> {
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count() > 40 { return Err("Enter a profile name (up to 40 characters)".into()); }
    let d = pdir(&a, &id)?;
    let mut m = read_meta(&d)?;
    m.name = name;
    save_meta(&d, &m)
}
const CURS: [&str; 9] = ["USD", "EUR", "GBP", "JPY", "IDR", "SGD", "MYR", "AUD", "CAD"];
/// Currency and week start of the active profile (stored in its profile.json). Amounts are not converted.
#[tauri::command]
fn set_prefs(a: State<App>, currency: String, week_start: u8) -> R<()> {
    if !CURS.contains(&currency.as_str()) { return Err("Unknown currency".into()); }
    if week_start > 1 { return Err("Unknown week start".into()); }
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    let mut m = read_meta(&s.dir)?;
    m.currency = currency; m.week_start = week_start;
    save_meta(&s.dir, &m)
}
#[tauri::command]
fn about_info(a: State<App>) -> Value {
    serde_json::json!({ "version": env!("CARGO_PKG_VERSION"), "path": a.root.to_string_lossy().to_string() })
}

// ---- Backup: one file holding the encrypted data plus the data key, sealed with a backup password ----
#[derive(Serialize, Deserialize)]
struct Bak { v: u8, name: String, modules: Mods, currency: String, week_start: u8, salt: String, blob: String }
#[derive(Serialize, Deserialize)]
struct BakData { dek: String, db: String, dash: Option<String> }
#[derive(Serialize)] struct BakInfo { file: String, name: String, at: u64, size: u64 }

/// UTC date as YYYY-MM-DD from unix seconds.
fn ymd(secs: u64) -> String {
    let z = (secs / 86400) as i64 + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    format!("{:04}-{:02}-{:02}", yoe + era * 400 + if m <= 2 { 1 } else { 0 }, m, d)
}
#[tauri::command]
fn export_backup(a: State<App>, password: String) -> R<String> {
    if password.chars().count() < 6 { return Err("Use at least 6 characters for the backup password".into()); }
    let (dir, dek) = { let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?; (s.dir.clone(), s.dek) };
    let m = read_meta(&dir)?;
    let data = BakData {
        dek: hex(&dek),
        db: b64(&fs::read(dir.join("personal.db")).map_err(e)?),
        dash: fs::read(dir.join("dashboard.json")).ok().map(|b| b64(&b)),
    };
    let salt = rnd::<16>();
    let blob = seal(&kdf(password.as_bytes(), &salt)?, &serde_json::to_vec(&data).map_err(e)?)?;
    let bak = Bak { v: 1, name: m.name.clone(), modules: m.modules, currency: m.currency.clone(), week_start: m.week_start, salt: b64(&salt), blob: b64(&blob) };
    let d = a.root.join("backups"); fs::create_dir_all(&d).map_err(e)?;
    let safe: String = m.name.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map_err(e)?.as_secs();
    let f = d.join(format!("{}-{}-{:02}{:02}.deqbackup", safe, ymd(secs), secs % 86400 / 3600, secs % 3600 / 60));
    if f.exists() { return Err("A backup was already saved this minute. Try again in a minute".into()); }
    write_atomic(&f, &serde_json::to_vec(&bak).map_err(e)?)?;
    Ok(f.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default())
}
#[tauri::command]
fn list_backups(a: State<App>) -> Vec<BakInfo> {
    let mut v: Vec<BakInfo> = fs::read_dir(a.root.join("backups")).into_iter().flatten().flatten()
        .filter(|d| d.path().extension().map_or(false, |x| x == "deqbackup"))
        .filter_map(|d| {
            let md = d.metadata().ok()?;
            let b: Bak = serde_json::from_slice(&fs::read(d.path()).ok()?).ok()?;
            Some(BakInfo { file: d.file_name().to_string_lossy().to_string(), name: b.name, at: md.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_secs(), size: md.len() })
        }).collect();
    v.sort_by(|x, y| y.at.cmp(&x.at));
    v
}
/// Restores a backup as a NEW profile (new UUID). An optional password protects it and issues a recovery key.
#[tauri::command]
fn import_backup(a: State<App>, file: String, backup_password: String, password: Option<String>) -> R<Created> {
    if file.contains('/') || file.contains('\\') || file.contains("..") || !file.ends_with(".deqbackup") { return Err("Bad backup file".into()); }
    let bak: Bak = serde_json::from_slice(&fs::read(a.root.join("backups").join(&file)).map_err(e)?).map_err(|_| "This is not a Deq backup".to_string())?;
    if bak.v != 1 { return Err("This backup was made by a newer Deq".into()); }
    let raw = open(&kdf(backup_password.as_bytes(), &unb(&bak.salt)?)?, &unb(&bak.blob)?).map_err(|_| "Wrong backup password".to_string())?;
    let data: BakData = serde_json::from_slice(&raw).map_err(|_| "Corrupt backup".to_string())?;
    let dek = unhex(&data.dek).ok_or("Corrupt backup")?;
    let (lock, rec) = match password.filter(|p| !p.is_empty()) {
        Some(p) => { let (l, r) = make_lock(&dek, &p)?; (Some(l), Some(r)) }
        None => (None, None),
    };
    let id = uuid::Uuid::new_v4().to_string();
    let d = pdir(&a, &id)?;
    fs::create_dir_all(&d).map_err(e)?;
    let put = || -> R<()> {
        fs::write(d.join("personal.db"), unb(&data.db)?).map_err(e)?;
        if let Some(x) = &data.dash { write_atomic(&d.join("dashboard.json"), &unb(x)?)?; }
        if lock.is_none() { entry(&id)?.set_password(&hex(&dek)).map_err(e)?; }
        save_meta(&d, &Meta { id: id.clone(), name: format!("{} (imported)", bak.name), modules: bak.modules, lock: lock.clone(), currency: bak.currency.clone(), week_start: bak.week_start })
    };
    if let Err(x) = put() { // leave nothing half-restored
        let _ = fs::remove_dir_all(&d);
        let _ = entry(&id).and_then(|en| en.delete_credential().map_err(e));
        return Err(x);
    }
    Ok(Created { id, recovery: rec })
}

// ---- dashboard.json (encrypted with the profile key) ----
#[tauri::command]
fn dashboard_get(a: State<App>) -> R<String> {
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    match fs::read(s.dir.join("dashboard.json")) {
        Ok(b) => String::from_utf8(open(&s.dek, &b)?).map_err(e),
        Err(_) => Ok(String::new()),
    }
}
#[tauri::command]
fn dashboard_set(a: State<App>, json: String) -> R<()> {
    let g = a.s.lock().map_err(e)?; let s = g.as_ref().ok_or("Profile is locked")?;
    write_atomic(&s.dir.join("dashboard.json"), &seal(&s.dek, json.as_bytes())?)
}

// ---- Personal ----
#[tauri::command]
fn add_time(a: State<App>, project: String, start: i64, end: i64) -> R<()> {
    db(&a)?.execute("INSERT INTO time_entries(project,start_ts,end_ts) VALUES(?1,?2,?3)", params![project, start, end]).map_err(e)?; Ok(())
}
#[tauri::command]
fn add_account(a: State<App>, name: String, kind: String, opening_cents: i64) -> R<()> {
    db(&a)?.execute("INSERT INTO accounts(name,kind,opening_cents) VALUES(?1,?2,?3)", params![name, kind, opening_cents]).map_err(e)?; Ok(())
}
#[tauri::command]
fn add_tx(a: State<App>, account_id: i64, amount_cents: i64, note: String, at: i64, category: Option<String>) -> R<()> {
    let cat = category.map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    db(&a)?.execute("INSERT INTO tx(account_id,amount_cents,note,at,category) VALUES(?1,?2,?3,?4,?5)", params![account_id, amount_cents, note, at, cat]).map_err(e)?; Ok(())
}
#[tauri::command]
fn list_accounts(a: State<App>) -> R<Vec<Acc>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT a.id,a.name,a.kind,a.opening_cents+COALESCE((SELECT SUM(amount_cents) FROM tx WHERE account_id=a.id),0) FROM accounts a ORDER BY a.name").map_err(e)?;
    let rows = st.query_map([], |r| Ok(Acc { id: r.get(0)?, name: r.get(1)?, kind: r.get(2)?, balance_cents: r.get(3)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
/// week_start = unix seconds of the local first day of the week 00:00. Returns seconds tracked per day, first day first.
#[tauri::command]
fn stats(a: State<App>, week_start: i64) -> R<Stats> {
    let c = db(&a)?;
    let balance_cents: i64 = c.query_row("SELECT COALESCE(SUM(opening_cents),0)+COALESCE((SELECT SUM(amount_cents) FROM tx),0) FROM accounts", [], |r| r.get(0)).map_err(e)?;
    let mut week = vec![];
    for i in 0..7 {
        let (f, t) = (week_start + i * 86400, week_start + (i + 1) * 86400);
        week.push(c.query_row("SELECT COALESCE(SUM(MAX(0,MIN(end_ts,?2)-MAX(start_ts,?1))),0) FROM time_entries WHERE end_ts>?1 AND start_ts<?2", params![f, t], |r| r.get::<_, i64>(0)).map_err(e)?);
    }
    Ok(Stats { balance_cents, week })
}

#[derive(Serialize)] struct TxRow { id: i64, account: String, amount_cents: i64, note: String, at: i64, category: String, transfer: bool }
#[derive(Serialize)] struct TimeRow { id: i64, project: String, start: i64, end: i64 }
#[derive(Serialize)] struct Summary { spent_cents: i64, income_cents: i64 }

#[tauri::command]
fn list_tx(a: State<App>, limit: i64) -> R<Vec<TxRow>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT t.id,a.name,t.amount_cents,COALESCE(t.note,''),t.at,COALESCE(t.category,''),t.is_transfer FROM tx t JOIN accounts a ON a.id=t.account_id ORDER BY t.at DESC,t.id DESC LIMIT ?1").map_err(e)?;
    let rows = st.query_map([limit], |r| Ok(TxRow { id: r.get(0)?, account: r.get(1)?, amount_cents: r.get(2)?, note: r.get(3)?, at: r.get(4)?, category: r.get(5)?, transfer: r.get::<_, i64>(6)? != 0 })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
#[tauri::command]
fn list_time(a: State<App>, limit: i64) -> R<Vec<TimeRow>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT id,project,start_ts,end_ts FROM time_entries ORDER BY end_ts DESC LIMIT ?1").map_err(e)?;
    let rows = st.query_map([limit], |r| Ok(TimeRow { id: r.get(0)?, project: r.get(1)?, start: r.get(2)?, end: r.get(3)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
/// Money out (negative) and money in (positive) since `from` (unix seconds).
#[tauri::command]
fn spend_summary(a: State<App>, from: i64) -> R<Summary> {
    db(&a)?.query_row("SELECT COALESCE(-SUM(CASE WHEN amount_cents<0 THEN amount_cents END),0), COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents END),0) FROM tx WHERE at>=?1", [from],
        |r| Ok(Summary { spent_cents: r.get(0)?, income_cents: r.get(1)? })).map_err(e)
}

#[derive(Serialize)] struct Slice { label: String, value: i64 }

#[tauri::command]
fn list_tx_range(a: State<App>, from: i64, to: i64) -> R<Vec<TxRow>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT t.id,a.name,t.amount_cents,COALESCE(t.note,''),t.at,COALESCE(t.category,''),t.is_transfer FROM tx t JOIN accounts a ON a.id=t.account_id WHERE t.at>=?1 AND t.at<?2 ORDER BY t.at DESC,t.id DESC").map_err(e)?;
    let rows = st.query_map(params![from, to], |r| Ok(TxRow { id: r.get(0)?, account: r.get(1)?, amount_cents: r.get(2)?, note: r.get(3)?, at: r.get(4)?, category: r.get(5)?, transfer: r.get::<_, i64>(6)? != 0 })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
#[tauri::command]
fn list_time_range(a: State<App>, from: i64, to: i64) -> R<Vec<TimeRow>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT id,project,start_ts,end_ts FROM time_entries WHERE start_ts>=?1 AND start_ts<?2 ORDER BY start_ts DESC").map_err(e)?;
    let rows = st.query_map(params![from, to], |r| Ok(TimeRow { id: r.get(0)?, project: r.get(1)?, start: r.get(2)?, end: r.get(3)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
/// Seconds tracked per project, largest first.
#[tauri::command]
fn project_totals(a: State<App>) -> R<Vec<Slice>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT project,SUM(end_ts-start_ts) AS s FROM time_entries GROUP BY project ORDER BY s DESC").map_err(e)?;
    let rows = st.query_map([], |r| Ok(Slice { label: r.get(0)?, value: r.get(1)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
/// Money out (in cents) per account since `from`.
#[tauri::command]
fn spend_by_account(a: State<App>, from: i64) -> R<Vec<Slice>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT a.name,-SUM(t.amount_cents) AS s FROM tx t JOIN accounts a ON a.id=t.account_id WHERE t.amount_cents<0 AND t.at>=?1 GROUP BY a.id ORDER BY s DESC").map_err(e)?;
    let rows = st.query_map([from], |r| Ok(Slice { label: r.get(0)?, value: r.get(1)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
/// Permanently removes a profile folder. A password-protected profile needs its password.
#[tauri::command]
fn delete_profile(a: State<App>, id: String, password: Option<String>) -> R<()> {
    let d = pdir(&a, &id)?;
    let m = read_meta(&d)?;
    if let Some(l) = &m.lock { unwrap_dek(l, &password.unwrap_or_default(), false)?; }
    {
        let mut g = a.s.lock().map_err(e)?;
        if g.as_ref().map_or(false, |s| s.id == id) { *g = None; }
    }
    let _ = entry(&id).and_then(|en| en.delete_credential().map_err(e));
    fs::remove_dir_all(&d).map_err(e)
}

#[derive(Serialize)] struct Fin { income_cents: i64, outcome_cents: i64 }

#[tauri::command]
fn add_transfer(a: State<App>, from_id: i64, to_id: i64, amount_cents: i64, note: String, at: i64) -> R<()> {
    if from_id == to_id { return Err("Pick two different accounts".into()); }
    if amount_cents <= 0 { return Err("Enter an amount above zero".into()); }
    let mut c = db(&a)?;
    let t = c.transaction().map_err(e)?;
    t.execute("INSERT INTO tx(account_id,amount_cents,note,at,is_transfer) VALUES(?1,?2,?3,?4,1)", params![from_id, -amount_cents, note, at]).map_err(e)?;
    t.execute("INSERT INTO tx(account_id,amount_cents,note,at,is_transfer) VALUES(?1,?2,?3,?4,1)", params![to_id, amount_cents, note, at]).map_err(e)?;
    t.commit().map_err(e)
}
/// Income and outcome in [from, to). Transfers between your own accounts are not counted.
#[tauri::command]
fn finance_sum(a: State<App>, from: i64, to: i64) -> R<Fin> {
    db(&a)?.query_row("SELECT COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents END),0), COALESCE(-SUM(CASE WHEN amount_cents<0 THEN amount_cents END),0) FROM tx WHERE is_transfer=0 AND at>=?1 AND at<?2", params![from, to],
        |r| Ok(Fin { income_cents: r.get(0)?, outcome_cents: r.get(1)? })).map_err(e)
}
#[tauri::command]
fn spend_by_category(a: State<App>, from: i64, to: i64) -> R<Vec<Slice>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT COALESCE(NULLIF(category,''),'Uncategorized'),-SUM(amount_cents) AS s FROM tx WHERE amount_cents<0 AND is_transfer=0 AND at>=?1 AND at<?2 GROUP BY 1 ORDER BY s DESC").map_err(e)?;
    let rows = st.query_map(params![from, to], |r| Ok(Slice { label: r.get(0)?, value: r.get(1)? })).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}
#[tauri::command]
fn list_categories(a: State<App>) -> R<Vec<String>> {
    let c = db(&a)?;
    let mut st = c.prepare("SELECT DISTINCT category FROM tx WHERE category IS NOT NULL AND category<>'' ORDER BY category").map_err(e)?;
    let rows = st.query_map([], |r| r.get::<_, String>(0)).map_err(e)?;
    let v = rows.collect::<Result<Vec<_>, _>>().map_err(e)?;
    Ok(v)
}

#[tauri::command]
fn delete_tx(a: State<App>, id: i64) -> R<()> {
    let mut c = db(&a)?;
    let t = c.transaction().map_err(e)?;
    let (amt, at, tr): (i64, i64, i64) = t.query_row("SELECT amount_cents,at,is_transfer FROM tx WHERE id=?1", [id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).map_err(|_| "Transaction not found".to_string())?;
    t.execute("DELETE FROM tx WHERE id=?1", [id]).map_err(e)?;
    if tr == 1 { // a move is stored as two rows, so remove the other half too
        t.execute("DELETE FROM tx WHERE id=(SELECT id FROM tx WHERE is_transfer=1 AND at=?1 AND amount_cents=?2 LIMIT 1)", params![at, -amt]).map_err(e)?;
    }
    t.commit().map_err(e)
}
#[tauri::command]
fn delete_time(a: State<App>, id: i64) -> R<()> {
    db(&a)?.execute("DELETE FROM time_entries WHERE id=?1", [id]).map_err(e)?; Ok(())
}

#[tauri::command]
fn delete_account(a: State<App>, id: i64) -> R<()> {
    let mut c = db(&a)?;
    let t = c.transaction().map_err(e)?;
    // the other half of a move stays in its account, as a normal transaction
    t.execute("UPDATE tx SET is_transfer=0 WHERE is_transfer=1 AND account_id<>?1 AND EXISTS (SELECT 1 FROM tx o WHERE o.account_id=?1 AND o.is_transfer=1 AND o.at=tx.at AND o.amount_cents=-tx.amount_cents)", [id]).map_err(e)?;
    let n = t.execute("DELETE FROM accounts WHERE id=?1", [id]).map_err(e)?; // its transactions go with it (ON DELETE CASCADE)
    if n == 0 { return Err("Account not found".into()); }
    t.commit().map_err(e)
}
fn main() {
    let root = data_root();
    let _ = fs::create_dir_all(root.join("user"));
    tauri::Builder::default()
        .manage(App { root, s: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![cfg_get, cfg_set, profiles, create_profile, open_profile, lock_now, set_password, remove_password, recover, set_module, dashboard_get, dashboard_set, add_time, add_account, add_tx, list_accounts, stats, list_tx, list_time, spend_summary, list_tx_range, list_time_range, project_totals, spend_by_account, delete_profile, spend_by_category, finance_sum, list_categories, add_transfer, delete_tx, delete_time, delete_account, rename_profile, set_prefs, about_info, export_backup, list_backups, import_backup])
        .run(tauri::generate_context!())
        .expect("failed to start Deq");
}
