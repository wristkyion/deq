import {useState} from 'react';
import Dialog from './Dialog';
import {useToast} from './Toast';

export default function RemoveBtn({what,hint,onRemove}:{what:string;hint?:string;onRemove:()=>Promise<unknown>}){
  const toast=useToast();
  const [ask,setAsk]=useState(false);
  const go=async()=>{try{await onRemove();toast.ok(`${what} removed`);setAsk(false)}catch(x){toast.error(x)}};
  return <>
    <button className="btn o sm" onClick={()=>setAsk(true)}>Remove</button>
    {ask&&<Dialog title={`Remove this ${what.toLowerCase()}?`} onClose={()=>setAsk(false)}>
      <p className="note" style={{margin:0}}>{hint??'This can’t be undone.'}</p>
      <div className="acts"><button className="btn o" onClick={()=>setAsk(false)}>Cancel</button><button className="btn" onClick={go}>Remove</button></div>
    </Dialog>}
  </>;
}
