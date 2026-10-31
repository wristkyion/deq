import {useEffect,useState} from 'react';
import {getCurrentWindow} from '@tauri-apps/api/window';

export default function TitleBar(){
  const w=getCurrentWindow();
  const [max,setMax]=useState(false);
  useEffect(()=>{
    const sync=()=>w.isMaximized().then(setMax);
    sync();
    const un=w.onResized(sync);
    return()=>{un.then(f=>f())};
  },[]);
  const ic={fill:'none',stroke:'currentColor'} as const;
  return <div className="tb">
    <div className="tb-title" data-tauri-drag-region><span>Deq</span></div>
    <div className="tb-btns">
      <button aria-label="Minimize" title="Minimize" onClick={()=>w.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" {...ic}/></svg></button>
      <button aria-label={max?'Restore':'Maximize'} title={max?'Restore':'Maximize'} onClick={()=>w.toggleMaximize()}>
        {max
          ?<svg width="10" height="10" viewBox="0 0 10 10"><rect x="2.5" y=".5" width="7" height="7" {...ic}/><path d="M.5 2.5v7h7" {...ic}/></svg>
          :<svg width="10" height="10" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" {...ic}/></svg>}</button>
      <button className="x" aria-label="Close" title="Close" onClick={()=>w.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" {...ic}/></svg></button>
    </div>
  </div>;
}
