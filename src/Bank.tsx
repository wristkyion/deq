import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,day,money,now,Summary,TxRow} from './api';
import {useToast} from './Toast';

export default function Bank(){
  const toast=useToast();
  const [accs,setAccs]=useState<Acc[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
    const [view,setView]=useState<'Bank'|'Wallet'>('Bank');
  const load=(say=false)=>{
    const d=new Date();
    const from=Math.floor(new Date(d.getFullYear(),d.getMonth(),1).getTime()/1000);
    Promise.all([api.accounts(),api.txs(50),api.summary(from)]).then(([a,t,s])=>{
      setAccs(a);setTxs(t);setSum(s);
      if(say)toast.info(`Loaded ${a.length} accounts and ${t.length} transactions`);
    }).catch(toast.error);
  };
  useEffect(()=>{load()},[]);
  const sub=(ok:string,fn:(v:Record<string,string>)=>Promise<unknown>)=>async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();const f=ev.currentTarget;
    try{await fn(Object.fromEntries(new FormData(f)) as Record<string,string>);f.reset();toast.ok(ok);load()}catch(x){toast.error(x)}
  };
  const shown=accs.filter(a=>a.kind===view);
  const kindOf:Record<string,string>=Object.fromEntries(accs.map(a=>[a.name,a.kind]));
  const vtx=txs.filter(t=>kindOf[t.account]===view);
  const total=shown.reduce((n,a)=>n+a.balance_cents,0);
  const when=(v:Record<string,string>)=>v.date?Math.floor(new Date(v.date+'T12:00:00').getTime()/1000):now();
  return <>
    <header>
      <div><h1>Bank &amp; Wallet</h1><p className="sub">Balances you record yourself. Deq never connects to a bank or wallet.</p></div>
      <div className="seg" role="group" aria-label="Account type">{(['Bank','Wallet'] as const).map(k=><button key={k} aria-pressed={view===k} onClick={()=>setView(k)}>{k}</button>)}</div>
    </header>
    <div className="grid">
      <section className="card">
        <h2>{view==='Bank'?'Bank total':'Wallet total'}</h2>
        <div className="big">{money(total)}</div>
        <p className="note">{shown.length} {shown.length===1?'account':'accounts'}, recorded by you.</p>
      </section>
      <section className="card">
        <h2>This month</h2>
        <div className="row"><span>Spent</span><b className="neg">{sum?money(sum.spent_cents):'…'}</b></div>
        <div className="row"><span>Received</span><b className="pos">{sum?money(sum.income_cents):'…'}</b></div>
        <p className="note">All accounts, since the 1st. Moves between accounts are not counted.</p>
      </section>
      <form className="card stack" onSubmit={sub(view==='Bank'?'Bank account added':'Wallet added',v=>api.addAccount(v.name,v.kind,cents(v.opening)))}>
        <h2>{view==='Bank'?'Add bank account':'Add wallet'}</h2>
        <label>Name<input name="name" required/></label>
        <label>Type<select name="kind" key={view} defaultValue={view}><option>Bank</option><option>Wallet</option></select></label>
        <label>Opening balance<input name="opening" type="number" step="0.01" defaultValue="0"/></label>
        <button className="btn">{view==='Bank'?'Add account':'Add wallet'}</button>
      </form>
      <form className="card stack" onSubmit={sub('Transaction added',v=>api.addTx(+v.account,cents(v.amount),v.note,when(v),v.category))}>
        <h2>Add transaction</h2>
        <label>Account<select name="account" required>{shown.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Amount (negative = money out)<input name="amount" type="number" step="0.01" required/></label>
        <label>Category (optional)<input name="category"/></label>
        <label>Note<input name="note"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <button className="btn" disabled={!shown.length}>Add transaction</button>
      </form>
      {accs.length>1&&<form className="card stack" onSubmit={sub('Money moved',v=>api.transfer(+v.from,+v.to,Math.abs(cents(v.amount)),v.note,when(v)))}>
        <h2>Move money</h2>
        <label>From<select name="from">{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({a.kind})</option>)}</select></label>
        <label>To<select name="to" defaultValue={accs[1]?.id}>{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({a.kind})</option>)}</select></label>
        <label>Amount<input name="amount" type="number" step="0.01" min="0" required/></label>
        <label>Note<input name="note" placeholder="Top-up"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <button className="btn">Move money</button>
      </form>}
      <section className="card w">
        <h2>{view==='Bank'?'Bank accounts':'Wallets'}</h2>
        {shown.length===0&&<p className="note">{view==='Bank'?'No bank accounts yet. Add one to start recording balances.':'No wallets yet. Add one to start recording balances.'}</p>}
        {view==='Wallet'
          ?<div className="wallets">{shown.map(a=><div className="wtile" key={a.id}><span className="note">{a.name}</span><b className="big">{money(a.balance_cents)}</b></div>)}</div>
          :shown.map(a=><div className="row" key={a.id}><span>{a.name}<br/><span className="note">Recorded balance</span></span><b>{money(a.balance_cents)}</b></div>)}
      </section>
      <section className="card w">
        <div className="row"><h2>Recent transactions</h2><button className="btn o" onClick={()=>load(true)}>Refresh</button></div>
        {vtx.length===0&&<p className="note">Nothing recorded yet.</p>}
        {vtx.map(t=><div className="row" key={t.id}><span>{t.transfer?`Move${t.note?`: ${t.note}`:''}`:t.note||'No note'}<br/><span className="note">{day(t.at)}, {t.account}{t.category?`, ${t.category}`:''}</span></span><b className={t.transfer?'note':t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b></div>)}
      </section>
    </div>
  </>;
}