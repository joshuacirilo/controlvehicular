import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';

const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  const stubs = {
    'server-only': 'export {};',
    'next/server': 'export function after(fn){globalThis.work.push(fn);}',
    'next/headers': 'export async function cookies(){return {get:()=>({value:globalThis.token})};}',
    '@/server/db/mongo': 'export async function getDb(){return globalThis.db;} export function getMongoClient(){return globalThis.mongo;}',
  };
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });
const { advanceMotion } = await import('../server/notifications/incident-rules.ts');
const { evaluateTripIncidents, createSos, dispatchIncident } = await import('../server/notifications/incidents.ts');
const { requestPasswordReset, completePasswordReset } = await import('../server/auth/password-reset.ts');
const { verifyPassword } = await import('../server/auth/password.ts');
const { hashPassword } = await import('../server/auth/password.ts');
const { updateProfile } = await import('../server/accounts/profile.ts');
const { changeProfileEmail } = await import('../server/accounts/profile-email.ts');
const profileEmailRoute = await import('../app/api/profile/email/route.ts');
const profileRoute = await import('../app/api/profile/route.ts');
const { getAdmin } = await import('../server/auth/admin.ts');
const { signToken } = await import('../server/auth/token.ts');
const forgot = await import('../app/api/auth/password/forgot/route.ts');
const sos = await import('../app/api/trips/[id]/sos/route.ts');
const feed = await import('../app/api/notifications/incidents/route.ts');
const { appUrl } = await import('../server/notifications/emailjs.ts');

// In-memory Mongo boundary with atomic synchronous updates and serialized transactions.
const clone = value => value instanceof ObjectId ? new ObjectId(value) : value instanceof Date ? new Date(value) : Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,clone(v)])) : value;
const field = (row, path) => path.split('.').reduce((v,k) => v?.[k], row);
const equal = (a,b) => a instanceof ObjectId ? a.equals(b) : a instanceof Date ? +a === +b : a === b;
const matches = (row, filter) => Object.entries(filter).every(([k,v]) => {
  if (k === '$or') return v.some(f => matches(row,f));
  const a = field(row,k);
  if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ObjectId)) return Object.entries(v).every(([op,b]) =>
    op === '$gt' ? a > b : op === '$gte' ? a >= b : op === '$lt' ? a < b : op === '$lte' ? a <= b : op === '$ne' ? !equal(a,b) : op === '$exists' ? (a !== undefined) === b : op === '$in' ? b.some(x => equal(a,x)) : false);
  return equal(a,v);
});
function set(row,path,value,remove=false) { const parts = path.split('.'); for (const p of parts.slice(0,-1)) row = row[p] ??= {}; if (remove) delete row[parts.at(-1)]; else row[parts.at(-1)] = clone(value); }
function expr(value,row) {
  if (typeof value === 'string' && value.startsWith('$')) return field(row,value.slice(1));
  if (value?.$cond) return expr(value.$cond[expr(value.$cond[0],row) ? 1 : 2],row);
  if (value?.$eq) return equal(expr(value.$eq[0],row),expr(value.$eq[1],row));
  if (value?.$add) return value.$add.reduce((n,v) => n + expr(v,row),0);
  return value;
}
function update(row,change) {
  if (Array.isArray(change)) { for (const stage of change) { const old = clone(row); for (const [k,v] of Object.entries(stage.$set)) set(row,k,expr(v,old)); } return; }
  for (const [k,v] of Object.entries(change.$set ?? {})) set(row,k,v);
  for (const [k,v] of Object.entries(change.$inc ?? {})) set(row,k,(field(row,k) ?? 0)+v);
  for (const k of Object.keys(change.$unset ?? {})) set(row,k,null,true);
}
let tables, sent, failProvider;
const originalFetch = globalThis.fetch;
const originalWarn = console.warn, originalInfo = console.info;
const userId = new ObjectId(), driverId = new ObjectId(), truckId = new ObjectId(), tripId = new ObjectId();
const driver = { sub: userId.toHexString(), driverId: driverId.toHexString(), role: 'conductor', name: 'Piloto', ver: 0 };
const point = (seconds, longitude=0) => ({ coords: { coordinates: [longitude,0] }, timestamp: new Date(Date.UTC(2026,0,1)+seconds*1000), precision: 2, qualityFlags: [] });
const ordered = (rows, sort={}) => [...rows].sort((a,b) => { for (const [k,d] of Object.entries(sort)) { const x=field(a,k),y=field(b,k); if (x<y || x===undefined && y!==undefined) return -d; if(x>y || y===undefined && x!==undefined) return d; } return 0; });
beforeEach(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString('hex');
  process.env.NEXT_PUBLIC_APP_URL = 'https://fleet.example.invalid';
  for (const name of ['SERVICE_ID','PUBLIC_KEY','PRIVATE_KEY','NOTIFICATION_TEMPLATE_ID','EMERGENCY_TEMPLATE_ID']) process.env[`EMAILJS_${name}`] = `fake-${name}`;
  tables = { users: [{ _id:userId,email:'pilot@example.invalid',rol:'conductor',activo:true,sessionVersion:0 }], drivers:[{_id:driverId,userId,activo:true,nombre:'Piloto'}], trucks:[{_id:truckId,placa:'TEST123'}],
    trips:[{_id:tripId,driverId,truckId,estado:'activo',inicio:new Date()}], notificationSettings:[{_id:'email',email:'admin@example.invalid',enabled:true,verifiedAt:new Date(),revision:'revision'}],
    speedControls:[{_id:'actual',velocidadPromedio:60,fechaModificacion:new Date()}] };
  sent=[]; failProvider=false; globalThis.work=[]; globalThis.token=undefined;
  console.info=console.warn=()=>{};
  globalThis.db = { collection(name) {
    const rows = tables[name] ??= [];
    return {
      async findOne(filter,options={}) { return clone(ordered(rows.filter(r=>matches(r,filter)),options.sort)[0] ?? null); },
      find(filter) { let selected=rows.filter(r=>matches(r,filter)); const cursor={sort(sort){selected=ordered(selected,sort);return cursor;},limit(n){selected=selected.slice(0,n);return cursor;},async toArray(){return clone(selected);}};return cursor; },
      async insertOne(row) { if(rows.some(r=>equal(r._id,row._id))) throw Object.assign(new Error('duplicate'),{code:11000}); rows.push(clone(row)); },
      async updateOne(filter,change,options={}) { let row=rows.find(r=>matches(r,filter)); if(!row && options.upsert) {row=clone({...filter,...change.$setOnInsert});rows.push(row);} if(!row)return {matchedCount:0};update(row,change);return {matchedCount:1}; },
      async findOneAndUpdate(filter,change,options={}) { const row=ordered(rows.filter(r=>matches(r,filter)),options.sort)[0];if(!row)return null;update(row,change);return clone(row); },
    };
  } };
  let tail=Promise.resolve();
  globalThis.mongo={startSession(){return {withTransaction(fn){const result=tail.then(fn);tail=result.catch(()=>{});return result;},async endSession(){}};}};
  globalThis.fetch=async (_url,options)=>{sent.push(JSON.parse(options.body)); if(failProvider)throw new Error('private-provider-error');return new Response('OK');};
});
afterEach(()=>{globalThis.fetch=originalFetch;console.info=originalInfo;console.warn=originalWarn;});

test('30 consecutive minutes below 5; no duplicate until movement, gap or bad GPS resets continuity',()=>{
  const state={}; let events=[];
  for(let s=0;s<=2100;s+=5)events.push(...advanceMotion(state,point(s),60));
  assert.equal(events.length,1);assert.equal(events[0].type,'low-speed');assert.equal(+events[0].at,+point(1800).timestamp);
  advanceMotion(state,point(2140),60);assert.equal(state.lowSince,undefined);
  advanceMotion(state,{...point(2145),qualityFlags:['mocked']},60);assert.equal(state.lowSince,undefined);
  advanceMotion(state,point(2150),60);assert.equal(state.lowSince,undefined);
  for(let s=2155;s<3950;s+=5)assert.equal(advanceMotion(state,point(s),60).length,0);
  assert.equal(advanceMotion(state,point(3950),60).length,1);
});

test('speed episodes deduplicate, equality resets, impossible speed and stale pairs do not alert',()=>{
  const state={};advanceMotion(state,point(0),60);
  assert.equal(advanceMotion(state,point(5,.001),60)[0].type,'speed');
  assert.equal(advanceMotion(state,point(10,.002),60).length,0);
  advanceMotion(state,point(15,.002),60);
  assert.equal(advanceMotion(state,point(20,.003),60).length,1);
  assert.equal(advanceMotion(state,point(25,1),60).length,0);
  assert.equal(advanceMotion(state,point(20,.003),60).length,0);
  assert.equal(advanceMotion(state,point(70,1.001),60).length,0);
});

test('GPS integration persists one event across repeated and concurrent evaluation',async()=>{
  const end=Date.now()-6*3600000-1000;
  tables.locationPings=[{...point(0),timestamp:new Date(end-5000),tripId},{...point(5,.001),timestamp:new Date(end),tripId}];
  await Promise.all([evaluateTripIncidents(tripId),evaluateTripIncidents(tripId)]);
  assert.equal(tables.notificationIncidents.length,1);
  await dispatchIncident();assert.equal(sent.length,1);assert.equal(sent[0].template_id,'fake-NOTIFICATION_TEMPLATE_ID');
  assert.equal(sent[0].template_params.to_email,'admin@example.invalid');
  assert.equal(sent[0].template_params.action_url,`https://fleet.example.invalid/camiones?viaje=${tripId}`);
  await dispatchIncident();assert.equal(sent.length,1);
});

test('SOS rejects other trips, deduplicates retries and outranks routine quota; durable on provider failure',async()=>{
  await assert.rejects(createSos({...driver,driverId:new ObjectId().toHexString()},tripId),e=>e.status===404);
  const [a,b]=await Promise.all([createSos(driver,tripId),createSos(driver,tripId)]);assert.equal(a.incidentId,b.incidentId);
  tables.notificationIncidents.push({...clone(tables.notificationIncidents[0]),_id:'routine',type:'speed',priority:0});
  tables.notificationSendLimits=[{_id:'emailjs',nextAt:new Date(Date.now()+60000),day:new Date().toISOString().slice(0,10),count:20}];
  failProvider=true;await dispatchIncident();assert.equal(sent[0].template_id,'fake-EMERGENCY_TEMPLATE_ID');
  assert.equal(tables.notificationIncidents[0].mail,'unconfirmed');
  assert.equal(tables.notificationIncidents.length,2);
  await dispatchIncident();assert.equal(sent.length,1);
});

test('disabled mail still records SOS; enabling uses the latest verified administrator recipient',async()=>{
  tables.notificationSettings[0].enabled=false;await createSos(driver,tripId);await dispatchIncident();assert.equal(sent.length,0);
  tables.notificationSettings[0].enabled=true;tables.notificationSettings[0].email='new@example.invalid';
  tables.notificationIncidents[0].nextAttempt=new Date(0);await dispatchIncident();
  assert.equal(sent[0].template_params.to_email,'new@example.invalid');
});

test('password reset uses account email, a private single-use 15-minute token and revokes sessions',async()=>{
  tables.notificationSettings[0].enabled=false;
  await requestPasswordReset('pilot@example.invalid');assert.equal(sent.length,1);
  const payload=sent[0];assert.equal(payload.template_id,'fake-NOTIFICATION_TEMPLATE_ID');assert.equal(payload.template_params.to_email,'pilot@example.invalid');
  const url=new URL(payload.template_params.action_url), token=new URLSearchParams(url.hash.slice(1)).get('token');
  assert.equal(url.origin,'https://fleet.example.invalid');assert.equal(token.length,43);assert.equal(JSON.stringify(tables.users).includes(token),false);
  assert.ok(tables.users[0].passwordReset.expiresAt-Date.now()<=15*60000);
  const attempts=await Promise.allSettled([completePasswordReset({token,password:'new-secure-password'}),completePasswordReset({token,password:'other-secure-password'})]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(tables.users[0].sessionVersion,1);assert.equal(tables.users[0].passwordReset,undefined);
  assert.ok(await verifyPassword('new-secure-password',tables.users[0].passwordHash)||await verifyPassword('other-secure-password',tables.users[0].passwordHash));
  await assert.rejects(completePasswordReset({token,password:'new-secure-password'}),e=>e.status===400);
});

test('expired or malformed reset links cannot change passwords; arbitrary URL input is rejected',async()=>{
  await requestPasswordReset('pilot@example.invalid');const token=new URLSearchParams(new URL(sent[0].template_params.action_url).hash.slice(1)).get('token');
  tables.users[0].passwordReset.expiresAt=new Date(0);
  await assert.rejects(completePasswordReset({token,password:'secure-password-value'}),e=>e.status===400);
  await assert.rejects(completePasswordReset({token,password:'secure-password-value',action_url:'https://evil.invalid'}),e=>e.status===400);
  assert.equal(tables.users[0].passwordHash,undefined);
  assert.throws(()=>appUrl('//evil.invalid'),e=>e.status===400);
});

test('public recovery does not reveal existing accounts; admin feed and SOS enforce roles',async()=>{
  const req=email=>new Request('https://fleet.example.invalid/api/auth/password/forgot',{method:'POST',headers:{'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify({email})});
  const a=await forgot.POST(req('pilot@example.invalid')),b=await forgot.POST(req('absent@example.invalid'));assert.deepEqual(await a.json(),await b.json());
  assert.equal(sent.length,0); // work runs after response
  assert.equal((await feed.GET(new Request('https://fleet.example.invalid/api/notifications/incidents'))).status,401);
  assert.equal((await sos.POST(new Request('https://fleet.example.invalid/api/trips/x/sos',{method:'POST'}),{params:Promise.resolve({id:tripId.toHexString()})})).status,401);
  const bearer=signToken(driver);
  const response=await sos.POST(new Request(`https://fleet.example.invalid/api/trips/${tripId}/sos`,{method:'POST',headers:{authorization:`Bearer ${bearer}`}}),{params:Promise.resolve({id:tripId.toHexString()})});
  assert.equal(response.status,200);assert.equal((await response.json()).recorded,true);
  tables.users[0].rol='administrador';globalThis.token=signToken({sub:userId.toHexString(),role:'administrador',exp:Math.floor(Date.now()/1000)+60,ver:0});
  assert.ok(await getAdmin());tables.users[0].sessionVersion=1;assert.equal(await getAdmin(),null);
});

async function profileAccount() {
  Object.assign(tables.users[0], { rol: 'administrador', username: 'admin', nombre: 'Administrador', passwordHash: await hashPassword('current-password-123') });
  return { id: userId.toHexString(), username: 'admin', nombre: 'Administrador', email: tables.users[0].email };
}
test('profile changes only authenticated account, normalizes usernames and rejects duplicates',async()=>{
  const admin=await profileAccount();
  tables.users.push({_id:new ObjectId(),username:'occupied',rol:'conductor',activo:true});
  const input={action:'profile',nombre:' Nuevo Nombre ',username:'New.Admin',currentPassword:'current-password-123'};
  assert.equal((await updateProfile(admin,{...input,username:'OCCUPIED'})).status,409);
  assert.equal((await updateProfile(admin,{...input,id:new ObjectId().toHexString()})).status,400);
  const result=await updateProfile(admin,input);assert.equal(result.status,200);
  assert.equal(result.body.user.username,'new.admin');assert.equal(result.body.user.nombre,'Nuevo Nombre');
  assert.equal(tables.users[0].email,admin.email);assert.equal(tables.users[1].username,'occupied');
  assert.equal(JSON.stringify(result).includes('passwordHash'),false);
});
test('concurrent profile renames cannot claim the same username',async()=>{
  const admin=await profileAccount(), otherId=new ObjectId();
  tables.users.push({...clone(tables.users[0]),_id:otherId,username:'other',email:'other@example.invalid'});
  const input={action:'profile',nombre:'Nombre',username:'shared',currentPassword:'current-password-123'};
  const results=await Promise.all([updateProfile(admin,input),updateProfile({...admin,id:otherId.toHexString()},input)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(tables.users.filter(u=>u.username==='shared').length,1);
});
test('profile password checks lock repeated guesses and password changes revoke old sessions and reset tokens',async()=>{
  const admin=await profileAccount();
  const input={action:'password',currentPassword:'current-password-123',newPassword:'new-password-123456'};
  assert.equal((await updateProfile(admin,{...input,newPassword:'short'})).status,400);
  for(let n=0;n<5;n++)assert.equal((await updateProfile(admin,{...input,currentPassword:'wrong'})).status,400);
  assert.equal((await updateProfile(admin,input)).status,429);
  tables.users[0].lockedUntil=new Date(0);tables.users[0].passwordReset={hash:'old',expiresAt:new Date(Date.now()+60000)};
  assert.equal((await updateProfile(admin,input)).status,200);
  assert.equal(tables.users[0].sessionVersion,1);assert.equal(tables.users[0].passwordReset,undefined);
  assert.ok(await verifyPassword(input.newPassword,tables.users[0].passwordHash));
  assert.equal(await verifyPassword(input.currentPassword,tables.users[0].passwordHash),false);
});
test('profile endpoint rejects anonymous, conductor and cross-origin writes',async()=>{
  const req=site=>new Request('https://fleet.example.invalid/api/profile',{method:'PUT',headers:{'content-type':'application/json','sec-fetch-site':site},body:'{}'});
  assert.equal((await profileRoute.PUT(req('same-origin'))).status,401);
  globalThis.token=signToken({sub:userId.toHexString(),role:'conductor'});
  assert.equal((await profileRoute.PUT(req('same-origin'))).status,401);
  await profileAccount();globalThis.token=signToken({sub:userId.toHexString(),role:'administrador',exp:Math.floor(Date.now()/1000)+60,ver:0});
  assert.equal((await profileRoute.PUT(req('cross-site'))).status,403);
  assert.equal((await profileRoute.PUT(req('same-origin'))).status,400);
});

test('profile email stays unchanged until verification; code is private and single use',async()=>{
  const admin=await profileAccount();
  tables.users[0].passwordReset={hash:'old-reset'};
  const result=await changeProfileEmail(admin,{action:'request',email:'new@example.invalid',currentPassword:'current-password-123'});
  assert.equal(result.verified,false);assert.equal(tables.users[0].email,admin.email);
  assert.equal(sent[0].template_id,'fake-NOTIFICATION_TEMPLATE_ID');assert.equal(sent[0].template_params.to_email,'new@example.invalid');
  const code=sent[0].template_params.message.match(/\b\d{6}\b/)[0];
  assert.equal(JSON.stringify(result).includes(code),false);assert.equal(tables.users[0].pendingEmail.code,undefined);
  assert.equal((await changeProfileEmail(admin,{action:'verify',code})).verified,true);
  assert.equal(tables.users[0].email,'new@example.invalid');assert.equal(tables.users[0].passwordReset,undefined);
  await assert.rejects(changeProfileEmail(admin,{action:'verify',code}),e=>e.status===400);
});
test('profile email rejects duplicates, invalid input, expired codes and password changes',async()=>{
  const admin=await profileAccount();
  const request={action:'request',email:'new@example.invalid',currentPassword:'current-password-123'};
  tables.users.push({_id:new ObjectId(),email:'taken@example.invalid'});
  await assert.rejects(changeProfileEmail(admin,{...request,email:'taken@example.invalid'}),e=>e.status===409);
  await assert.rejects(changeProfileEmail(admin,{...request,email:'not-an-email'}),e=>e.status===400);
  await assert.rejects(changeProfileEmail(admin,{...request,currentPassword:'wrong'}),e=>e.status===400);
  await changeProfileEmail(admin,request);
  const code=sent[0].template_params.message.match(/\b\d{6}\b/)[0];
  const expiry=tables.users[0].pendingEmail.expiresAt;
  tables.users[0].pendingEmail.expiresAt=new Date(0);
  await assert.rejects(changeProfileEmail(admin,{action:'verify',code}),e=>e.status===400);
  tables.users[0].pendingEmail.expiresAt=expiry;tables.users[0].passwordHash='changed';
  await assert.rejects(changeProfileEmail(admin,{action:'verify',code}),e=>e.status===409);
  assert.equal(tables.users[0].email,admin.email);
});
test('profile email caps guesses, preserves old email on provider failure and requires admin',async()=>{
  const admin=await profileAccount();
  failProvider=true;
  await assert.rejects(changeProfileEmail(admin,{action:'request',email:'new@example.invalid',currentPassword:'current-password-123'}),e=>e.status===502);
  assert.equal(tables.users[0].email,admin.email);
  const code=sent[0].template_params.message.match(/\b\d{6}\b/)[0], wrong=code==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)await assert.rejects(changeProfileEmail(admin,{action:'verify',code:wrong}),e=>e.status===400);
  await assert.rejects(changeProfileEmail(admin,{action:'verify',code}),e=>e.status===400);
  const req=site=>new Request('https://fleet.example.invalid/api/profile/email',{method:'POST',headers:{'content-type':'application/json','sec-fetch-site':site},body:'{}'});
  assert.equal((await profileEmailRoute.POST(req('same-origin'))).status,401);
  assert.equal((await profileEmailRoute.POST(req('cross-site'))).status,403);
});
