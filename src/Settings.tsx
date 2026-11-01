import {useEffect,useState} from 'react';
import {api,applyPrefs,Bak,Cfg,CURRENCIES,Prof,Sess} from './api';
import {useToast} from './Toast';
const COL=['#6d4aff','#2563eb','#0d9488','#e11d74'];
const TABS=[['general','General'],['appearance','Appearance'],['modules','Modules'],['profile','Profiles & Data'],['about','About Deq']];
const LOCKS: [number, string][] = [[0, 'Off'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes']];


export default function Settings({s,setS,cfg,upd,activeId,onGone}:{s:Sess;setS:(s:Sess)=>void;cfg:Cfg;upd:(p:Partial<Cfg>)=>void;activeId:string;onGone:()=>void}){
  const toast=useToast();
  const [tab,setTab]=useState('general');
  const [profs,setProfs]=useState<Prof[]>([]);
  const [del,setDel]=useState<Prof|null>(null);
  const [delPw,setDelPw]=useState('');
  const [ren,setRen]=useState<Prof|null>(null);
  const [renName,setRenName]=useState('');
  const [info,setInfo]=useState<{version:string;path:string}|null>(null);
  const [baks,setBaks]=useState<Bak[]>([]);
  const [bakPw,setBakPw]=useState('');
  const [impFile,setImpFile]=useState('');
  const [impPw,setImpPw]=useState('');
  const [impNew,setImpNew]=useState('');
  const loadBaks=()=>api.backups().then(b=>{setBaks(b);setImpFile(f=>b.some(x=>x.file===f)?f:b[0]?.file??'')}).catch(toast.error);
  useEffect(()=>{if(tab==='profile')loadBaks()},[tab]);
  const refresh=()=>api.profiles().then(setProfs).catch(toast.error);
  useEffect(()=>{refresh()},[tab]);
  useEffect(()=>{if(tab==='about'&&!info)api.about().then(setInfo).catch(toast.error)},[tab]);
  const savePrefs=(currency:string,week_start:number,msg:string)=>api.savePrefs(currency,week_start).then(()=>{applyPrefs(currency,week_start);setS({...s,currency,week_start});toast.ok(msg)}).catch(toast.error);
  const [pw,setPw]=useState('');const [cur,setCur]=useState('');const [key,setKey]=useState('');const [err,setErr]=useState('');
  const seg=<T extends string>(k:'theme'|'motion',opts:[T,string][])=><div className="seg">{opts.map(([v,l])=><button key={v} aria-pressed={cfg[k]===v} onClick={()=>upd({[k]:v} as Partial<Cfg>)}>{l}</button>)}</div>;
  const mod=(k:'github'|'commissions',t:string,d:string)=><div className="row"><div><b>{t}</b><div className="note">{d}</div></div>
    <button className="sw" role="switch" aria-checked={s.modules[k]} aria-label={t} onClick={()=>api.setMod(k,!s.modules[k]).then(()=>{setS({...s,modules:{...s.modules,[k]:!s.modules[k]}});toast.ok(`${t} ${s.modules[k]?'turned off':'turned on'}`)}).catch(toast.error)}/></div>;

  return <>
    <header><div><h1>Settings</h1></div></header>
    <div className="set">
      <nav className="snav" aria-label="Settings sections">{TABS.map(([k,l])=><button key={k} className="nav" aria-current={tab===k?'page':undefined} onClick={()=>setTab(k)}>{l}</button>)}</nav>
      <div className="pane">
        {tab==='general'&&<div className="card">
          <div className="row"><div><b>Currency</b><div className="note">Saved for this profile. Changes how amounts are shown, existing amounts are not converted.</div></div>
            <select aria-label="Currency" style={{width:'auto'}} value={s.currency} onChange={e=>savePrefs(e.target.value,s.week_start,`Currency set to ${e.target.value}`)}>{CURRENCIES.map(([c,l])=><option key={c} value={c}>{l} ({c})</option>)}</select></div>
          <div className="row"><div><b>Week starts on</b><div className="note">Saved for this profile. Used by the week widget, Activity and the calendar.</div></div>
            <div className="seg">{([[1,'Monday'],[0,'Sunday']] as const).map(([v,l])=><button key={v} aria-pressed={s.week_start===v} onClick={()=>savePrefs(s.currency,v,`Week now starts on ${l}`)}>{l}</button>)}</div></div>
          <div className="row"><div><b>Auto-lock</b><div className="note">Returns to the profile picker after no activity. It only protects profiles that have a password.</div></div>
            <select aria-label="Auto-lock" style={{width:'auto'}} value={cfg.autolock??0} onChange={e=>{const v=+e.target.value;upd({autolock:v});toast.ok(v?`Auto-lock set to ${LOCKS.find(l=>l[0]===v)![1].toLowerCase()}`:'Auto-lock turned off')}}>{LOCKS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        </div>}
        {tab==='appearance'&&<div className="card">
          <div className="row"><span>Theme</span>{seg('theme',[['system','System'],['light','Light'],['dark','Dark']])}</div>
          <div className="row"><span>Accent color</span><div className="dots">{COL.map(c=><button key={c} aria-label={`Accent ${c}`} aria-pressed={cfg.accent===c} style={{background:c}} onClick={()=>upd({accent:c})}/>)}</div></div>
          <div className="row"><span>Animation</span>{seg('motion',[['full','Full'],['reduce','Reduce']])}</div>
        </div>}
        {tab==='modules'&&<><p className="note">Personal is always on. Turning a module off hides it and pauses its sync. Your data is kept.</p>
          <div className="card">{mod('github','GitHub','Commits, repositories and profile.')}{mod('commissions','Commissions','Products, orders and finance for your shop.')}</div></>}
        {tab==='about'&&<div className="card">
          <div className="row"><span>Version</span><b>{info?.version??'…'}</b></div>
          <div className="row"><span>License</span><span className="note">MIT</span></div>
          <div className="row"><span>Data folder</span><span className="note" style={{wordBreak:'break-all',textAlign:'right'}}>{info?.path??'…'}</span></div>
          <p className="note">Deq keeps your data on this computer.</p>
        </div>}
        {tab==='profile'&&<>
          <div className="card">
            <h2>Profiles</h2>
            {profs.map(p=><div className="row" key={p.id}>
              <span>{p.name}<br/><span className="note">{[p.id===cfg.main&&'Main',p.id===activeId&&'Active',p.locked&&'Password'].filter(Boolean).join(', ')||'No password'}</span></span>
              <div className="acts">
                <button className="btn o" onClick={()=>{setRen(p);setRenName(p.name);setDel(null)}}>Rename</button>
                <button className="btn o" disabled={p.id===cfg.main} onClick={()=>{upd({main:p.id});toast.ok(`${p.name} is now your main profile`)}}>{p.id===cfg.main?'Main profile':'Set as main'}</button>
                <button className="btn o" disabled={profs.length<2} onClick={()=>{setDel(p);setDelPw('');setRen(null)}}>Remove</button>
              </div>
            </div>)}
            {profs.length<2&&<p className="note">Keep at least one profile.</p>}
            {del&&<form className="stack" onSubmit={e=>{e.preventDefault();const p=del;api.delProfile(p.id,delPw).then(()=>{
              toast.ok(`Removed ${p.name}`);setDel(null);refresh();
              if(cfg.main===p.id||cfg.last===p.id)upd({main:cfg.main===p.id?undefined:cfg.main,last:cfg.last===p.id?undefined:cfg.last});
              if(p.id===activeId)onGone();
            }).catch(toast.error)}}>
              <p className="note">Remove “{del.name}” and all of its data? This can’t be undone.</p>
              {del.locked&&<label>Password of {del.name}<input type="password" value={delPw} onChange={e=>setDelPw(e.target.value)}/></label>}
              <div className="acts"><button className="btn">Remove permanently</button><button type="button" className="btn o" onClick={()=>setDel(null)}>Cancel</button></div>
            </form>}
            {ren&&<form className="stack" onSubmit={e=>{e.preventDefault();const p=ren,n=renName.trim();api.renameProfile(p.id,n).then(()=>{
              toast.ok(`Renamed to ${n}`);setRen(null);refresh();
              if(p.id===activeId)setS({...s,name:n});
            }).catch(toast.error)}}>
              <label>New name for “{ren.name}”<input autoFocus maxLength={40} value={renName} onChange={e=>setRenName(e.target.value)}/></label>
              <div className="acts"><button className="btn">Save name</button><button type="button" className="btn o" onClick={()=>setRen(null)}>Cancel</button></div>
            </form>}
          </div>
          <div className="card">
            <div className="row"><span>Active profile</span><b>{s.name}</b></div>
            <div className="row"><span>Encryption</span><span className="note">{s.locked?'Locked with your password':'On, opens automatically on this PC'}</span></div>
            <div className="row"><span>Data location</span><span className="note">user/&lt;profile-id&gt;/</span></div>
          </div>
          <div className="card stack">
            <h2>Backup</h2>
            <p className="note">Saves this profile as one file in the backups folder next to your Deq data (the path is in About Deq). You choose a backup password now, and it can’t be recovered if you lose it.</p>
            <form className="stack" onSubmit={e=>{e.preventDefault();api.exportBackup(bakPw).then(f=>{toast.ok(`Saved backups/${f}`);setBakPw('');loadBaks()}).catch(toast.error)}}>
              <label>Backup password for “{s.name}”<input type="password" value={bakPw} onChange={e=>setBakPw(e.target.value)} autoComplete="new-password"/></label>
              <div><button className="btn">Export backup</button></div>
            </form>
          </div>
          <div className="card stack">
            <h2>Import</h2>
            {baks.length===0
              ?<><p className="note">No backups found. Copy a .deqbackup file into the backups folder, then check again.</p><div><button className="btn o" onClick={()=>loadBaks()}>Check again</button></div></>
              :<form className="stack" onSubmit={e=>{e.preventDefault();api.importBackup(impFile,impPw,impNew).then(r=>{
                toast.ok('Backup imported as a new profile');setImpPw('');setImpNew('');refresh();
                if(r.recovery)setKey(r.recovery);
              }).catch(toast.error)}}>
                <p className="note">Creates a new profile. Nothing you have now is overwritten.</p>
                <label>Backup file<select value={impFile} onChange={e=>setImpFile(e.target.value)}>{baks.map(b=><option key={b.file} value={b.file}>{b.file} ({new Date(b.at*1000).toLocaleString()}, {Math.max(1,Math.round(b.size/1024))} KB)</option>)}</select></label>
                <label>Backup password<input type="password" value={impPw} onChange={e=>setImpPw(e.target.value)}/></label>
                <label>Password for the imported profile (optional)<input type="password" value={impNew} onChange={e=>setImpNew(e.target.value)} autoComplete="new-password"/></label>
                <div><button className="btn" disabled={!impFile||!impPw}>Import backup</button></div>
              </form>}
          </div>
          {!s.locked&&<form className="card stack" onSubmit={e=>{e.preventDefault();api.setPw(pw).then(k=>{setKey(k);setPw('');setS({...s,locked:true});toast.ok('Password set. Save your recovery key.')}).catch(toast.error)}}>
            <label>Add a password (optional)<input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="new-password"/></label>
            <button className="btn">Set password</button>
          </form>}
          {s.locked&&<form className="card stack" onSubmit={e=>{e.preventDefault();api.rmPw(cur).then(()=>{setCur('');setS({...s,locked:false});toast.ok('Password removed')}).catch(toast.error)}}>
            <label>Current password<input type="password" value={cur} onChange={e=>setCur(e.target.value)}/></label>
            <button className="btn o">Remove password</button>
          </form>}
          {key&&<div className="card stack"><b>Your recovery key</b><code className="rk">{key}</code>
            <p className="note">Shown once. Save it outside this computer. Without it, a forgotten password means the data cannot be recovered.</p>
            <button className="btn o" onClick={()=>setKey('')}>I saved it</button></div>}
          {err&&<p className="err" role="alert">{err}</p>}
        </>}
      </div>
    </div>
  </>;
}
