import {FormEvent,useEffect,useState} from 'react';
import {api,clock,dtLocal,dur,fromLocal,now,Slice,TimeRow,weekIdx,weekStart} from './api';
import Dialog,{Actions} from './Dialog';
import { useToast } from './Toast';
import RemoveBtn from './RemoveBtn';

export default function Activity(){
  const toast=useToast();
  const [dlg,setDlg]=useState<TimeRow|'new'|null>(null); // 'new' = log time, a row = edit that entry
  const [mode,setMode]=useState<'min'|'range'>('min');
  const [times,setTimes]=useState<TimeRow[]>([]);
  const [projs,setProjs]=useState<Slice[]>([]);
  const [week,setWeek]=useState<number[]>([]);
  const load=()=>{
    Promise.all([api.times(100),api.projects(),api.stats(Math.floor(weekStart().getTime()/1000))])
      .then(([t,p,s])=>{setTimes(t);setProjs(p);setWeek(s.week)}).catch(toast.error);
  };
  useEffect(()=>{load()},[]);
  const open=(d:TimeRow|'new')=>{setMode('min');setDlg(d)};
  const submit=async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();
    if(!dlg)return;
    const v=Object.fromEntries(new FormData(ev.currentTarget)) as Record<string,string>;
    try{
      if(dlg==='new'&&mode==='min'){
        await api.addTime(v.project.trim(),now()-Math.max(1,+v.minutes)*60,now());toast.ok('Time entry added');
      }else{
        const s=fromLocal(v.start),en=fromLocal(v.end);
        if(!(en>s)){toast.error('End time must be after the start');return}
        if(dlg==='new'){await api.addTime(v.project.trim(),s,en);toast.ok('Time entry added')}
        else{await api.updateTime(dlg.id,v.project.trim(),s,en);toast.ok('Time entry updated')}
      }
      setDlg(null);load();
    }catch(x){toast.error(x)}
  };
  const total=projs.reduce((a,p)=>a+p.value,0);
  const weekTotal=week.reduce((a,b)=>a+b,0);
  const today=week[weekIdx()]??0;
  const mx=Math.max(...projs.map(p=>p.value),1);
  const range=dlg!=='new'||mode==='range';

  return <div className="fit">
    <header>
      <div><h1>Activity</h1><p className="sub">Projects and the time you spent on them.</p></div>
      <div className="acts"><button className="btn" onClick={()=>open('new')}>Log time</button></div>
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
          {times.map(t=><div className="row" key={t.id}><span>{t.project}<br/><span className="note">{clock(t.start)}</span></span><div className="acts"><b>{Math.round((t.end-t.start)/60)} min</b><button className="btn o sm" onClick={()=>open(t)}>Edit</button><RemoveBtn what="Time entry" onRemove={()=>api.delTime(t.id).then(load)}/></div></div>)}
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

    {dlg&&<Dialog title={dlg==='new'?'Log time':'Edit time entry'} onClose={()=>setDlg(null)}>
      <form className="stack" onSubmit={submit}>
        {dlg==='new'&&<div className="seg" role="group" aria-label="How to enter the time">
          <button type="button" aria-pressed={mode==='min'} onClick={()=>setMode('min')}>Minutes spent</button>
          <button type="button" aria-pressed={mode==='range'} onClick={()=>setMode('range')}>Start and end</button>
        </div>}
        <label>Project<input name="project" list="projs" defaultValue={dlg==='new'?'':dlg.project} required/></label>
        <datalist id="projs">{projs.map(p=><option key={p.label} value={p.label}/>)}</datalist>
        {range
          ?<>
            <label>Start<input name="start" type="datetime-local" defaultValue={dtLocal(dlg==='new'?now()-3600:dlg.start)} required/></label>
            <label>End<input name="end" type="datetime-local" defaultValue={dtLocal(dlg==='new'?now():dlg.end)} required/></label>
          </>
          :<label>Minutes just spent<input name="minutes" type="number" min="1" required/></label>}
        <Actions ok={dlg==='new'?'Save entry':'Save changes'} onClose={()=>setDlg(null)}/>
      </form>
    </Dialog>}
  </div>;
}
