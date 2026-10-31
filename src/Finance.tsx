import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,Fin,money,now,Slice,TxRow} from './api';
import {Pie} from './Charts';
import Dialog,{Actions} from './Dialog';
import TxRows from './TxRows';
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
  const [dlg,setDlg]=useState(false);
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
    ev.preventDefault();
    const v=Object.fromEntries(new FormData(ev.currentTarget)) as Record<string,string>;
    const amt=Math.abs(cents(v.amount));
    if(!amt){toast.error('Enter an amount above zero');return}
    try{
      await api.addTx(+v.account,kind==='out'?-amt:amt,v.note,v.date?Math.floor(new Date(v.date+'T12:00:00').getTime()/1000):now(),v.category);
      toast.ok(kind==='out'?'Outcome added':'Income added');setDlg(false);load();
    }catch(x){toast.error(x)}
  };
  const shown=txs.filter(t=>flt==='all'||(!t.transfer&&(flt==='in'?t.amount_cents>0:t.amount_cents<0)));
  const net=fin?fin.income_cents-fin.outcome_cents:0;
  const seg=<T extends string>(val:T,set:(v:T)=>void,opts:[T,string][])=><div className="seg">{opts.map(([v,l])=><button type="button" key={v} aria-pressed={val===v} onClick={()=>set(v)}>{l}</button>)}</div>;

  return <div className="fit">
    <header>
      <div><h1>Finance</h1><p className="sub">Income and outcome across all your accounts. Moves between your own accounts are not counted.</p></div>
      <div className="acts">{seg(p,setP,PERIODS)}<button className="btn" onClick={()=>setDlg(true)}>Add income or outcome</button></div>
    </header>

    <div className="stats">
      <section className="card stat"><h2>Income</h2><div className="big pos">{fin?money(fin.income_cents):'…'}</div></section>
      <section className="card stat"><h2>Outcome</h2><div className="big neg">{fin?money(fin.outcome_cents):'…'}</div></section>
      <section className="card stat"><h2>Net</h2><div className={`big ${net<0?'neg':'pos'}`}>{fin?money(net):'…'}</div></section>
    </div>

    <div className="cols">
      <section className="card">
        <div className="row"><h2>Transactions</h2>{seg(flt,setFlt,[['all','All'],['in','Income'],['out','Outcome']])}</div>
        <div className="scroll"><div className="scroll"><TxRows txs={shown} empty="Nothing in this period yet." onChange={load}/></div></div>
      </section>
      <section className="card">
        <h2>Outcome by category</h2>
        <div className="grow"><Pie data={top(byCat)} fmt={money}/></div>
      </section>
    </div>

    {dlg&&<Dialog title="Add income or outcome" onClose={()=>setDlg(false)}>
      <form className="stack" onSubmit={add}>
        {seg(kind,setKind,[['out','Outcome'],['in','Income']])}
        <label>Account<select name="account" required>{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({a.kind})</option>)}</select></label>
        <label>Amount<input name="amount" type="number" step="0.01" min="0" required/></label>
        <label>Category (optional)<input name="category" list="cats" placeholder="Food, Salary, Bills…"/></label>
        <datalist id="cats">{cats.map(c=><option key={c} value={c}/>)}</datalist>
        <label>Note<input name="note"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        {!accs.length&&<p className="note">Add an account in Bank &amp; Wallet first.</p>}
        <Actions ok={kind==='out'?'Add outcome':'Add income'} onClose={()=>setDlg(false)} off={!accs.length}/>
      </form>
    </Dialog>}
  </div>;
}
