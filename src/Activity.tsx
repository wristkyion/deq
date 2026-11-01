import {FormEvent,useEffect,useState} from 'react';
import {api,clock,dur,now,Slice,TimeRow,weekIdx,weekStart} from './api';
import Dialog,{Actions} from './Dialog';
import { useToast } from './Toast';
import RemoveBtn from './RemoveBtn';

export default function Activity(){
  const toast=useToast();
  const [dlg,setDlg]=useState(false);
  const [times,setTimes]=useState<TimeRow[]>([]);
  const [projs,setProjs]=useState<Slice[]>([]);
  const [week,setWeek]=useState<number[]>([]);
  const load=()=>{
    Promise.all([api.times(100),api.projects(),api.stats(Math.floor(weekStart().getTime()/1000))])
      .then(([t,p,s])=>{setTimes(t);setProjs(p);setWeek(s.week)}).catch(toast.error);
  };
  useEffect(()=>{load()},[]);
  const submit=async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();
    const v=Object.fromEntries(new FormData(ev.currentTarget)) as Record<string,string>;
    try{await api.addTime(v.project.trim(),now()-Math.max(1,+v.minutes)*60,now());toast.ok('Time entry added');setDlg(false);load()}catch(x){toast.error(x)}
  };
  const total=projs.reduce((a,p)=>a+p.value,0);
  const weekTotal=week.reduce((a,b)=>a+b,0);
  const today=week[weekIdx()]??0;
  const mx=Math.max(...projs.map(p=>p.value),1);

  return <div className="fit">
    <header>
      <div><h1>Activity</h1><p className="sub">Projects and the time you spent on them.</p></div>
      <div className="acts"><button className="btn" onClick={()=>setDlg(true)}>Log time</button></div>
    </header>

    <div className="stats">
      <section className="card stat"><h2>Today</h2><div className="big">{dur(today)}</div></section>
      <section className="card stat"><h2>This week</h2><div className="big">{dur(weekTotal)}</div></section>
      <section className="card stat"><h2>Total accumulated</h2><div className="big">{dur(total)}</div></section>
    </div>

    <div className="cols">
      <section className="card">
        <h2>Recent entries</h2>
        <div className="scroll">
          {times.length===0&&<p className="note">Nothing here yet. Choose Log time to add your first entry.</p>}
          {times.map(t=><div className="row" key={t.id}><span>{t.project}<br/><span className="note">{clock(t.start)}</span></span><div className="acts"><b>{Math.round((t.end-t.start)/60)} min</b><RemoveBtn what="Time entry" onRemove={()=>api.delTime(t.id).then(load)}/></div></div>)}
        </div>
      </section>
      <section className="card">
        <h2>Time by project</h2>
        <div className="scroll">
          {projs.length===0&&<p className="note">No time logged yet.</p>}
          {projs.map(p=><div className="prj" key={p.label}>
            <div className="split"><span>{p.label}</span><b>{dur(p.value)}</b></div>
            <div className="pbar"><i style={{width:`${p.value/mx*100}%`}}/></div>
          </div>)}
        </div>
      </section>
    </div>

    {dlg&&<Dialog title="Log time" onClose={()=>setDlg(false)}>
      <form className="stack" onSubmit={submit}>
        <label>Project<input name="project" list="projs" required/></label>
        <datalist id="projs">{projs.map(p=><option key={p.label} value={p.label}/>)}</datalist>
        <label>Minutes just spent<input name="minutes" type="number" min="1" required/></label>
        <Actions ok="Save entry" onClose={()=>setDlg(false)}/>
      </form>
    </Dialog>}
  </div>;
}
