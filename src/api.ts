import {invoke} from '@tauri-apps/api/core';
export type Mods={github:boolean;commissions:boolean};
export type Prof={id:string;name:string;locked:boolean};
export type Sess={name:string;modules:Mods;locked:boolean};
export type Stats={balance_cents:number;week:number[]};
export type Acc={id:number;name:string;kind:string;balance_cents:number};
export type TxRow={id:number;account:string;amount_cents:number;note:string;at:number;category:string;transfer:boolean};
export type Fin={income_cents:number;outcome_cents:number};
export type TimeRow={id:number;project:string;start:number;end:number};
export type Summary={spent_cents:number;income_cents:number};
export type Slice={label:string;value:number};
export type Cfg={theme:'system'|'light'|'dark';accent:string;motion:'full'|'reduce';last?:string;main?:string};
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
  dash:()=>invoke<string>('dashboard_get'),
  saveDash:(json:string)=>invoke('dashboard_set',{json}),
  addTime:(project:string,start:number,end:number)=>invoke('add_time',{project,start,end}),
  addAccount:(name:string,kind:string,openingCents:number)=>invoke('add_account',{name,kind,openingCents}),
  addTx:(accountId:number,amountCents:number,note:string,at:number)=>invoke('add_tx',{accountId,amountCents,note,at}),
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
  transfer:(fromId:number,toId:number,amountCents:number,note:string,at:number)=>invoke('add_transfer',{fromId,toId,amountCents,note,at}),
  finance:(from:number,to:number)=>invoke<Fin>('finance_sum',{from,to}),
  byCategory:(from:number,to:number)=>invoke<Slice[]>('spend_by_category',{from,to}),
  categories:()=>invoke<string[]>('list_categories'),
};
export const money=(c:number)=>(c/100).toLocaleString(undefined,{style:'currency',currency:'USD'});
export const dur=(s:number)=>`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`;

export const now=()=>Math.floor(Date.now()/1000);
export const cents=(v:string)=>Math.round(parseFloat(v||'0')*100);
export const day=(t:number)=>new Date(t*1000).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
export const clock=(t:number)=>new Date(t*1000).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
