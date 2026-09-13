import React, { useState } from 'react';
import { localFoodDate, migrationSuggestions, activateFoods, remainingG, feedDogs, undoFeed, foodSupply, foodCoverage } from './lib/dogFood.js';

const box = { border:'1px solid var(--line, #aaa)', borderRadius:10, padding:12, marginBottom:12, minWidth:0 };
const input = { width:'100%', minWidth:0, boxSizing:'border-box', padding:8, margin:'4px 0 10px' };
const button = { padding:'9px 12px', margin:'4px 8px 4px 0', cursor:'pointer' };
function Field({label,children}) { return <label style={{display:'block',minWidth:0}}>{label}{children}</label>; }
export function Supply({data}) {
  const s=foodSupply(data);
  return <p>{s.days===null ? 'Review shared stock to calculate food remaining.' : `${s.incomplete ? 'At least' : 'Approximately'} ${s.days} days of food for ${data.dogs.length} dogs.${s.incomplete ? ' Estimate incomplete: set missing servings.' : ''}`}</p>;
}
function FeedingEditor({data,date,onChange,onClose}) {
  const existing=data.feedingHistory?.find(r=>r.date===date);
  const [individual,setIndividual]=useState(!!existing);
  const [foodId,setFoodId]=useState('');
  const [choices,setChoices]=useState(Object.fromEntries((existing?.entries||[]).map(e=>[e.dogId,{foodId:e.foodId,amountG:e.amountG}])));
  const [error,setError]=useState('');
  const foods=data.foods.filter(f=>remainingG(data,f.id)>0 || existing?.entries.some(e=>e.foodId===f.id));
  const choose=(id)=> { setFoodId(id); const f=data.foods.find(f=>f.id===id); setChoices(Object.fromEntries(data.dogs.map(d=>[d.id,{foodId:id,amountG:f?.servings?.[d.id]||''}]))); };
  return <form onSubmit={e=>{e.preventDefault();try {onChange(feedDogs(data,choices,date,!!existing));onClose?.();setError('');}catch(err){setError(err.message);}}}>
    <p>{existing ? 'Edit daily feeding' : 'Record daily feeding'} · {date}</p>
    {!individual && <Field label="Food for both dogs"><select required style={input} value={foodId} onChange={e=>choose(e.target.value)}><option value="">Choose food</option>{foods.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>}
    <label><input type="checkbox" checked={individual} onChange={e=>setIndividual(e.target.checked)}/> Edit individually</label>
    {data.dogs.map(d=><div key={d.id} style={{marginTop:8}}><strong>{d.name}</strong>
      {individual && <select required aria-label={`${d.name} food`} style={input} value={choices[d.id]?.foodId||''} onChange={e=>{const f=data.foods.find(f=>f.id===e.target.value);setChoices({...choices,[d.id]:{foodId:f.id,amountG:f.servings?.[d.id]||''}});}}><option value="">Choose food</option>{foods.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}
      <Field label="Daily amount (g)"><input required type="number" min="1" step="any" style={input} value={choices[d.id]?.amountG??''} onChange={e=>setChoices({...choices,[d.id]:{...choices[d.id],amountG:e.target.value}})}/></Field>
    </div>)}
    {error && <p role="alert">{error}</p>}
    <button style={button} type="submit">{existing ? 'Save changes' : individual ? '✓ Record individual feeds' : '✓ Fed both'}</button>{onClose && <button type="button" style={button} onClick={onClose}>Cancel</button>}
  </form>;
}
export function DogFoodToday({data,onChange}) {
  const [editing,setEditing]=useState(false);
  const date=localFoodDate();
  const record=data.feedingHistory?.find(r=>r.date===date);
  if(data.foodVersion!==2) return null;
  return <section style={box}><strong>Dogs’ food today</strong>
    {record && !editing ? <><p>Recorded today</p>{record.entries.map(e=><p key={e.dogId}>{e.dogName} · {e.foodName} · {e.amountG}g</p>)}<button style={button} onClick={()=>setEditing(true)}>Edit</button><button style={button} onClick={()=>onChange(undoFeed(data,date))}>Undo feeding</button></> : <FeedingEditor key={date+String(!!record)} data={data} date={date} onChange={onChange} onClose={editing?()=>setEditing(false):undefined}/>}
  </section>;
}
function FoodForm({data,food,onSave,onCancel}) {
  const [draft,setDraft]=useState(food||{id:crypto.randomUUID(),name:'',type:'Raw',packSizeG:1000,servings:{}});
  const [same,setSame]=useState(!food || new Set(Object.values(food.servings||{})).size<=1);
  const [quantity,setQuantity]=useState(food?remainingG(data,food.id):0);
  const [unit,setUnit]=useState('grams');
  const [error,setError]=useState('');
  return <form style={box} onSubmit={e=>{e.preventDefault();try {
    const factor=unit==='grams'?1:unit==='packs'?Number(draft.packSizeG):Number(draft.servings[data.dogs[0]?.id]);
    if (!(factor>0) || !Number.isFinite(factor)) throw Error('Set a pack size or daily portion first.');
    if(data.foods.some(f=>f.id!==draft.id && f.name.trim().toLowerCase()===draft.name.trim().toLowerCase())) throw Error('That food already exists; edit its stock instead.');
    const used=food?Number(food.stockG)-remainingG(data,food.id):0;
    onSave({...draft,name:draft.name.trim(),stockG:Number(quantity)*factor+used});
  }catch(err){setError(err.message);}}}>
    <Field label="Food name"><input required style={input} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field>
    <Field label="Food type"><select style={input} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}>{['Raw','Cooked','Gently cooked','Kibble'].map(t=><option key={t}>{t}</option>)}</select></Field>
    <Field label="Pack / roll size (g)"><input type="number" required min="1" style={input} value={draft.packSizeG} onChange={e=>setDraft({...draft,packSizeG:e.target.value})}/></Field>
    <label><input type="checkbox" checked={same} onChange={e=>{setSame(e.target.checked);if(e.target.checked)setDraft({...draft,servings:Object.fromEntries(data.dogs.map(d=>[d.id,draft.servings[data.dogs[0]?.id]||'']))});}}/> Same daily amount for both dogs</label>
    {(same?data.dogs.slice(0,1):data.dogs).map(d=><Field key={d.id} label={same?'Daily serving per dog (g)':`${d.name} daily serving (g)`}><input type="number" min="0" style={input} value={draft.servings[d.id]??''} onChange={e=>setDraft({...draft,servings:same?Object.fromEntries(data.dogs.map(d=>[d.id,e.target.value])):{...draft.servings,[d.id]:e.target.value}})}/></Field>)}
    <Field label="Current stock"><input required type="number" min="0" step="any" style={input} value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>
    <select aria-label="Stock unit" style={input} value={unit} onChange={e=>{setUnit(e.target.value);setQuantity(0);}}><option value="grams">Grams</option><option value="packs">Packs / rolls</option>{same && <option value="portions">One-dog daily portions</option>}</select>
    {error&&<p role="alert">{error}</p>}<button style={button}>Save food</button><button type="button" style={button} onClick={onCancel}>Cancel</button>
  </form>;
}
export function SharedDogFoods({data,onChange}) {
  const [draft,setDraft]=useState(null);
  const [date,setDate]=useState(localFoodDate());
  const [recording,setRecording]=useState(false);
  const [suggestions,setSuggestions]=useState(()=>migrationSuggestions(data));
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  if(data.foodVersion!==2) return <section style={box}><strong>Review shared freezer stock</strong>
    <p>These amounts came from the old per-dog settings. If two rows count the same supply, remove one and enter the actual shared total. Keep both only for separate supplies. Original settings are backed up.</p>
    {suggestions.map(f=><div key={f.id} style={box}><Field label="Food"><input style={input} value={f.name} onChange={e=>setSuggestions(suggestions.map(x=>x.id===f.id?{...x,name:e.target.value}:x))}/></Field><Field label="Actual stock (g)"><input type="number" min="0" style={input} value={f.stockG} onChange={e=>setSuggestions(suggestions.map(x=>x.id===f.id?{...x,stockG:Number(e.target.value)}:x))}/></Field><button style={button} onClick={()=>setSuggestions(suggestions.filter(x=>x.id!==f.id))}>Remove this duplicate / start at zero</button></div>)}
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I checked that shared stock is counted once.</label>
    {error&&<p role="alert">{error}</p>}<button style={button} disabled={!confirmed} onClick={()=>{try{onChange(activateFoods(data,suggestions));}catch(e){setError(e.message);}}}>Use shared stock</button>
  </section>;
  return <section><button style={button} onClick={()=>setDraft({})}>＋ Add food</button><Supply data={data}/>
    {draft&&<FoodForm key={draft.id||'new'} data={data} food={draft.id?draft:null} onCancel={()=>setDraft(null)} onSave={f=>{onChange({...data,foods:[...data.foods.filter(x=>x.id!==f.id),f]});setDraft(null);}}/>}
    {data.foods.map(f=><details key={f.id} style={box}><summary>{f.name} · {remainingG(data,f.id)}g · {foodCoverage(data,f)===null?'Set servings':`~${foodCoverage(data,f).toFixed(1)} days`}</summary><button style={button} onClick={()=>setDraft(f)}>Edit food / update stock</button></details>)}
    <details style={box}><summary>Feeding history</summary><Field label="Record or edit a date"><input type="date" max={localFoodDate()} style={input} value={date} onChange={e=>{setDate(e.target.value);setRecording(false);}}/></Field><button style={button} disabled={!date} onClick={()=>setRecording(true)}>Record / edit feeding</button>
      {recording&&<FeedingEditor key={date} data={data} date={date} onChange={onChange} onClose={()=>setRecording(false)}/>}
      {[...(data.feedingHistory||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(r=><div style={box} key={r.id}><strong>{r.date}</strong>{r.entries.map(e=><p key={e.dogId}>{e.dogName} · {e.foodName} · {e.amountG}g</p>)}<button style={button} onClick={()=>{setDate(r.date);setRecording(true);}}>Edit</button><button style={button} onClick={()=>onChange(undoFeed(data,r.date))}>Undo feeding</button></div>)}
    </details>
  </section>;
}
