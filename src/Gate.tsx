import {FormEvent,useEffect,useState} from 'react';
import {api,Prof,Sess} from './api';
type Mode='list'|'unlock'|'recover'|'create'|'key';

export default function Gate({last,main,auto,onOpen}:{last?:string;main?:string;auto:boolean;onOpen:(s:Sess,id:string)=>void}){
  const [ps,setPs]=useState<Prof[]>([]);
  const [mode,setMode]=useState<Mode>('list');
  const [sel,setSel]=useState<Prof|null>(null);
  const [pw,setPw]=useState('');const [rk,setRk]=useState('');const [name,setName]=useState('');
  const [gh,setGh]=useState(false);const [cm,setCm]=useState(false);
  const [key,setKey]=useState('');const [saved,setSaved]=useState(false);const [err,setErr]=useState('');
  const fail=(x:unknown)=>setErr(String(x));
  const finish=async(id:string)=>{try{onOpen(await api.open(id,pw||undefined),id)}catch(x){fail(x)}};

  useEffect(()=>{api.profiles().then(p=>{
    setPs(p);
    if(!p.length){setMode('create');return}
    const q=p.find(z=>z.id===(main??last));
    if(auto&&q){if(!q.locked)api.open(q.id).then(s=>onOpen(s,q.id)).catch(fail);else{setSel(q);setMode('unlock')}} // open last profile when it has no password
  })},[]);

  const go=(f:()=>void)=>(ev:FormEvent)=>{ev.preventDefault();setErr('');f()};
  const back=()=>{setMode('list');setPw('');setRk('');setErr('')};
  const create=async()=>{
    try{
      const r=await api.create(name,pw,{github:gh,commissions:cm});
      setSel({id:r.id,name,locked:!!pw});
      if(r.recovery){setKey(r.recovery);setSaved(false);setMode('key')}else await finish(r.id);
    }catch(x){fail(x)}
  };
  const pick=(p:Prof)=>{setSel(p);setErr('');if(p.locked)setMode('unlock');else api.open(p.id).then(s=>onOpen(s,p.id)).catch(fail)};

  return <div className="gate"><div className="card">
    {mode==='list'&&<>
      <h1>Who’s using Deq?</h1>
      {ps.map(p=><button key={p.id} className="prof" onClick={()=>pick(p)}>
        <span className="av">{p.name[0]}</span><span>{p.name}<br/><span className="note">{p.locked?'Password protected':'Opens without a password'}</span></span>
      </button>)}
      <button className="btn o" onClick={()=>{setMode('create');setErr('')}}>New profile</button>
    </>}

    {mode==='unlock'&&sel&&<form onSubmit={go(()=>finish(sel.id))}>
      <h1>{sel.name}</h1>
      <label>Password<input type="password" autoFocus value={pw} onChange={e=>setPw(e.target.value)}/></label>
      <button className="btn">Unlock</button>
      <button type="button" className="link" onClick={()=>{setMode('recover');setPw('')}}>Forgot password? Use your recovery key</button>
      <button type="button" className="btn o" onClick={back}>Back</button>
    </form>}

    {mode==='recover'&&sel&&<form onSubmit={go(async()=>{try{setKey(await api.recover(sel.id,rk,pw));setSaved(false);setMode('key')}catch(x){fail(x)}})}>
      <h1>Reset password</h1>
      <label>Recovery key<input autoFocus value={rk} onChange={e=>setRk(e.target.value)} placeholder="XXXX-XXXX-XXXX-…"/></label>
      <label>New password<input type="password" value={pw} onChange={e=>setPw(e.target.value)}/></label>
      <button className="btn">Reset password</button>
      <button type="button" className="btn o" onClick={back}>Back</button>
    </form>}

    {mode==='create'&&<form onSubmit={go(create)}>
      <h1>{ps.length?'New profile':'Welcome to Deq'}</h1>
      <label>Profile name<input autoFocus value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Password (optional)<input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="new-password"/></label>
      <p className="note">Your data is always encrypted. A password makes Deq ask for it at startup, and gives you a recovery key.</p>
      <label className="chk"><input type="checkbox" checked={gh} onChange={e=>setGh(e.target.checked)}/>Enable GitHub</label>
      <label className="chk"><input type="checkbox" checked={cm} onChange={e=>setCm(e.target.checked)}/>Enable Commissions</label>
      <button className="btn">Create profile</button>
      {ps.length>0&&<button type="button" className="btn o" onClick={back}>Back</button>}
    </form>}

    {mode==='key'&&sel&&<div className="stack">
      <h1>Save your recovery key</h1>
      <p className="note">This is the only way back in if you forget your password. It is shown once. Store it somewhere safe, outside this computer.</p>
      <code className="rk">{key}</code>
      <button className="btn o" onClick={()=>navigator.clipboard.writeText(key)}>Copy key</button>
      <label className="chk"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>I saved my recovery key</label>
      <button className="btn" disabled={!saved} onClick={()=>finish(sel.id)}>Continue</button>
    </div>}
    {err&&<p className="err" role="alert">{err}</p>}
  </div></div>;
}
