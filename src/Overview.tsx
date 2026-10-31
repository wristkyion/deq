import {DragEvent,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Acc,api,day,dur,Fin,kindName,money,Sess,Slice,Stats,TxRow} from './api';
import Calendar from './Calendar';
import {Line,Pie,Radar} from './Charts';
import { useToast } from './Toast';


type Kind='balance'|'today'|'week'|'pie'|'spend'|'recent'|'wallet'|'finance'|'note'|'counter'|'github'|'income'|'divider'|'heading'|'calendar'|'walletcard'|'bankcard';
type Size='s'|'w'|'b';
type W={id:string;kind:Kind;title:string;size:Size;text?:string;n?:number;wide?:boolean;style?:'pie'|'bar'|'line'|'radar';acc?:number};
const SIZES:[Size,string][]=[['s','Square 1:1'],['w','Wide 1:2'],['b','Big 2:2']];
const CAT:{kind:Kind;title:string;mod?:'github'|'commissions'}[]=[
  {kind:'balance',title:'Recorded balance'},{kind:'today',title:'Today'},{kind:'week',title:'Time this week'},
  {kind:'pie',title:'Time by project'},{kind:'spend',title:'Spending by account'},{kind:'recent',title:'Recent transactions'},
  {kind:'wallet',title:'Wallets'},{kind:'finance',title:'Finance this month'},
  {kind:'note',title:'Note'},{kind:'counter',title:'Counter'},
  {kind:'divider',title:'Line separator'},{kind:'heading',title:'Title & subtitle'},{kind:'calendar',title:'Calendar'},
  {kind:'walletcard',title:'Wallet card'},{kind:'bankcard',title:'Bank card'},
  {kind:'github',title:'GitHub commits',mod:'github'},{kind:'income',title:'Commission income',mod:'commissions'}];
const DEFSIZE:Partial<Record<Kind,Size>>={week:'w',recent:'w',wallet:'w'};
const NOGHOST=new Image();NOGHOST.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // hides the browser's drag picture
const top=(a:Slice[])=>{const s=a.filter(x=>x.value>0);return s.length>6?[...s.slice(0,5),{label:'Other',value:s.slice(5).reduce((n,x)=>n+x.value,0)}]:s};
const mk=(kind:Kind,size:Size='s'):W=>({id:Math.random().toString(36).slice(2,8),kind,size,title:CAT.find(c=>c.kind===kind)!.title,text:'',n:0});
const DEF=():W[]=>[mk('balance'),mk('today'),mk('week','w'),mk('github'),mk('income')];

export default function Overview({s}:{s:Sess}){
  const [ws,setWs]=useState<W[]|null>(null);
  const [st,setSt]=useState<Stats|null>(null);
  const [edit,setEdit]=useState(false);
  const [add,setAdd]=useState<Kind>('note');
  const [pr,setPr]=useState<Slice[]>([]);
  const [sp,setSp]=useState<Slice[]>([]);
  const [rc,setRc]=useState<TxRow[]>([]);
  const [acs,setAcs]=useState<Acc[]>([]);
  const [fn,setFn]=useState<Fin|null>(null);
  const ready=useRef(false);
  const toast=useToast();
  const [drag,setDrag]=useState<string|null>(null);
  const [gone,setGone]=useState<string|null>(null);
  const gridRef=useRef<HTMLDivElement>(null);
  const prev=useRef(new Map<string,{x:number;y:number;w:number;h:number}>());
  const last=useRef(0); // time of the last reorder, so tiles don't reorder while still sliding

  useLayoutEffect(()=>{ // animate every card from its old position and size to the new one
    const calm=document.documentElement.dataset.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches;
    gridRef.current?.querySelectorAll<HTMLElement>('[data-id]').forEach(el=>{
      const id=el.dataset.id!,n={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight},o=prev.current.get(id);
      if(o&&!calm&&(o.x!==n.x||o.y!==n.y||o.w!==n.w||o.h!==n.h))
        el.animate([{transform:`translate(${o.x-n.x}px,${o.y-n.y}px)`,width:`${o.w}px`,height:`${o.h}px`},{transform:'none',width:`${n.w}px`,height:`${n.h}px`}],{duration:140,easing:'ease-out'});
      prev.current.set(id,n);
    });
  });

  useEffect(()=>{
    api.dash().then(j=>{try{setWs((j?JSON.parse(j) as W[]:DEF()).map(w=>({...w,size:w.size??(w.wide?'w':'s')})))}catch{setWs(DEF())}}).catch(toast.error);
    const d=new Date();
    const mon=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));
    api.stats(Math.floor(mon.getTime()/1000)).then(setSt);
    api.projects().then(setPr).catch(toast.error);
    api.spendBy(Math.floor(new Date(d.getFullYear(),d.getMonth(),1).getTime()/1000)).then(setSp).catch(toast.error);
    api.txs(6).then(setRc).catch(toast.error);
    api.accounts().then(setAcs).catch(toast.error);
    api.finance(Math.floor(new Date(d.getFullYear(),d.getMonth(),1).getTime()/1000),Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime()/1000)).then(setFn).catch(toast.error);
  },[]);
  useEffect(()=>{ // save layout (encrypted by the backend) shortly after each change
    if(!ws)return;
    if(!ready.current){ready.current=true;return}
    const t=setTimeout(()=>api.saveDash(JSON.stringify(ws)),400);
    return()=>clearTimeout(t);
  },[ws]);
  if(!ws)return null;

  const set=(id:string,p:Partial<W>)=>setWs(ws.map(w=>w.id===id?{...w,...p}:w));
  const move=(i:number,d:number)=>{const a=[...ws],j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];setWs(a)};
  const vis=(w:W)=>{const m=CAT.find(c=>c.kind===w.kind)?.mod;return !m||s.modules[m]};
  const dragTo=(target:string)=>setWs(a=>{
    if(!a||!drag||drag===target)return a;
    const b=[...a],i=b.findIndex(x=>x.id===drag),j=b.findIndex(x=>x.id===target);
    b.splice(j,0,b.splice(i,1)[0]);return b;
  });
  const hover=(e:DragEvent<HTMLElement>)=>{
    if(Date.now()-last.current<200)return;
    const g=gridRef.current;if(!g)return;
    const r=g.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const hit=Array.from(g.querySelectorAll<HTMLElement>('[data-id]')).find(el=>x>=el.offsetLeft&&x<el.offsetLeft+el.offsetWidth&&y>=el.offsetTop&&y<el.offsetTop+el.offsetHeight);
    if(hit&&hit.dataset.id!==drag){last.current=Date.now();dragTo(hit.dataset.id!)}
  };
  const remove=(w:W)=>{setGone(w.id);setTimeout(()=>{setWs(a=>a&&a.filter(x=>x.id!==w.id));setGone(null);toast.info(`Removed “${w.title}”`)},180)};

  const chart=(d:Slice[],fmt:(n:number)=>string,w:W)=>w.style==='line'&&d.length>1
    ?<Line values={d.map(x=>x.value)} labels={d.map(x=>x.label.length>8?x.label.slice(0,7)+'…':x.label)} fmt={fmt}/>
    :<Pie data={d} fmt={fmt}/>;
  
  const body=(w:W)=>{switch(w.kind){
    case 'balance':return <><div className="big">{st?money(st.balance_cents):'…'}</div><p className="note">Entered by you. Not synced with any bank.</p></>;
    case 'today':return <><div className="big">{dur(st?st.week[(new Date().getDay()+6)%7]:0)}</div><p className="note">Recorded today.</p></>;
    case 'week':{const wk=st?.week??[];const mx=Math.max(...wk,3600);
      const L='MTWTFSS'.split('');
      if(w.style==='line')return <Line values={wk} labels={L}/>;
      if(w.style==='radar')return <Radar values={wk} labels={L}/>;
      return <div className="bars">{wk.map((v,i)=><div key={i}><b style={{height:`${v/mx*100}%`}}/>{L[i]}</div>)}</div>}
    case 'pie':return chart(top(pr),dur,w);
    case 'spend':return chart(top(sp),money,w);
    case 'recent':return rc.length?<div className="list">{rc.map(t=><div className="row" key={t.id}><span>{t.note||'No note'}<br/><span className="note">{day(t.at)}, {t.account}</span></span><b className={t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b></div>)}</div>:<p className="note">No transactions yet.</p>;
    case 'wallet':{const wl=acs.filter(a=>a.kind==='Wallet');return wl.length
      ?<><div className="note">Total {money(wl.reduce((n,a)=>n+a.balance_cents,0))}</div><div className="wallets">{wl.map(a=><div className="wtile" key={a.id}><span className="note">{a.name}</span><b className="big">{money(a.balance_cents)}</b></div>)}</div></>
      :<p className="note">No wallets yet. Add one in Bank &amp; Wallet.</p>}
    case 'finance':return fn
      ?<><div className="big">{money(fn.income_cents-fn.outcome_cents)}</div><p className="note">Net this month</p><div className="split"><span>In <b className="pos">{money(fn.income_cents)}</b></span><span>Out <b className="neg">{money(fn.outcome_cents)}</b></span></div></>
      :<p className="note">…</p>;
    case 'note':return <textarea aria-label="Note" placeholder="Write anything…" value={w.text} onChange={e=>set(w.id,{text:e.target.value})}/>;
    case 'counter': return <div className="ctr"><button className="btn o" aria-label="Decrease" onClick={() => set(w.id, { n: (w.n ?? 0) - 1 })}>−</button><span className="big">{w.n ?? 0}</span><button className="btn o" aria-label="Increase" onClick={() => set(w.id, { n: (w.n ?? 0) + 1 })}>+</button></div>;
    case 'divider':return <hr className="sep"/>;
    case 'heading':return edit
      ?<input aria-label="Subtitle" placeholder="Subtitle" value={w.text} onChange={e=>set(w.id,{text:e.target.value})}/>
      :<p className="note">{w.text}</p>;
    case 'calendar':return <Calendar/>;
    case 'walletcard':case 'bankcard':{
      const k=w.kind==='walletcard'?'Wallet':'Bank';
      const a=acs.find(x=>x.id===w.acc&&x.kind===k);
      if(a)return <div className={`bcard ${w.kind}`}><div className="split"><span>{kindName(a.kind)}</span><i className="chip"/></div><div><span>{a.name}</span><b className="big">{money(a.balance_cents)}</b></div></div>;
      return <p className="note">{acs.some(x=>x.kind===k)?'Choose Customize, then pick an account.':`No ${kindName(k).toLowerCase()} accounts yet. Add one in Bank & E-Wallet.`}</p>}
    case 'github':return <p className="note">No GitHub data yet. Connect your account to see commits.</p>;
    case 'income':return <p className="note">No payments recorded yet.</p>;
  }};

  return <>
    <header>
      <div><h1>Welcome back, {s.name}</h1></div>
      <div className="acts">
        {edit&&<>
          <select aria-label="Widget type" value={add} onChange={e=>setAdd(e.target.value as Kind)}>
            {CAT.filter(c=>!c.mod||s.modules[c.mod]).map(c=><option key={c.kind} value={c.kind}>{c.title}</option>)}
          </select>
          <button className="btn o" onClick={()=>{const w=mk(add,DEFSIZE[add]??'s');setWs([...ws,w]);toast.ok(`Added “${w.title}”`)}}>Add widget</button>
          <button className="btn o" onClick={()=>{if(confirm('Reset widgets to the default layout?')){setWs(DEF());toast.info('Layout reset')}}}>Reset layout</button>
        </>}
        <button className="btn" onClick={()=>setEdit(!edit)}>{edit?'Done':'Customize'}</button>
      </div>
    </header>
    {ws.filter(vis).length===0&&<div className="empty"><h2>No widgets yet</h2><p>Choose Customize to add your first one.</p></div>}
    <div ref={gridRef} className={`wgrid${edit?' edit':''}`} onDragOver={e=>{if(!drag)return;e.preventDefault();hover(e)}}>
      {ws.map((w,i)=>vis(w)&&<section key={w.id} data-id={w.id} data-title={w.title}
        className={`card sz-${w.size} k-${w.kind}${drag===w.id?' dragging':''}${gone===w.id?' leaving':''}`}
        onDrop={e=>e.preventDefault()}>
        <h2>{edit?<input aria-label="Widget title" value={w.title} onChange={e=>set(w.id,{title:e.target.value})}/>:w.title}</h2>
        {body(w)}
        {edit&&<div className="ctl">
          <span className="handle" draggable
            onDragStart={(e:DragEvent<HTMLElement>)=>{setDrag(w.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',w.id);e.dataTransfer.setDragImage(NOGHOST,0,0)}}
            onDragEnd={()=>setDrag(null)}>Drag to sort</span>
          {w.kind!=='divider'&&<select aria-label="Size" value={w.size} onChange={e=>set(w.id,{size:e.target.value as Size})}>{SIZES.map(([z,l])=><option key={z} value={z}>{l}</option>)}</select>}
          {w.kind === 'week' && <select aria-label="Style" value={w.style ?? 'bar'} onChange={e => set(w.id, { style: e.target.value as W['style'] })}><option value="bar">Bar</option><option value="line">Line</option><option value="radar">Radar</option></select>}
          {(w.kind==='pie'||w.kind==='spend')&&<select aria-label="Style" value={w.style??'pie'} onChange={e=>set(w.id,{style:e.target.value as W['style']})}><option value="pie">Pie</option><option value="line">Line</option></select>}
          {(w.kind==='walletcard'||w.kind==='bankcard')&&<select aria-label="Account" value={w.acc??''} onChange={e=>set(w.id,{acc:e.target.value?+e.target.value:undefined})}><option value="">Choose account</option>{acs.filter(a=>a.kind===(w.kind==='walletcard'?'Wallet':'Bank')).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}
          <button className="btn o" onClick={()=>move(i,-1)}>Earlier</button>
          <button className="btn o" onClick={()=>move(i,1)}>Later</button>
          <button className="btn o" onClick={()=>remove(w)}>Remove</button>
        </div>}
      </section>)}
    </div>
  </>;
}