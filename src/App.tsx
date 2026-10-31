import {useEffect,useState} from 'react';
import {api,Cfg,Sess} from './api';
import Gate from './Gate';
import Overview from './Overview';
import Daily from './Daily';
import Activity from './Activity';
import Bank from './Bank';
import Settings from './Settings';
import Finance from './Finance';

export default function App() {
  const TITLES:Record<string,string>={
    'gh-projects':'GitHub Projects','gh-activity':'GitHub Activity','gh-profile':'GitHub Profile',
    'cm-overview':'Commissions Overview','cm-products':'Commissions Products','cm-orders':'Commissions Orders',
    finance:'Finance'};
  const [cfg,setCfg]=useState<Cfg|null>(null);
  const [sess,setSess]=useState<Sess|null>(null);
  const [aid,setAid]=useState('');
  const [page,setPage]=useState('overview');
  const [auto,setAuto]=useState(true);
  useEffect(()=>{api.cfg().then(c=>setCfg({theme:'system',accent:'#6d4aff',motion:'full',...c}))},[]);
  useEffect(()=>{
    if(!cfg)return;
    const r=document.documentElement;
    r.dataset.theme=cfg.theme;r.dataset.motion=cfg.motion;r.style.setProperty('--ac',cfg.accent);
  },[cfg]);
  if(!cfg)return null;
  const upd=(p:Partial<Cfg>)=>{const n={...cfg,...p};setCfg(n);api.setCfg(n)};
  if(!sess)return <Gate last={cfg.last} main={cfg.main} auto={auto} onOpen={(s,id)=>{setAuto(false);setAid(id);setSess(s);setPage('overview');upd({last:id})}}/>;

  const m=sess.modules;
  const cur=(page.startsWith('gh-')&&!m.github)||(page.startsWith('cm-')&&!m.commissions)?'overview':page;
  const B=(k:string,l:string,ind=false)=><button key={k} className={`nav${ind?' in':''}`} aria-current={cur===k?'page':undefined} onClick={()=>setPage(k)}>{l}</button>;

  return <div className="app">
    <aside aria-label="Sidebar">
      <div className="brand"><i/>Deq</div>
      <nav className="side-main" aria-label="Main navigation">
        {B('overview','Overview')}
        <div className="grp">Personal</div>
        {B('daily','Daily',true)}{B('activity','Activity',true)}{B('bank','Bank & Wallet',true)}{B('finance','Finance',true)}
        {m.github&&<>
          <div className="grp">GitHub</div>
          {B('gh-projects','Projects',true)}{B('gh-activity','Activity',true)}{B('gh-profile','Profile',true)}
        </>}
        {m.commissions&&<>
          <div className="grp">Commissions</div>
          {B('cm-overview','Overview',true)}{B('cm-products','Products',true)}{B('cm-orders','Orders',true)}
        </>}
      </nav>
      <div className="side-foot">
        {B('settings','Settings')}
        <button className="prof" onClick={()=>api.lock().then(()=>setSess(null))}>
          <span className="av">{sess.name[0]}</span><span>{sess.name}<br/><span className="note">Switch profile</span></span>
        </button>
      </div>
    </aside>
    <main><div className="page" key={cur}>
      {cur==='overview'&&<Overview s={sess}/>}
      {cur==='daily'&&<Daily/>}
      {cur==='activity'&&<Activity/>}
      {cur === 'bank' && <Bank />}
      {cur==='finance'&&<Finance/>}
      {(cur.startsWith('gh-')||cur.startsWith('cm-'))&&<><header><h1>{TITLES[cur]}</h1></header><div className="empty"><h2>Coming next</h2><p>This page is a placeholder. We’ll build it later.</p></div></>}
      {cur==='settings'&&<Settings s={sess} setS={setSess} cfg={cfg} upd={upd} activeId={aid} onGone={()=>setSess(null)}/>}
    </div></main>
  </div>;
}
