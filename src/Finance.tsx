import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,day,Fin,money,now,Slice,TxRow} from './api';
import {Pie} from './Charts';
import {useToast} from './Toast';

type Period='month'|'30'|'year';
const PERIODS:[Period,string][]=[['month','This month'],['30','Last 30 days'],['year','This year']];
const unix=(d:Date)=>Math.floor(d.getTime()/1000);
const range=(p:Period):[number,number]=>{
  const d=new Date(),end=unix(new Date(d.getFullYear(),d.getMonth(),d.getDate()+1));
  if(p==='month')return [unix(new Date(d.getFullYear(),d.getMonth(),1)),end];
  if(p==='30')return [end-30*86400,end];
  return [unix(new Date(d.getFullYear(),0,1)),end];
};
const top=(a:Slice[])=>{const s=a.filter(x=>x.value>0);return s.length>6?[...s.slice(0,5),{label:'Other',value:s.slice(5).reduce((n,x)=>n+x.value,0)}]:s};

export default function Finance(){
  const toast=useToast();
  const [p,setP]=useState<Period>('month');
  const [flt,setFlt]=useState<'all'|'in'|'out'>('all');
  const [kind,setKind]=useState<'in'|'out'>('out');
  const [accs,setAccs]=useState<Acc[]>([]);
  const [cats,setCats]=useState<string[]>([]);
  const [fin,setFin]=useState<Fin|null>(null);
  const [byCat,setByCat]=useState<Slice[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  const load=()=>{
    const [f,t]=range(p);
    Promise.all([api.accounts(),api.categories(),api.finance(f,t),api.byCategory(f,t),api.txRange(f,t)])
      .then(([a,c,s,b,x])=>{setAccs(a);setCats(c);setFin(s);setByCat(b);setTxs(x)}).catch(toast.error);
  };
  useEffect(()=>{load()},[p]);
  const add=async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();const f=ev.currentTarget;
    const v=Object.fromEntries(new FormData(f)) as Record<string,string>;
    const amt=Math.abs(cents(v.amount));
    if(!amt){toast.error('Enter an amount above zero');return}
    try{
      await api.addTx(+v.account,kind==='out'?-amt:amt,v.note,v.date?Math.floor(new Date(v.date+'T12:00:00').getTime()/1000):now(),v.category);
      f.reset();toast.ok(kind==='out'?'Outcome added':'Income added');load();
    }catch(x){toast.error(x)}
  };
  const shown=txs.filter(t=>flt==='all'||(!t.transfer&&(flt==='in'?t.amount_cents>0:t.amount_cents<0)));
  const net=fin?fin.income_cents-fin.outcome_cents:0;
  const seg=<T extends string>(val:T,set:(v:T)=>void,opts:[T,string][])=><div className="seg">{opts.map(([v,l])=><button type="button" key={v} aria-pressed={val===v} onClick={()=>set(v)}>{l}</button>)}</div>;

  return <>
    <header>
      <div><h1>Finance</h1><p className="sub">Income and outcome across all your accounts. Moves between your own accounts are not counted.</p></div>
      {seg(p,setP,PERIODS)}
    </header>
    <div className="grid">
      <section className="card"><h2>Income</h2><div className="big pos">{fin?money(fin.income_cents):'…'}</div></section>
      <section className="card"><h2>Outcome</h2><div className="big neg">{fin?money(fin.outcome_cents):'…'}</div></section>
      <section className="card"><h2>Net</h2><div className={`big ${net<0?'neg':'pos'}`}>{fin?money(net):'…'}</div></section>
    </div>
    <div className="grid" style={{marginTop:16}}>
      <form className="card stack" onSubmit={add}>
        <h2>Add to finance</h2>
        {seg(kind,setKind,[['out','Outcome'],['in','Income']])}
        <label>Account<select name="account" required>{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({a.kind})</option>)}</select></label>
        <label>Amount<input name="amount" type="number" step="0.01" min="0" required/></label>
        <label>Category (optional)<input name="category" list="cats" placeholder="Food, Salary, Bills…"/></label>
        <datalist id="cats">{cats.map(c=><option key={c} value={c}/>)}</datalist>
        <label>Note<input name="note"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <button className="btn" disabled={!accs.length}>{kind==='out'?'Add outcome':'Add income'}</button>
        {!accs.length&&<p className="note">Add an account in Bank &amp; Wallet first.</p>}
      </form>
      <section className="card">
        <h2>Outcome by category</h2>
        <div style={{height:200,display:'flex'}}><Pie data={top(byCat)} fmt={money}/></div>
      </section>
      <section className="card w">
        <div className="row"><h2>Transactions</h2>{seg(flt,setFlt,[['all','All'],['in','Income'],['out','Outcome']])}</div>
        {shown.length===0&&<p className="note">Nothing in this period yet.</p>}
        {shown.map(t=><div className="row" key={t.id}>
          <span>{t.transfer?`Move${t.note?`: ${t.note}`:''}`:t.note||'No note'}<br/><span className="note">{day(t.at)}, {t.account}{t.category?`, ${t.category}`:''}</span></span>
          <b className={t.transfer?'note':t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b></div>)}
      </section>
    </div>
  </>;
}