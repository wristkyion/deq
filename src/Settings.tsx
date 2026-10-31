import {useEffect,useState} from 'react';
import {api,Cfg,Prof,Sess} from './api';
import {useToast} from './Toast';
const COL=['#6d4aff','#2563eb','#0d9488','#e11d74'];
const TABS=[['appearance','Appearance'],['modules','Modules'],['profile','Profiles & Data']];

export default function Settings({s,setS,cfg,upd,activeId,onGone}:{s:Sess;setS:(s:Sess)=>void;cfg:Cfg;upd:(p:Partial<Cfg>)=>void;activeId:string;onGone:()=>void}){
  const toast=useToast();
  const [tab,setTab]=useState('appearance');
  const [profs,setProfs]=useState<Prof[]>([]);
  const [del,setDel]=useState<Prof|null>(null);
  const [delPw,setDelPw]=useState('');
  const refresh=()=>api.profiles().then(setProfs).catch(toast.error);
  useEffect(()=>{refresh()},[tab]);
  const [pw,setPw]=useState('');const [cur,setCur]=useState('');const [key,setKey]=useState('');const [err,setErr]=useState('');
  const seg=<T extends string>(k:'theme'|'motion',opts:[T,string][])=><div className="seg">{opts.map(([v,l])=><button key={v} aria-pressed={cfg[k]===v} onClick={()=>upd({[k]:v} as Partial<Cfg>)}>{l}</button>)}</div>;
  const mod=(k:'github'|'commissions',t:string,d:string)=><div className="row"><div><b>{t}</b><div className="note">{d}</div></div>
    <button className="sw" role="switch" aria-checked={s.modules[k]} aria-label={t} onClick={()=>api.setMod(k,!s.modules[k]).then(()=>{setS({...s,modules:{...s.modules,[k]:!s.modules[k]}});toast.ok(`${t} ${s.modules[k]?'turned off':'turned on'}`)}).catch(toast.error)}/></div>;

  return <>
    <header><div><h1>Settings</h1></div></header>
    <div className="set">
      <nav className="snav" aria-label="Settings sections">{TABS.map(([k,l])=><button key={k} className="nav" aria-current={tab===k?'page':undefined} onClick={()=>setTab(k)}>{l}</button>)}</nav>
      <div className="pane">
        {tab==='appearance'&&<div className="card">
          <div className="row"><span>Theme</span>{seg('theme',[['system','System'],['light','Light'],['dark','Dark']])}</div>
          <div className="row"><span>Accent color</span><div className="dots">{COL.map(c=><button key={c} aria-label={`Accent ${c}`} aria-pressed={cfg.accent===c} style={{background:c}} onClick={()=>upd({accent:c})}/>)}</div></div>
          <div className="row"><span>Animation</span>{seg('motion',[['full','Full'],['reduce','Reduce']])}</div>
        </div>}
        {tab==='modules'&&<><p className="note">Personal is always on. Turning a module off hides it and pauses its sync. Your data is kept.</p>
          <div className="card">{mod('github','GitHub','Commits, repositories and profile.')}{mod('commissions','Commissions','Products, orders and finance for your shop.')}</div></>}
        {tab==='profile'&&<>
          <div className="card">
            <h2>Profiles</h2>
            {profs.map(p=><div className="row" key={p.id}>
              <span>{p.name}<br/><span className="note">{[p.id===cfg.main&&'Main',p.id===activeId&&'Active',p.locked&&'Password'].filter(Boolean).join(', ')||'No password'}</span></span>
              <div className="acts">
                <button className="btn o" disabled={p.id===cfg.main} onClick={()=>{upd({main:p.id});toast.ok(`${p.name} is now your main profile`)}}>{p.id===cfg.main?'Main profile':'Set as main'}</button>
                <button className="btn o" disabled={profs.length<2} onClick={()=>{setDel(p);setDelPw('')}}>Remove</button>
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
          </div>
          <div className="card">
            <div className="row"><span>Active profile</span><b>{s.name}</b></div>
            <div className="row"><span>Encryption</span><span className="note">{s.locked?'Locked with your password':'On, opens automatically on this PC'}</span></div>
            <div className="row"><span>Data location</span><span className="note">user/&lt;profile-id&gt;/</span></div>
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
