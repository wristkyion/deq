import {useEffect,useState} from 'react';
import {api,clock,dur,money,TimeRow,TxRow} from './api';
import {useToast} from './Toast';

const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function Daily(){
  const toast=useToast();
  const [d,setD]=useState(()=>iso(new Date()));
  const [times,setTimes]=useState<TimeRow[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  useEffect(()=>{
    const from=Math.floor(new Date(d+'T00:00:00').getTime()/1000);
    Promise.all([api.timeRange(from,from+86400),api.txRange(from,from+86400)])
      .then(([a,b])=>{setTimes(a);setTxs(b)}).catch(toast.error);
  },[d]);
  const shift=(n:number)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);setD(iso(x))};
  const secs=times.reduce((a,t)=>a+t.end-t.start,0);
  const out=-txs.filter(t=>!t.transfer&&t.amount_cents<0).reduce((a,t)=>a+t.amount_cents,0);
  const inn=txs.filter(t=>!t.transfer&&t.amount_cents>0).reduce((a,t)=>a+t.amount_cents,0);
  return <>
    <header>
      <div><h1>Daily</h1><p className="sub">Everything you recorded on one date.</p></div>
      <div className="acts">
        <button className="btn o" onClick={()=>shift(-1)}>Previous day</button>
        <input type="date" aria-label="Date" value={d} style={{width:'auto'}} onChange={e=>e.target.value&&setD(e.target.value)}/>
        <button className="btn o" onClick={()=>shift(1)}>Next day</button>
        <button className="btn" onClick={()=>setD(iso(new Date()))}>Today</button>
      </div>
    </header>
    <div className="grid">
      <section className="card"><h2>Time recorded</h2><div className="big">{dur(secs)}</div><p className="note">{times.length} entries</p></section>
      <section className="card">
        <h2>Money</h2>
        <div className="row"><span>Spent</span><b className="neg">{money(out)}</b></div>
        <div className="row"><span>Received</span><b className="pos">{money(inn)}</b></div>
      </section>
      <section className="card w">
        <h2>Time entries</h2>
        {times.length===0&&<p className="note">No time logged on this date.</p>}
        {times.map(t=><div className="row" key={t.id}><span>{t.project}<br/><span className="note">{clock(t.start)}</span></span><b>{Math.round((t.end-t.start)/60)} min</b></div>)}
      </section>
      <section className="card w">
        <h2>Transactions</h2>
        {txs.length===0&&<p className="note">No transactions on this date.</p>}
        {txs.map(t=><div className="row" key={t.id}><span>{t.note||'No note'}<br/><span className="note">{t.account}</span></span><b className={t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b></div>)}
      </section>
    </div>
  </>;
}