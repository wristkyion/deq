import {FormEvent,useEffect,useState} from 'react';
import {api,clock,dur,now,Slice,TimeRow} from './api';
import {useToast} from './Toast';

export default function Activity(){
  const toast=useToast();
  const [times,setTimes]=useState<TimeRow[]>([]);
  const [projs,setProjs]=useState<Slice[]>([]);
  const load=()=>Promise.all([api.times(30),api.projects()]).then(([t,p])=>{setTimes(t);setProjs(p)}).catch(toast.error);
  useEffect(()=>{load()},[]);
  const submit=async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();const f=ev.currentTarget;
    const v=Object.fromEntries(new FormData(f)) as Record<string,string>;
    try{await api.addTime(v.project,now()-Math.max(1,+v.minutes)*60,now());f.reset();toast.ok('Time entry added');load()}catch(x){toast.error(x)}
  };
  const total=projs.reduce((a,p)=>a+p.value,0);
  return <>
    <header><div><h1>Activity</h1><p className="sub">Projects and the time you spent on them.</p></div></header>
    <div className="grid">
      <form className="card stack" onSubmit={submit}>
        <h2>Log time</h2>
        <label>Project<input name="project" required/></label>
        <label>Minutes just spent<input name="minutes" type="number" min="1" required/></label>
        <button className="btn">Save entry</button>
      </form>
      <section className="card">
        <h2>Total accumulated</h2>
        <div className="big">{dur(total)}</div>
        {projs.length===0&&<p className="note">No time logged yet.</p>}
        {projs.map(p=><div className="row" key={p.label}><span>{p.label}</span><b>{dur(p.value)}</b></div>)}
      </section>
      <section className="card w">
        <h2>Recent entries</h2>
        {times.length===0&&<p className="note">Nothing here yet. Log your first entry.</p>}
        {times.map(t=><div className="row" key={t.id}><span>{t.project}<br/><span className="note">{clock(t.start)}</span></span><b>{Math.round((t.end-t.start)/60)} min</b></div>)}
      </section>
    </div>
  </>;
}
