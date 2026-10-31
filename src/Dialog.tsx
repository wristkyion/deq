import {ReactNode,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';

export default function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};
    window.addEventListener('keydown',k);
    ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    return()=>window.removeEventListener('keydown',k);
  },[]);
  return createPortal(
    <div className="ov" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="dlg" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    document.body);
}

export const Actions=({ok,onClose,off}:{ok:string;onClose:()=>void;off?:boolean})=>
  <div className="acts"><button type="button" className="btn o" onClick={onClose}>Cancel</button><button className="btn" disabled={off}>{ok}</button></div>;
