import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KODY, NAVRH } from './design.mjs';
const d = JSON.parse(readFileSync(fileURLToPath(new URL('../../../packages/core/data/cards.json', import.meta.url)),'utf8'));
const ID = {OBR:['Viera'],TUH:['Rana','Pecka','Petelica'],MAK:['Povera','Pohoršenie'],EKO:['Poldeci','Cigareta','Robota'],POD:['Vízia','Posilnenie','Pakt'],SAB:['Odpor','Obmedzenie']};
const idOf = a => Object.keys(ID).find(k=>ID[k].includes(a));
const fact = n => n<=1?1:n*fact(n-1);
function perm(free, acts){ const cnt={}; for(const a of acts) cnt[a]=(cnt[a]||0)+1; cnt._=free-acts.length; if(cnt._<0) return NaN; return fact(free)/Object.values(cnt).reduce((x,y)=>x*fact(y),1); }
const vz = new Set(['recidivista','kocovnik']);
function side(str, card, typ){ const [b,a]=str.split('|'); const blocked=b?b.split(',').map(Number):[]; const acts=a?a.split(' ').map(k=>{if(!KODY[k]) throw k; return KODY[k]}):[];
  let free=4-blocked.length, rest=[...acts];
  if(typ==='Obc' && rest.includes('Odpor')){ const pin=vz.has(card.id)?2:1; if(blocked.includes(pin)) console.log('PIN konflikt',card.id); else {free--; rest.splice(rest.indexOf('Odpor'),1);} }
  return {blocked, acts, var: perm(free, rest)}; }
const typOf=c=>c.tags.includes('Lokalita')?'Lok':c.tags.includes('Nástroj')?'Nas':c.tags.includes('Starešina')?'Star':c.tags.includes('Kliatba')?'Kl':c.tags.includes('Občan')?'Obc':'Zv';
const f={}, fo={}; const seen=new Set();
for (const [id,ids,L,R] of NAVRH){ const c=d.cards.find(x=>x.id===id); if(!c){console.log('NEZNÁMA',id);continue} seen.add(id); const t=typOf(c);
  const l=side(L,c,t), r=side(R,c,t); const all=[...l.acts,...r.acts];
  for(const a of all) f[a]=(f[a]||0)+1;
  const real=[...new Set(all.map(idOf).filter(Boolean))]; const dek=ids.split(' ');
  if(real.length>2) console.log('>2 identity',id,real); 
  if(real.some(x=>!dek.includes(x))||dek.some(x=>!real.includes(x))) console.log('nesedí identita',id,dek,real);
  const odp=all.filter(a=>a==='Odpor').length; if(odp>1 && t!=='Nas' && id!=='praudovravec') console.log('Odpor>1',id);
  if(t==='Nas' && all.length!==4 && !['energetak','zrkadlo'].includes(id)) console.log('Nástroj akcie',id,all.length);
  const v=t==='Star'?1:l.var*r.var; const ok={Obc:[4,8],Nas:[2,4],Zv:[2,4],Star:[1,1]}[t];
  if(ok && (v<ok[0]||v>ok[1])) console.log('varianty',id,t,v, l.var, r.var);
}
for(const c of d.cards){ if(!seen.has(c.id) && typOf(c)!=='Kl') console.log('CHÝBA',c.id); for(const s of [c.left,c.right]) for(const [k,v] of Object.entries(s.actions)) fo[k]=(fo[k]||0)+v; }
const keys=Object.keys(fo).sort((a,b)=>(f[b]||0)-(f[a]||0));
let ts=0,to=0; for(const k of keys){ console.log(k.padEnd(18), String(fo[k]).padStart(3),'→',String(f[k]||0).padStart(3)); ts+=f[k]||0; to+=fo[k]; } console.log('spolu',to,'→',ts);
