import {createContext,ReactNode,useCallback,useContext,useMemo,useState} from 'react';
type Kind='ok'|'info'|'error';
type T={id:number;kind:Kind;text:string;out?:boolean};
type Ctx={ok:(t:string)=>void;info:(t:string)=>void;error:(x:unknown)=>void};
const C=createContext<Ctx>({ok(){},info(){},error(){}});
export const useToast=()=>useContext(C);

export function ToastProvider({children}:{children:ReactNode}){
  const [ts,setTs]=useState<T[]>([]);
  const close=useCallback((id:number)=>{
    setTs(a=>a.map(t=>t.id===id?{...t,out:true}:t));
    setTimeout(()=>setTs(a=>a.filter(t=>t.id!==id)),200);
  },[]);
  const push=useCallback((kind:Kind,text:string)=>{
    const id=Date.now()+Math.random();
    setTs(a=>[...a.slice(-4),{id,kind,text}]);
    setTimeout(()=>close(id),kind==='error'?8000:3500);
  },[close]);
  const v=useMemo<Ctx>(()=>({
    ok:t=>push('ok',t),info:t=>push('info',t),
    error:x=>push('error',String(x).replace(/^Error:\s*/,'')),
  }),[push]);
  return <C.Provider value={v}>{children}
    <div className="toasts" role="region" aria-label="Notifications">
      {ts.map(t=><div key={t.id} className={`toast ${t.kind}${t.out?' out':''}`} role={t.kind==='error'?'alert':'status'}>
        <span>{t.kind==='error'&&<b>Error: </b>}{t.text}</span>
        <button onClick={()=>close(t.id)}>Close</button>
      </div>)}
    </div></C.Provider>;
}
