import {useEffect,useState} from 'react';
import {api,clock,dur,money,TimeRow,TxRow} from './api';
import TxRows from './TxRows';
import { useToast } from './Toast';

const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export default function Daily(){
  const toast=useToast();
  const [d,setD]=useState(()=>iso(new Date()));
  const [times,setTimes]=useState<TimeRow[]>([]);
  const [txs,setTxs]=useState<TxRow[]>([]);
  const from=Math.floor(new Date(d+'T00:00:00').getTime()/1000),to=from+86400;
  const load=()=>{
    Promise.all([api.timeRange(from,to),api.txRange(from,to)])
      .then(([a,b])=>{setTimes(a);setTxs(b)}).catch(toast.error);
  };
  useEffect(()=>{load()},[d]);
  const shift=(n:number)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);setD(iso(x))};
  const part=(t:TimeRow)=>Math.max(0,Math.min(t.end,to)-Math.max(t.start,from)); // only the part of an entry that falls on this day
  const real=txs.filter(t=>!t.transfer);
  const secs=times.reduce((a,t)=>a+part(t),0);
  const out=-real.filter(t=>t.amount_cents<0).reduce((a,t)=>a+t.amount_cents,0);
  const inn=real.filter(t=>t.amount_cents>0).reduce((a,t)=>a+t.amount_cents,0);
  const label=new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return <div className="fit">
    <header>
      <div><h1>Daily</h1><p className="sub">{label}</p></div>
      <div className="acts">
        <button className="btn o" onClick={()=>shift(-1)}>Previous day</button>
        <input type="date" aria-label="Date" value={d} style={{width:'auto'}} onChange={e=>e.target.value&&setD(e.target.value)}/>
        <button className="btn o" onClick={()=>shift(1)}>Next day</button>
        <button className="btn" onClick={()=>setD(iso(new Date()))}>Today</button>
      </div>
    </header>

    <div className="stats">
      <section className="card stat"><h2>Time recorded</h2><div className="big">{dur(secs)}</div><p className="note">{times.length} {times.length===1?'entry':'entries'}</p></section>
      <section className="card stat"><h2>Spent</h2><div className="big neg">{money(out)}</div></section>
      <section className="card stat"><h2>Received</h2><div className="big pos">{money(inn)}</div></section>
    </div>

    <div className="cols even">
      <section className="card">
        <h2>Time entries</h2>
        <div className="scroll">
          {times.length===0&&<p className="note">No time logged on this date.</p>}
          {times.map(t=>{const p=part(t),tot=t.end-t.start;return <div className="row" key={t.id}><span>{t.project}<br/><span className="note">{clock(t.start)}</span></span><b>{Math.round(p/60)} min{p<tot&&<span className="note"> of {Math.round(tot/60)} min</span>}</b></div>})}
        </div>
      </section>
      <section className="card">
        <h2>Transactions</h2>
        <div className="scroll"><div className="scroll"><div className="scroll"><TxRows txs={txs} empty="No transactions on this date." readOnly/></div></div></div>
      </section>
    </div>
  </div>;
}
