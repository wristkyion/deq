import {FormEvent,useEffect,useState} from 'react';
import {Acc,api,cents,dateInput,noon,TxRow} from './api';
import Dialog,{Actions} from './Dialog';
import {useToast} from './Toast';

/** Edit dialog for one transaction, or for a move (both of its sides change together). */
export default function EditTx({tx,onClose,onSaved}:{tx:TxRow;onClose:()=>void;onSaved:()=>void}){
  const toast=useToast();
  const [accs,setAccs]=useState<Acc[]>([]);
  const [cats,setCats]=useState<string[]>([]);
  useEffect(()=>{Promise.all([api.accounts(),api.categories()]).then(([a,c])=>{setAccs(a);setCats(c)}).catch(toast.error)},[]);
  const submit=async(ev:FormEvent<HTMLFormElement>)=>{
    ev.preventDefault();
    const v=Object.fromEntries(new FormData(ev.currentTarget)) as Record<string,string>;
    const amt=tx.transfer?Math.abs(cents(v.amount)):cents(v.amount);
    if(!amt){toast.error('Enter an amount above zero');return}
    const at=!v.date||v.date===dateInput(tx.at)?tx.at:noon(v.date); // an unchanged date keeps the original time of day
    try{
      await api.updateTx(tx.id,tx.transfer?tx.account_id:+v.account,amt,v.note,at,v.category);
      toast.ok(tx.transfer?'Move updated':'Transaction updated');onClose();onSaved();
    }catch(x){toast.error(x)}
  };
  const shown=((tx.transfer?Math.abs(tx.amount_cents):tx.amount_cents)/100).toFixed(2);
  return <Dialog title={tx.transfer?'Edit move':'Edit transaction'} onClose={onClose}>
    <form className="stack" onSubmit={submit}>
      {tx.transfer
        ?<p className="note" style={{margin:0}}>A move between two of your accounts. Changing the amount, note or date changes both sides. To use different accounts, remove it and add a new move.</p>
        :<label>Account<select key={accs.length} name="account" defaultValue={tx.account_id}>{accs.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <label>{tx.transfer?'Amount':'Amount (negative = money out)'}<input name="amount" type="number" step="0.01" min={tx.transfer?'0':undefined} defaultValue={shown} required/></label>
      {!tx.transfer&&<label>Category (optional)<input name="category" list="ecats" defaultValue={tx.category}/></label>}
      {!tx.transfer&&<datalist id="ecats">{cats.map(c=><option key={c} value={c}/>)}</datalist>}
      <label>Note<input name="note" defaultValue={tx.note}/></label>
      <label>Date<input name="date" type="date" defaultValue={dateInput(tx.at)}/></label>
      <Actions ok="Save changes" onClose={onClose}/>
    </form>
  </Dialog>;
}
