import {useState} from 'react';
const DAYS='MTWTFSS'.split('');

export default function Calendar(){
  const [off,setOff]=useState(0);
  const t=new Date();
  const m=new Date(t.getFullYear(),t.getMonth()+off,1);
  const lead=(m.getDay()+6)%7;
  const len=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
  const days=[...Array<number>(lead).fill(0),...Array.from({length:len},(_,i)=>i+1)];
  return <div className="cal">
    <div className="split">
      <b>{m.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</b>
      <div className="acts">
        <button className="btn o sm" onClick={()=>setOff(off-1)}>Previous</button>
        {off!==0&&<button className="btn o sm" onClick={()=>setOff(0)}>Today</button>}
        <button className="btn o sm" onClick={()=>setOff(off+1)}>Next</button>
      </div>
    </div>
    <div className="cal-g">
      {DAYS.map((d,i)=><span className="h" key={'h'+i}>{d}</span>)}
      {days.map((d,i)=><span key={i} className={off===0&&d===t.getDate()?'t':undefined}>{d||''}</span>)}
    </div>
  </div>;
}
