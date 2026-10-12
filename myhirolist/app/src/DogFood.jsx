import React, { useEffect, useState } from 'react';
import { migrationSuggestions, activateFoods, remainingG, remainingPackets, openingGramsForPackets, setRemainingPackets, foodSupply, foodCoverage } from './lib/dogFood.js';

const box = { border:'1px solid var(--line, #aaa)', borderRadius:10, padding:12, marginBottom:12, minWidth:0 };
const input = { width:'100%', minWidth:0, boxSizing:'border-box', padding:8, margin:'4px 0 10px' };
const button = { padding:'9px 12px', margin:'4px 8px 4px 0', cursor:'pointer' };
function Field({label,children}) { return <label style={{display:'block',minWidth:0}}>{label}{children}</label>; }
export function Supply({data}) {
  const s=foodSupply(data);
  return <p>{s.days===null ? 'Review shared stock to calculate food remaining.' : `${s.incomplete ? 'At least' : 'Approximately'} ${s.days} days of food for ${data.dogs.length} dogs.${s.incomplete ? ' Estimate incomplete: set missing servings.' : ''}`}</p>;
}
function PacketCount({data,food,onChange}) {
  const count=remainingPackets(data,food.id)??0;
  const displayed=String(Math.round(count*100)/100);
  const [value,setValue]=useState(displayed);
  useEffect(()=>setValue(displayed),[displayed]);
  const commit=(nextValue)=>{
    const next=Number(nextValue);
    if(!Number.isFinite(next)||next<0){setValue(displayed);return;}
    onChange(setRemainingPackets(data,food.id,next));
  };
  const adjust=(change)=>{
    const typed=Number(value);
    const start=Number.isFinite(typed)&&typed>=0?typed:count;
    const next=Math.max(0,Math.round((start+change)*100)/100);
    setValue(String(next));
    commit(next);
  };
  return <div style={{display:'flex',alignItems:'center',gap:8,margin:'12px 0'}}>
    <button type="button" aria-label={`Remove one packet of ${food.name}`} style={{...button,margin:0,fontSize:20,minWidth:44}} disabled={count<=0} onClick={()=>adjust(-1)}>−</button>
    <input aria-label={`${food.name} packet count`} type="number" min="0" step="0.25" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} onBlur={e=>commit(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} style={{...input,width:86,textAlign:'center',margin:0}}/>
    <button type="button" aria-label={`Add one packet of ${food.name}`} style={{...button,margin:0,fontSize:20,minWidth:44}} onClick={()=>adjust(1)}>＋</button>
    <span>packets</span>
  </div>;
}
function FoodForm({data,food,onSave,onCancel}) {
  const [draft,setDraft]=useState(food||{id:crypto.randomUUID(),name:'',type:'Raw',packSizeG:1000,servings:{}});
  const [same,setSame]=useState(!food || new Set(Object.values(food.servings||{})).size<=1);
  const [quantity,setQuantity]=useState(food?(remainingPackets(data,food.id)??0):0);
  const [error,setError]=useState('');
  return <form style={box} onSubmit={e=>{e.preventDefault();try {
    const factor=Number(draft.packSizeG);
    if (!(factor>0) || !Number.isFinite(factor)) throw Error('Set a packet size first.');
    if(data.foods.some(f=>f.id!==draft.id && f.name.trim().toLowerCase()===draft.name.trim().toLowerCase())) throw Error('That food already exists; edit its stock instead.');
    const used=food?Number(food.stockG)-remainingG(data,food.id):0;
    onSave({...draft,name:draft.name.trim(),stockG:openingGramsForPackets(quantity,factor,used)});
  }catch(err){setError(err.message);}}}>
    <Field label="Food name"><input required style={input} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field>
    <Field label="Food type"><select style={input} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}>{['Raw','Cooked','Gently cooked','Kibble'].map(t=><option key={t}>{t}</option>)}</select></Field>
    <Field label="Weight per packet / roll (g)"><input type="number" required min="1" style={input} value={draft.packSizeG} onChange={e=>setDraft({...draft,packSizeG:e.target.value})}/></Field>
    <label><input type="checkbox" checked={same} onChange={e=>{setSame(e.target.checked);if(e.target.checked)setDraft({...draft,servings:Object.fromEntries(data.dogs.map(d=>[d.id,draft.servings[data.dogs[0]?.id]||'']))});}}/> Same daily amount for both dogs</label>
    {(same?data.dogs.slice(0,1):data.dogs).map(d=><Field key={d.id} label={same?'Daily serving per dog (g)':`${d.name} daily serving (g)`}><input type="number" min="0" style={input} value={draft.servings[d.id]??''} onChange={e=>setDraft({...draft,servings:same?Object.fromEntries(data.dogs.map(d=>[d.id,e.target.value])):{...draft.servings,[d.id]:e.target.value}})}/></Field>)}
    <Field label="Packets currently in the freezer"><input required type="number" min="0" step="0.25" style={input} value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>
    {error&&<p role="alert">{error}</p>}<button style={button}>Save food</button><button type="button" style={button} onClick={onCancel}>Cancel</button>
  </form>;
}
export function SharedDogFoods({data,onChange}) {
  const [draft,setDraft]=useState(null);
  const [suggestions,setSuggestions]=useState(()=>migrationSuggestions(data));
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  if(data.foodVersion!==2) return <section style={box}><strong>Review shared freezer stock</strong>
    <p>These amounts came from the old per-dog settings. If two rows count the same supply, remove one and enter the actual shared total. Keep both only for separate supplies. Original settings are backed up.</p>
    {suggestions.map(f=><div key={f.id} style={box}><Field label="Food"><input style={input} value={f.name} onChange={e=>setSuggestions(suggestions.map(x=>x.id===f.id?{...x,name:e.target.value}:x))}/></Field><Field label="Weight per packet / roll (g)"><input type="number" min="1" style={input} value={f.packSizeG} onChange={e=>setSuggestions(suggestions.map(x=>x.id===f.id?{...x,packSizeG:Number(e.target.value)}:x))}/></Field><Field label="Packets currently in the freezer"><input type="number" min="0" step="0.25" style={input} value={f.stockG/f.packSizeG} onChange={e=>setSuggestions(suggestions.map(x=>x.id===f.id?{...x,stockG:Number(e.target.value)*x.packSizeG}:x))}/></Field><button style={button} onClick={()=>setSuggestions(suggestions.filter(x=>x.id!==f.id))}>Remove this duplicate / start at zero</button></div>)}
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I checked that shared stock is counted once.</label>
    {error&&<p role="alert">{error}</p>}<button style={button} disabled={!confirmed} onClick={()=>{try{onChange(activateFoods(data,suggestions));}catch(e){setError(e.message);}}}>Use shared stock</button>
  </section>;
  return <section><button style={button} onClick={()=>setDraft({})}>＋ Add food</button><Supply data={data}/>
    {draft&&<FoodForm key={draft.id||'new'} data={data} food={draft.id?draft:null} onCancel={()=>setDraft(null)} onSave={f=>{onChange({...data,foods:[...data.foods.filter(x=>x.id!==f.id),f]});setDraft(null);}}/>}
    {data.foods.map(f=><div key={f.id} style={box}><strong>{f.name}</strong><div>{foodCoverage(data,f)===null?'Set daily servings to calculate coverage':`About ${foodCoverage(data,f).toFixed(1)} days left`}</div><PacketCount data={data} food={f} onChange={onChange}/><button style={button} onClick={()=>setDraft(f)}>Edit food details</button></div>)}
  </section>;
}
