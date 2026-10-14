// Burst de requisições simultâneas (login, availability, appointments, dashboard).
// Uso: node conc.mjs  (API em localhost:3000, massa criada por bench.mjs)
const B='http://localhost:3000';
const post=(p,b,t)=>fetch(B+p,{method:'POST',headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},body:JSON.stringify(b)});
const get=(p,t)=>fetch(B+p,{headers:{authorization:'Bearer '+t}});
async function burst(label,n,fn){const t=[];await Promise.all(Array.from({length:n},async(_,i)=>{const s=performance.now();const r=await fn(i);await r.text();t.push(performance.now()-s);}));t.sort((a,b)=>a-b);console.log(`${label.padEnd(40)} n=${n} p50=${t[Math.floor(n/2)].toFixed(0)}ms max=${t.at(-1).toFixed(0)}ms`);}
const cli=(await (await post('/v1/auth/login',{email:'cli0@bench.com',password:'benchpass123',tenantSlug:'bench-0'})).json()).accessToken;
const sa=(await (await post('/v1/auth/login',{email:'sa@bench.com',password:'benchpass123'})).json()).accessToken;
const [svc]=(await (await get('/v1/services',cli)).json()).items;
const profs=(await (await get('/v1/professionals',cli)).json()).items;
const d=new Date(Date.now()+10*864e5).toISOString().slice(0,10);
for (const n of [5,10,20]) await burst(`POST /auth/login concorrente`,n,()=>post('/v1/auth/login',{email:'cli0@bench.com',password:'benchpass123',tenantSlug:'bench-0'}));
for (const n of [10,20,50]) await burst(`GET availability concorrente`,n,(i)=>get(`/v1/professionals/${profs[i%profs.length].id}/availability?serviceId=${svc.id}&date=${d}`,cli));
for (const n of [10,20,50]) await burst(`GET /appointments concorrente`,n,()=>get('/v1/appointments',cli));
for (const n of [3]) await burst(`GET admin/dashboard/overview concorrente`,n,()=>get('/v1/admin/dashboard/overview',sa));
