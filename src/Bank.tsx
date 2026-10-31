import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,day,money,now,Summary,TxRow} from './api';
import {useToast} from './Toast';

export default function Bank(){
  const toast=useToast();
  const [accs,setAccs]=useState<Acc[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  const [sum,setSum]=useState<Summary|null>(null);
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
  return <>
    <header><div><h1>Bank &amp; Wallet</h1><p className="sub">Balances you record yourself. Deq never connects to a bank.</p></div></header>
    <div className="grid">
      <form className="card stack" onSubmit={sub('Account added',v=>api.addAccount(v.name,v.kind,cents(v.opening)))}>
        <h2>Add account</h2>
        <label>Name<input name="name" required/></label>
        <label>Type<select name="kind"><option>Bank</option><option>Wallet</option></select></label>
        <label>Opening balance<input name="opening" type="number" step="0.01" defaultValue="0"/></label>
        <button className="btn">Add account</button>
      </form>
      <form className="card stack" onSubmit={sub('Transaction added',v=>api.addTx(+v.account,cents(v.amount),v.note,v.date?Math.floor(new Date(v.date+'T12:00:00').getTime()/1000):now()))}>
        <h2>Add transaction</h2>
        <label>Account<select name="account" required>{accs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Amount (negative = money out)<input name="amount" type="number" step="0.01" required/></label>
        <label>Note<input name="note"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <button className="btn" disabled={!accs.length}>Add transaction</button>
      </form>
      <section className="card">
        <h2>This month</h2>
        <div className="row"><span>Spent</span><b className="neg">{sum?money(sum.spent_cents):'…'}</b></div>
        <div className="row"><span>Received</span><b className="pos">{sum?money(sum.income_cents):'…'}</b></div>
        <p className="note">Since the 1st of this month.</p>
      </section>
      <section className="card w">
        <h2>Accounts</h2>
        {accs.length===0&&<p className="note">No accounts yet. Add one to start recording balances.</p>}
        {accs.map(a=><div className="row" key={a.id}><span>{a.name}<br/><span className="note">{a.kind}, recorded balance</span></span><b>{money(a.balance_cents)}</b></div>)}
      </section>
      <section className="card w">
        <div className="row"><h2>Recent transactions</h2><button className="btn o" onClick={()=>load(true)}>Refresh</button></div>
        {txs.length===0&&<p className="note">Nothing recorded yet. Add a transaction above.</p>}
        {txs.map(t=><div className="row" key={t.id}><span>{t.note||'No note'}<br/><span className="note">{day(t.at)}, {t.account}</span></span><b className={t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b></div>)}
      </section>
    </div>
  </>;
}
