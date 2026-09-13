import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateDogFood, migrationSuggestions, activateFoods, remainingG, remainingPackets, openingGramsForPackets, feedDogs, undoFeed, foodSupply, validateDogFood, localFoodDate } from './dogFood.js';
import { mergeChanges, undoChange } from './changes.js';
const date='2026-09-10';
const base=()=>({foodVersion:2,dogs:[{id:'a',name:'A'},{id:'b',name:'B'}],foods:[{id:'f',name:'Food',stockG:1000,servings:{a:250,b:250}}],feedingHistory:[]});
const selection={a:{foodId:'f',amountG:250},b:{foodId:'f',amountG:250}};
test('coverage uses both dogs and flags incomplete estimates',()=>{
 const data=base();assert.deepEqual(foodSupply(data),{days:2,incomplete:false});
 data.foods.push({id:'g',name:'Other',stockG:300,servings:{a:100,b:100}});
 assert.equal(foodSupply(data).days,3);
 data.foods.push({id:'h',name:'Unknown',stockG:200,servings:{}});
 assert.deepEqual(foodSupply(data),{days:3,incomplete:true});
});
test('daily records reject double taps, zero amounts and insufficient stock',()=>{
 const first=feedDogs(base(),selection,date);assert.equal(remainingG(first,'f'),500);
 assert.throws(()=>feedDogs(first,selection,date),/already recorded/);
 assert.throws(()=>feedDogs({...base(),foods:[{...base().foods[0],stockG:100}]},selection,date),/Not enough/);
 assert.throws(()=>feedDogs(base(),{...selection,a:{foodId:'f',amountG:0}},date),/positive/);
});
test('editing and Undo reverse original allocation once and preserve subsequent feeding',()=>{
 const first=feedDogs(base(),selection,date);
 const edited=feedDogs(first,{a:{foodId:'f',amountG:100},b:{foodId:'f',amountG:100}},date,true);
 assert.equal(remainingG(edited,'f'),800);
 const next=feedDogs(edited,selection,'2026-09-11');const undone=undoFeed(next,date);
 assert.equal(remainingG(undone,'f'),500);assert.deepEqual(undoFeed(undone,date),undone);
 assert.equal(remainingG(undoChange({before:base(),after:first},first),'f'),1000);
});
test('simultaneous same-day records merge to one deduction',()=>{
 const data=base();const a=feedDogs(data,selection,date),b=feedDogs(data,selection,date);
 const merged=mergeChanges(data,a,b);validateDogFood(merged);
 assert.equal(merged.feedingHistory.length,1);assert.equal(remainingG(merged,'f'),500);
});
test('independent dates merge both deductions and merged overdraw is rejected',()=>{
 const data=base();const merged=mergeChanges(data,feedDogs(data,selection,date),feedDogs(data,selection,'2026-09-11'));
 validateDogFood(merged);assert.equal(remainingG(merged,'f'),0);
 assert.throws(()=>validateDogFood({...merged,foods:[{...merged.foods[0],stockG:600}]}),/Not enough/);
});
test('migration requires review, preserves originals and counts shared supply once',()=>{
 const legacy={dogs:[{id:'a',name:'A',brand:'5 Hounds',packSizeG:500,packsOnHand:4,packsPerDay:1},{id:'b',name:'B',brand:'5 Hounds',packSizeG:500,packsOnHand:4,packsPerDay:1}],extras:[]};
 const pending=migrateDogFood(legacy);assert.equal(pending.foodMigrationPending,true);
 assert.equal(pending.foodVersion,undefined);assert.equal(foodSupply(pending).days,null);
 assert.throws(()=>feedDogs(pending,selection,date),/Review/);
 const reviewed=activateFoods(pending,migrationSuggestions(pending).slice(0,1));
 assert.equal(foodSupply(reviewed).days,2);assert.deepEqual(reviewed.dogs,legacy.dogs);
 assert.deepEqual(reviewed.legacyFoodBackup.dogs,legacy.dogs);assert.deepEqual(migrateDogFood(reviewed),reviewed);
});
test('individual foods and amounts retain historical names',()=>{
 const data=base();data.foods.push({id:'g',name:'Homemade',stockG:900,servings:{a:300,b:300}});
 const result=feedDogs(data,{a:selection.a,b:{foodId:'g',amountG:300}},date);
 result.foods[1].name='Renamed';result.dogs[1].name='New name';
 assert.equal(result.feedingHistory[0].entries[1].foodName,'Homemade');
 assert.equal(result.feedingHistory[0].entries[1].dogName,'B');assert.equal(remainingG(result,'g'),600);
});
test('feeding uses local dates',()=>assert.equal(localFoodDate(new Date(2026,8,13,0,5)),'2026-09-13'));
test('placeholder dog names migrate to Eg and Ernest without changing custom names',()=>{
 const result=migrateDogFood({foodVersion:2,dogs:[{id:'a',name:'Dog 1'},{id:'b',name:'Dog 2'},{id:'c',name:'Custom'}],foods:[],feedingHistory:[]});
 assert.deepEqual(result.dogs.map(d=>d.name),['Eg','Ernest','Custom']);
});
test('freezer stock is counted in packets while feeding retains partial packets',()=>{
 const data=base();data.foods[0].packSizeG=500;
 assert.equal(remainingPackets(data,'f'),2);
 const fed=feedDogs(data,selection,date);
 assert.equal(remainingPackets(fed,'f'),1);
 assert.equal(openingGramsForPackets(3.5,500,250),2000);
 assert.throws(()=>openingGramsForPackets(-1,500,0),/valid packet count/);
});
