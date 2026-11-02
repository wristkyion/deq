import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,kindName,money,now,Summary,TxRow} from './api';
import Dialog,{Actions} from './Dialog';
import TxRows from './TxRows';
import { useToast } from './Toast';
import RemoveBtn from './RemoveBtn';

type Kind='Bank'|'Wallet';

export default function Bank(){
  const toast=useToast();
  const [view,setView]=useState<Kind>('Bank');
  const [dlg,setDlg]=useState<''|'account'|'tx'|'move'>('');
  const [ea,setEa]=useState<Acc|null>(null); // account being edited
  const [accs,setAccs]=useState<Acc[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  const [sum,setSum]=useState<Summary|null>(null);
  const load=(say=false)=>{
    const d=new Date();
    const from=Math.floor(new Date(d.getFullYear(),d.getMonth(),1).getTime()/1000);
    Promise.all([api.accounts(),api.txs(100),api.summary(from)]).then(([a,t,s])=>{
      setAccs(a);setTxs(t);setSum(s);
      if(say)toast.info(`Loaded ${a.length} accounts and ${t.length} transactions`);
    }).catch(toast.error);
  };
  useEffect(()=>{load()},[]);
  const sub=(ok:string,fn:(v:Record<string,string>)=>Promise<unknown>)=>async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();
    try{await fn(Object.fromEntries(new FormData(ev.currentTarget)) as Record<string,string>);toast.ok(ok);setDlg('');load()}catch(x){toast.error(x)}
  };
  const close=()=>setDlg('');
  const shown=accs.filter(a=>a.kind===view);
  const kindOf:Record<string,string>=Object.fromEntries(accs.map(a=>[a.name,a.kind]));
  const vtx=txs.filter(t=>kindOf[t.account]===view);
  const total=shown.reduce((n,a)=>n+a.balance_cents,0);
  const when=(v:Record<string,string>)=>v.date?Math.floor(new Date(v.date+'T12:00:00').getTime()/1000):now();
  const word=view==='Bank'?'bank account':'e-wallet';
  const acct=(a:Acc)=><div className="acts"><button className="btn o sm" onClick={()=>setEa(a)}>Edit</button><RemoveBtn what={view==='Bank'?'Account':'E-wallet'} hint={`This removes “${a.name}” and its transactions. Money you moved to or from it stays in the other account. This can’t be undone.`} onRemove={()=>api.delAccount(a.id).then(()=>load())}/></div>;

  return <div className="fit">
    <header>
      <div><h1>Bank &amp; E-Wallet</h1><p className="sub">Balances you record yourself. Deq never connects to a bank or e-wallet.</p></div>
      <div className="acts">
        <div className="seg" role="group" aria-label="Account type">{(['Bank','Wallet'] as const).map(k=><button key={k} aria-pressed={view===k} onClick={()=>setView(k)}>{kindName(k)}</button>)}</div>
        <button className="btn o" disabled={accs.length<2} onClick={()=>setDlg('move')}>Move money</button>
        <button className="btn o" onClick={()=>setDlg('account')}>Add {word}</button>
        <button className="btn" disabled={!shown.length} onClick={()=>setDlg('tx')}>Add transaction</button>
      </div>
    </header>

    <div className="stats">
      <section className="card stat"><h2>{kindName(view)} total</h2><div className="big">{money(total)}</div><p className="note">{shown.length} {shown.length===1?word:word+'s'}, recorded by you</p></section>
      <section className="card stat"><h2>Spent this month</h2><div className="big neg">{sum?money(sum.spent_cents):'…'}</div><p className="note">All accounts, moves not counted</p></section>
      <section className="card stat"><h2>Received this month</h2><div className="big pos">{sum?money(sum.income_cents):'…'}</div><p className="note">All accounts, moves not counted</p></section>
    </div>

    <div className="cols">
      <section className="card">
        <div className="row"><h2>Recent transactions</h2><button className="btn o" onClick={()=>load(true)}>Refresh</button></div>
        <div className="scroll"><TxRows txs={vtx} empty={`No ${kindName(view).toLowerCase()} transactions yet.`} onChange={()=>load()}/></div>
      </section>
      <section className="card">
        <h2>{view==='Bank'?'Bank accounts':'E-wallets'}</h2>
        <div className="scroll">
          {shown.length===0&&<div className="stack"><p className="note">No {word}s yet.</p><div><button className="btn" onClick={()=>setDlg('account')}>Add {word}</button></div></div>}
          {view==='Wallet'
            ?<div className="wallets">{shown.map(a=><div className="wtile" key={a.id}><span className="note">{a.name}</span><b className="big">{money(a.balance_cents)}</b>{acct(a)}</div>)}</div>
            :shown.map(a=><div className="row" key={a.id}><span>{a.name}<br/><span className="note">Recorded balance</span></span><div className="acts"><b>{money(a.balance_cents)}</b>{acct(a)}</div></div>)}
        </div>
      </section>
    </div>

    {dlg==='account'&&<Dialog title={`Add ${word}`} onClose={close}>
      <form className="stack" onSubmit={sub(view==='Bank'?'Bank account added':'E-wallet added',v=>api.addAccount(v.name,v.kind,cents(v.opening)))}>
        <label>Name<input name="name" required/></label>
        <label>Type<select name="kind" defaultValue={view}><option value="Bank">Bank</option><option value="Wallet">E-wallet</option></select></label>
        <label>Opening balance<input name="opening" type="number" step="0.01" defaultValue="0"/></label>
        <Actions ok="Add" onClose={close}/>
      </form>
    </Dialog>}

    {ea&&<Dialog title="Edit account" onClose={()=>setEa(null)}>
      <form className="stack" onSubmit={sub('Account updated',v=>api.updateAccount(ea.id,v.name,v.kind,cents(v.opening)).then(()=>setEa(null)))}>
        <label>Name<input name="name" defaultValue={ea.name} required/></label>
        <label>Type<select name="kind" defaultValue={ea.kind}><option value="Bank">Bank</option><option value="Wallet">E-wallet</option></select></label>
        <label>Opening balance<input name="opening" type="number" step="0.01" defaultValue={(ea.opening_cents/100).toFixed(2)}/></label>
        <p className="note" style={{margin:0}}>The balance is this opening amount plus all of the account’s transactions, so changing it changes the balance.</p>
        <Actions ok="Save changes" onClose={()=>setEa(null)}/>
      </form>
    </Dialog>}

    {dlg==='tx'&&<Dialog title="Add transaction" onClose={close}>
      <form className="stack" onSubmit={sub('Transaction added',v=>api.addTx(+v.account,cents(v.amount),v.note,when(v),v.category))}>
        <label>Account<select name="account" required>{shown.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Amount (negative = money out)<input name="amount" type="number" step="0.01" required/></label>
        <label>Category (optional)<input name="category"/></label>
        <label>Note<input name="note"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <Actions ok="Add" onClose={close}/>
      </form>
    </Dialog>}

    {dlg==='move'&&<Dialog title="Move money" onClose={close}>
      <form className="stack" onSubmit={sub('Money moved',v=>api.transfer(+v.from,+v.to,Math.abs(cents(v.amount)),v.note,when(v)))}>
        <label>From<select name="from">{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({kindName(a.kind)})</option>)}</select></label>
        <label>To<select name="to" defaultValue={accs[1]?.id}>{accs.map(a=><option key={a.id} value={a.id}>{a.name} ({kindName(a.kind)})</option>)}</select></label>
        <label>Amount<input name="amount" type="number" step="0.01" min="0" required/></label>
        <label>Note<input name="note" placeholder="Top-up"/></label>
        <label>Date (empty = now)<input name="date" type="date"/></label>
        <Actions ok="Move" onClose={close}/>
      </form>
    </Dialog>}
  </div>;
}
