import {Slice} from './api';
const PAL=['var(--ac)','#12a36b','#e9a23b','#e11d74','#2563eb','#0d9488','#8b5cf6'];

export function Pie({data,fmt}:{data:Slice[];fmt:(n:number)=>string}){
  const tot=data.reduce((a,d)=>a+d.value,0);
  if(!tot)return <p className="note">No data yet.</p>;
  let a0=-Math.PI/2;
  const slices=data.map((d,i)=>{
    const a=d.value/tot*2*Math.PI,a1=a0+a;
    const p=data.length===1?'M0 -1A1 1 0 1 1 0 1A1 1 0 1 1 0 -1Z'
      :`M0 0L${Math.cos(a0)} ${Math.sin(a0)}A1 1 0 ${a>Math.PI?1:0} 1 ${Math.cos(a1)} ${Math.sin(a1)}Z`;
    a0=a1;
    return <path key={i} d={p} fill={PAL[i%PAL.length]}><title>{d.label}: {fmt(d.value)}</title></path>;
  });
  return <div className="pie">
    <svg viewBox="-1 -1 2 2" role="img" aria-label="Pie chart">{slices}<circle r=".55" fill="var(--card)"/></svg>
    <div className="legend">{data.map((d,i)=><div key={i}><i style={{background:PAL[i%PAL.length]}}/>{d.label} <b>{fmt(d.value)}</b></div>)}</div>
  </div>;
}

export function Line({values,labels,fmt}:{values:number[];labels:string[];fmt?:(n:number)=>string}){
  if(values.length<2)return null;
  const mx=Math.max(...values,1),n=values.length;
  const pts=values.map((v,i)=>`${i/(n-1)*100} ${46-v/mx*40}`);
  return <div className="lc">
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label="Line chart">
      <path d={`M0 50L${pts.join('L')}L100 50Z`} fill="var(--ac)" opacity=".15"/>
      <path d={`M${pts.join('L')}`} fill="none" stroke="var(--ac)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    </svg>
    <div className="xl">{labels.map((l,i)=><span key={i}>{l}{fmt&&<><br/><b>{fmt(values[i])}</b></>}</span>)}</div>
  </div>;
}

export function Radar({values,labels}:{values:number[];labels:string[]}){
  const n=values.length,mx=Math.max(...values,1);
  const P=(i:number,r:number)=>{const a=-Math.PI/2+i/n*2*Math.PI;return [Math.cos(a)*r,Math.sin(a)*r]};
  const poly=(f:(i:number)=>number)=>values.map((_,i)=>P(i,f(i)).join(',')).join(' ');
  return <div className="chart radar">
    <svg viewBox="-1.55 -1.45 3.1 2.9" role="img" aria-label="Radar chart">
      {[.33,.66,1].map(r=><polygon key={r} points={poly(()=>r)} fill="none" stroke="var(--bd)" strokeWidth=".012"/>)}
      {values.map((_,i)=><line key={i} x1="0" y1="0" x2={P(i,1)[0]} y2={P(i,1)[1]} stroke="var(--bd)" strokeWidth=".012"/>)}
      <polygon points={poly(i=>values[i]/mx)} fill="var(--ac)" fillOpacity=".25" stroke="var(--ac)" strokeWidth=".03" strokeLinejoin="round"/>
      {labels.map((l,i)=><text key={i} x={P(i,1.22)[0]} y={P(i,1.22)[1]} fontSize=".16" textAnchor="middle" dominantBaseline="middle" fill="var(--mut)">{l}</text>)}
    </svg>
  </div>;
}
