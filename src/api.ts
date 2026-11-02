import {invoke} from '@tauri-apps/api/core';
export type Mods={github:boolean;commissions:boolean};
export type Prof={id:string;name:string;locked:boolean};
export type Sess={name:string;modules:Mods;locked:boolean;currency:string;week_start:number};
export type Stats={balance_cents:number;week:number[]};
export type Acc={id:number;name:string;kind:string;balance_cents:number;opening_cents:number};
export type TxRow={id:number;account_id:number;account:string;amount_cents:number;note:string;at:number;category:string;transfer:boolean};
export type Fin={income_cents:number;outcome_cents:number};
export type TimeRow={id:number;project:string;start:number;end:number};
export type Summary={spent_cents:number;income_cents:number};
export type Slice={label:string;value:number};
export type Bak={file:string;name:string;at:number;size:number};
export type Cfg={theme:'system'|'light'|'dark';accent:string;motion:'full'|'reduce';last?:string;main?:string;autolock?:number};
export const api={
  cfg:()=>invoke<Partial<Cfg>>('cfg_get'),
  setCfg:(v:Cfg)=>invoke('cfg_set',{v}),
  profiles:()=>invoke<Prof[]>('profiles'),
  create:(name:string,password:string,modules:Mods)=>invoke<{id:string;recovery:string|null}>('create_profile',{name,password:password||null,modules}),
  open:(id:string,password?:string)=>invoke<Sess>('open_profile',{id,password:password||null}),
  lock:()=>invoke('lock_now'),
  setPw:(password:string)=>invoke<string>('set_password',{password}),
  rmPw:(current:string)=>invoke('remove_password',{current}),
  recover:(id:string,recovery:string,password:string)=>invoke<string>('recover',{id,recovery,password}),
  setMod:(name:string,on:boolean)=>invoke('set_module',{name,on}),
  renameProfile:(id:string,name:string)=>invoke('rename_profile',{id,name}),
  savePrefs:(currency:string,weekStart:number)=>invoke('set_prefs',{currency,weekStart}),
  about:()=>invoke<{version:string;path:string}>('about_info'),
  exportBackup:(password:string)=>invoke<string>('export_backup',{password}),
  backups:()=>invoke<Bak[]>('list_backups'),
  importBackup:(file:string,backupPassword:string,password:string)=>invoke<{id:string;recovery:string|null}>('import_backup',{file,backupPassword,password:password||null}),
  dash:()=>invoke<string>('dashboard_get'),
  saveDash:(json:string)=>invoke('dashboard_set',{json}),
  addTime:(project:string,start:number,end:number)=>invoke('add_time',{project,start,end}),
  updateTime:(id:number,project:string,start:number,end:number)=>invoke('update_time',{id,project,start,end}),
  addAccount:(name:string,kind:string,openingCents:number)=>invoke('add_account',{name,kind,openingCents}),
  updateAccount:(id:number,name:string,kind:string,openingCents:number)=>invoke('update_account',{id,name,kind,openingCents}),
  accounts:()=>invoke<Acc[]>('list_accounts'),
  stats:(weekStart:number)=>invoke<Stats>('stats',{weekStart}),
  txs:(limit:number)=>invoke<TxRow[]>('list_tx',{limit}),
  times:(limit:number)=>invoke<TimeRow[]>('list_time',{limit}),
  summary:(from:number)=>invoke<Summary>('spend_summary',{from}),
  txRange:(from:number,to:number)=>invoke<TxRow[]>('list_tx_range',{from,to}),
  timeRange:(from:number,to:number)=>invoke<TimeRow[]>('list_time_range',{from,to}),
  projects:()=>invoke<Slice[]>('project_totals'),
  spendBy:(from:number)=>invoke<Slice[]>('spend_by_account',{from}),
  delProfile: (id: string, password: string) => invoke('delete_profile', { id, password: password || null }),
  addTx:(accountId:number,amountCents:number,note:string,at:number,category?:string)=>invoke('add_tx',{accountId,amountCents,note,at,category:category||null}),
  updateTx:(id:number,accountId:number,amountCents:number,note:string,at:number,category?:string)=>invoke('update_tx',{id,accountId,amountCents,note,at,category:category||null}),
  transfer:(fromId:number,toId:number,amountCents:number,note:string,at:number)=>invoke('add_transfer',{fromId,toId,amountCents,note,at}),
  finance:(from:number,to:number)=>invoke<Fin>('finance_sum',{from,to}),
  byCategory:(from:number,to:number)=>invoke<Slice[]>('spend_by_category',{from,to}),
  categories: () => invoke<string[]>('list_categories'),
  delTx:(id:number)=>invoke('delete_tx',{id}),
  delTime: (id: number) => invoke('delete_time', { id }),
  delAccount:(id:number)=>invoke('delete_account',{id}),
};
let CUR='USD',WK=1; // active profile's currency and week start (1 = Monday, 0 = Sunday)
export const applyPrefs=(c:string,w:number)=>{CUR=c;WK=w};
export const CURRENCIES:[string,string][]=[['USD','US Dollar'],['EUR','Euro'],['GBP','British Pound'],['JPY','Japanese Yen'],['IDR','Indonesian Rupiah'],['SGD','Singapore Dollar'],['MYR','Malaysian Ringgit'],['AUD','Australian Dollar'],['CAD','Canadian Dollar']];
export const money=(c:number)=>(c/100).toLocaleString(undefined,{style:'currency',currency:CUR});
export const weekIdx=(d=new Date())=>(d.getDay()-WK+7)%7;
export const weekStart=(d=new Date())=>new Date(d.getFullYear(),d.getMonth(),d.getDate()-weekIdx(d));
export const weekLabels=()=>(WK===1?'MTWTFSS':'SMTWTFS').split('');
export const dur=(s:number)=>`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;

export const now=()=>Math.floor(Date.now()/1000);
export const cents=(v:string)=>Math.round(parseFloat(v||'0')*100);
export const day=(t:number)=>new Date(t*1000).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
export const clock=(t:number)=>new Date(t*1000).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export const kindName=(k:string)=>k==='Wallet'?'E-wallet':k;

// ---- date inputs (local time) ----
const p2=(n:number)=>String(n).padStart(2,'0');
export const dateInput=(t:number)=>{const d=new Date(t*1000);return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}; // for <input type="date">
export const dtLocal=(t:number)=>{const d=new Date(t*1000);return `${dateInput(t)}T${p2(d.getHours())}:${p2(d.getMinutes())}`}; // for <input type="datetime-local">
export const fromLocal=(v:string)=>Math.floor(new Date(v).getTime()/1000);
export const noon=(date:string)=>Math.floor(new Date(date+'T12:00:00').getTime()/1000);
