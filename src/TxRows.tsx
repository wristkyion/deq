import {api,day,money,TxRow} from './api';
import RemoveBtn from './RemoveBtn';

export default function TxRows({txs,empty,onChange,readOnly}:{txs:TxRow[];empty:string;onChange?:()=>void;readOnly?:boolean}){
  if(!txs.length)return <p className="note">{empty}</p>;
  return <>{txs.map(t=><div className="row" key={t.id}>
    <span>{t.transfer?`Move${t.note?`: ${t.note}`:''}`:t.note||'No note'}<br/><span className="note">{day(t.at)}, {t.account}{t.category?`, ${t.category}`:''}</span></span>
    <div className="acts">
      <b className={t.transfer?'note':t.amount_cents<0?'neg':'pos'}>{money(t.amount_cents)}</b>
      {!readOnly&&<RemoveBtn what={t.transfer?'Move':'Transaction'} hint={t.transfer?'This removes both sides of the move. This can’t be undone.':undefined} onRemove={()=>api.delTx(t.id).then(()=>onChange?.())}/>}
    </div>
  </div>)}</>;
}
