import {FormEvent,useEffect,useState} from 'react';
import {api,applyPrefs,Bak,Cfg,CURRENCIES,Prof,Sess} from './api';
import Dialog,{Actions} from './Dialog';
import {useToast} from './Toast';

const COL=['#6d4aff','#2563eb','#0d9488','#e11d74'];
const TABS:[string,string,string][]=[
  ['general','General','Currency, week and locking'],
  ['appearance','Appearance','Theme, color and motion'],
  ['modules','Modules','GitHub and Commissions'],
  ['profiles','Profiles','Switch, rename and remove'],
  ['security','Security & Backup','Password and backups'],
  ['about','About Deq','Version and data folder']];
const LOCKS:[number,string][]=[[0,'Off'],[1,'After 1 minute'],[5,'After 5 minutes'],[15,'After 15 minutes'],[30,'After 30 minutes']];
type Vals=Record<string,string>;

export default function Settings({s,setS,cfg,upd,activeId,onGone}:{s:Sess;setS:(s:Sess)=>void;cfg:Cfg;upd:(p:Partial<Cfg>)=>void;activeId:string;onGone:()=>void}){
  const toast=useToast();
  const [tab,setTab]=useState('general');
  const [profs,setProfs]=useState<Prof[]>([]);
  const [baks,setBaks]=useState<Bak[]|null>(null);
  const [info,setInfo]=useState<{version:string;path:string}|null>(null);
  const [dlg,setDlg]=useState<''|'setpw'|'rmpw'|'export'|'import'|'key'>('');
  const [ren,setRen]=useState<Prof|null>(null);
  const [del,setDel]=useState<Prof|null>(null);
  const [key,setKey]=useState('');

  const refresh=()=>api.profiles().then(setProfs).catch(toast.error);
  const loadBaks=()=>api.backups().then(setBaks).catch(x=>{toast.error(x);setBaks([])});
  useEffect(()=>{refresh()},[tab]);
  useEffect(()=>{if(tab==='about'&&!info)api.about().then(setInfo).catch(toast.error)},[tab]);

  const close=()=>{setDlg('');setRen(null);setDel(null)};
  const run=(fn:(v:Vals)=>Promise<unknown>)=>async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();
    try{await fn(Object.fromEntries(new FormData(ev.currentTarget)) as Vals)}catch(x){toast.error(x)}
  };
  const savePrefs=(currency:string,week_start:number,msg:string)=>api.savePrefs(currency,week_start).then(()=>{applyPrefs(currency,week_start);setS({...s,currency,week_start});toast.ok(msg)}).catch(toast.error);
  const openImport=()=>{setBaks(null);setDlg('import');loadBaks()};

  const seg=<T extends string>(k:'theme'|'motion',opts:[T,string][])=><div className="seg">{opts.map(([v,l])=><button key={v} aria-pressed={cfg[k]===v} onClick={()=>upd({[k]:v} as Partial<Cfg>)}>{l}</button>)}</div>;
  const mod=(k:'github'|'commissions',t:string,d:string)=><div className="row"><div><b>{t}</b><div className="note">{d}</div></div>
    <button className="sw" role="switch" aria-checked={s.modules[k]} aria-label={t} onClick={()=>api.setMod(k,!s.modules[k]).then(()=>{setS({...s,modules:{...s.modules,[k]:!s.modules[k]}});toast.ok(`${t} ${s.modules[k]?'turned off':'turned on'}`)}).catch(toast.error)}/></div>;

  return <>
    <header><div><h1>Settings</h1></div></header>
    <div className="set">
      <nav className="snav" aria-label="Settings sections">{TABS.map(([k,l,d])=><button key={k} className="nav" aria-current={tab===k?'page':undefined} onClick={()=>setTab(k)}><b>{l}</b><span>{d}</span></button>)}</nav>
      <div className="pane">

        {tab==='general'&&<>
          <section className="card">
            <h2>Regional</h2>
            <div className="row"><div><b>Currency</b><div className="note">Saved for this profile. Changes how amounts are shown, existing amounts are not converted.</div></div>
              <div className="ctrl"><select aria-label="Currency" value={s.currency} onChange={e=>savePrefs(e.target.value,s.week_start,`Currency set to ${e.target.value}`)}>{CURRENCIES.map(([c,l])=><option key={c} value={c}>{l} ({c})</option>)}</select></div></div>
            <div className="row"><div><b>Week starts on</b><div className="note">Saved for this profile. Used by the week widget, Activity and the calendar.</div></div>
              <div className="seg">{([[1,'Monday'],[0,'Sunday']] as const).map(([v,l])=><button key={v} aria-pressed={s.week_start===v} onClick={()=>savePrefs(s.currency,v,`Week now starts on ${l}`)}>{l}</button>)}</div></div>
          </section>
          <section className="card">
            <h2>Privacy</h2>
            <div className="row"><div><b>Auto-lock</b><div className="note">Returns to the profile picker after no activity. It only protects profiles that have a password.</div></div>
              <div className="ctrl"><select aria-label="Auto-lock" value={cfg.autolock??0} onChange={e=>{const v=+e.target.value;upd({autolock:v});toast.ok(v?`Auto-lock set to ${LOCKS.find(l=>l[0]===v)![1].toLowerCase()}`:'Auto-lock turned off')}}>{LOCKS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div></div>
          </section>
        </>}

        {tab==='appearance'&&<section className="card">
          <h2>Look and feel</h2>
          <div className="row"><div><b>Theme</b><div className="note">System follows your Windows setting.</div></div>{seg('theme',[['system','System'],['light','Light'],['dark','Dark']])}</div>
          <div className="row"><div><b>Accent color</b><div className="note">Used for buttons, charts and highlights.</div></div><div className="dots">{COL.map(c=><button key={c} aria-label={`Accent ${c}`} aria-pressed={cfg.accent===c} style={{background:c}} onClick={()=>upd({accent:c})}/>)}</div></div>
          <div className="row"><div><b>Animation</b><div className="note">Reduce also follows the Windows reduced-motion setting.</div></div>{seg('motion',[['full','Full'],['reduce','Reduce']])}</div>
        </section>}

        {tab==='modules'&&<>
          <section className="card">
            <h2>Optional modules</h2>
            {mod('github','GitHub','Commits, repositories and profile.')}
            {mod('commissions','Commissions','Products, orders and finance for your shop.')}
          </section>
        </>}

        {tab==='profiles'&&<section className="card">
          <h2>Your profiles</h2>
          {profs.map(p=><div className="row" key={p.id}>
            <div className="pinfo"><span className="av">{p.name[0]}</span><div><b>{p.name}</b>
              <div className="tags">{p.id===cfg.main&&<span className="tag ac">Main</span>}{p.id===activeId&&<span className="tag">Active</span>}<span className="tag">{p.locked?'Password':'No password'}</span></div></div></div>
            <div className="ctrl">
              <button className="btn o sm" disabled={p.id===cfg.main} onClick={()=>{upd({main:p.id});toast.ok(`${p.name} is now your main profile`)}}>{p.id===cfg.main?'Main profile':'Set as main'}</button>
              <button className="btn o sm" onClick={()=>setRen(p)}>Rename</button>
              <button className="btn o sm" disabled={profs.length<2} onClick={()=>setDel(p)}>Remove</button>
            </div>
          </div>)}
          {profs.length<2&&<p className="note">Keep at least one profile.</p>}
        </section>}

        {tab==='security'&&<>
          <section className="card">
            <h2>Password for “{s.name}”</h2>
            <div className="row"><div><b>Password</b><div className="note">{s.locked?'Deq asks for it at startup.':'Not set. This profile opens automatically on this PC.'}</div></div>
              <div className="ctrl">{s.locked
                ?<button className="btn o" onClick={()=>setDlg('rmpw')}>Remove password</button>
                :<button className="btn" onClick={()=>setDlg('setpw')}>Set password</button>}</div></div>
            <div className="row"><div><b>Encryption</b><div className="note">Always on. Your data is encrypted on this computer.</div></div><span className="tag ac">On</span></div>
          </section>
          <section className="card">
            <h2>Backup</h2>
            <div className="row"><div><b>Export</b><div className="note">Save “{s.name}” to one file in the backups folder.</div></div>
              <div className="ctrl"><button className="btn" onClick={()=>setDlg('export')}>Export backup</button></div></div>
            <div className="row"><div><b>Import</b><div className="note">Restore a profile from a backup file. It is added as a new profile.</div></div>
              <div className="ctrl"><button className="btn o" onClick={openImport}>Import backup</button></div></div>
          </section>
        </>}

        {tab==='about'&&<section className="card">
          <h2>Deq</h2>
          <div className="row"><span>Version</span><b>{info?.version??'…'}</b></div>
          <div className="row"><span>License</span><span className="note">MIT</span></div>
          <div className="row"><span>Data folder</span><span className="note" style={{wordBreak:'break-all',textAlign:'right'}}>{info?.path??'…'}</span></div>
          <p className="note">Deq keeps your data on this computer.</p>
        </section>}
      </div>
    </div>

    {ren&&<Dialog title="Rename profile" onClose={close}>
      <form className="stack" onSubmit={run(async v=>{
        const n=v.name.trim();
        await api.renameProfile(ren.id,n);
        toast.ok(`Renamed to ${n}`);close();refresh();
        if(ren.id===activeId)setS({...s,name:n});
      })}>
        <label>Name<input name="name" defaultValue={ren.name} maxLength={40} required/></label>
        <Actions ok="Save name" onClose={close}/>
      </form>
    </Dialog>}

    {del&&<Dialog title={`Remove “${del.name}”?`} onClose={close}>
      <form className="stack" onSubmit={run(async v=>{
        await api.delProfile(del.id,v.password??'');
        toast.ok(`Removed ${del.name}`);close();refresh();
        if(cfg.main===del.id||cfg.last===del.id)upd({main:cfg.main===del.id?undefined:cfg.main,last:cfg.last===del.id?undefined:cfg.last});
        if(del.id===activeId)onGone();
      })}>
        <p className="note" style={{margin:0}}>This removes the profile and all of its data. This can’t be undone.</p>
        {del.locked&&<label>Password of {del.name}<input name="password" type="password" required/></label>}
        <Actions ok="Remove permanently" onClose={close}/>
      </form>
    </Dialog>}

    {dlg==='setpw'&&<Dialog title="Set a password" onClose={close}>
      <form className="stack" onSubmit={run(async v=>{
        const k=await api.setPw(v.password);
        setS({...s,locked:true});setKey(k);setDlg('key');
        toast.ok('Password set. Save your recovery key.');
      })}>
        <p className="note" style={{margin:0}}>Deq will ask for it at startup. You also get a recovery key, shown once. Use at least 6 characters.</p>
        <label>New password<input name="password" type="password" minLength={6} autoComplete="new-password" required/></label>
        <Actions ok="Set password" onClose={close}/>
      </form>
    </Dialog>}

    {dlg==='rmpw'&&<Dialog title="Remove password" onClose={close}>
      <form className="stack" onSubmit={run(async v=>{
        await api.rmPw(v.current);
        setS({...s,locked:false});close();toast.ok('Password removed');
      })}>
        <p className="note" style={{margin:0}}>This profile will open automatically on this PC without a password.</p>
        <label>Current password<input name="current" type="password" required/></label>
        <Actions ok="Remove password" onClose={close}/>
      </form>
    </Dialog>}

    {dlg==='key'&&<Dialog title="Save your recovery key" onClose={()=>{}}>
      <p className="note" style={{margin:0}}>This is the only way back in if you forget your password. It is shown once. Store it somewhere safe, outside this computer.</p>
      <code className="rk">{key}</code>
      <div className="acts">
        <button className="btn o" onClick={()=>navigator.clipboard.writeText(key).then(()=>toast.ok('Recovery key copied')).catch(toast.error)}>Copy key</button>
        <button className="btn" onClick={()=>{setKey('');setDlg('')}}>I saved it</button>
      </div>
    </Dialog>}

    {dlg==='export'&&<Dialog title="Export backup" onClose={close}>
      <form className="stack" onSubmit={run(async v=>{
        const f=await api.exportBackup(v.password);
        toast.ok(`Saved backups/${f}`);close();
      })}>
        <p className="note" style={{margin:0}}>Saves “{s.name}” as one file in the backups folder. Choose a backup password. It can’t be recovered if you lose it.</p>
        <label>Backup password<input name="password" type="password" minLength={6} autoComplete="new-password" required/></label>
        <Actions ok="Export backup" onClose={close}/>
      </form>
    </Dialog>}

    {dlg==='import'&&<Dialog title="Import backup" onClose={close}>
      {baks===null
        ?<p className="note" style={{margin:0}}>Looking for backups…</p>
        :baks.length===0
          ?<>
            <p className="note" style={{margin:0}}>No backups found. Copy a .deqbackup file into the backups folder, then check again.</p>
            <div className="acts"><button className="btn o" onClick={close}>Close</button><button className="btn" onClick={()=>{setBaks(null);loadBaks()}}>Check again</button></div>
          </>
          :<form className="stack" onSubmit={run(async v=>{
            const r=await api.importBackup(v.file,v.backup,v.password??'');
            toast.ok('Backup imported as a new profile');refresh();
            if(r.recovery){setKey(r.recovery);setDlg('key')}else close();
          })}>
            <p className="note" style={{margin:0}}>Creates a new profile. Nothing you have now is overwritten.</p>
            <label>Backup file<select name="file">{baks.map(b=><option key={b.file} value={b.file}>{b.file} ({new Date(b.at*1000).toLocaleString()}, {Math.max(1,Math.round(b.size/1024))} KB)</option>)}</select></label>
            <label>Backup password<input name="backup" type="password" autoFocus required/></label>
            <label>Password for the imported profile (optional)<input name="password" type="password" autoComplete="new-password"/></label>
            <Actions ok="Import backup" onClose={close}/>
          </form>}
    </Dialog>}
  </>;
}