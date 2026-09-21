import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import crypto from 'crypto';

import fs from 'fs';
const ADMIN_HTML = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Shivam AI Admin</title><style>\nbody{font-family:Arial;margin:0;background:#f5f7fb;color:#172033}button,input,textarea{font:inherit}button{cursor:pointer}.login{min-height:100vh;display:grid;place-items:center}.box{background:#fff;padding:25px;border-radius:16px;width:min(400px,90%);box-shadow:0 10px 35px #0001}.field{margin:12px 0}.field label{display:block;font-size:13px;font-weight:bold;margin-bottom:5px}.field input,.field textarea{width:100%;padding:10px;border:1px solid #ccd3df;border-radius:9px}.btn{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:10px 14px;font-weight:bold}.btn.gray{background:#e5e7eb;color:#111827}.btn.red{background:#dc2626}.app{display:none}.side{position:fixed;top:0;bottom:0;width:220px;background:#111827;color:#fff;padding:20px}.side button{display:block;width:100%;border:0;background:transparent;color:#cbd5e1;text-align:left;padding:12px;border-radius:8px;margin:4px 0}.side button:hover{background:#1f2937;color:#fff}.main{margin-left:220px;padding:24px}.top{display:flex;justify-content:space-between;align-items:center}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:17px;margin:10px 0}.client{display:flex;justify-content:space-between;gap:10px}.actions{display:flex;gap:5px;flex-wrap:wrap}.hidden{display:none}.modal{position:fixed;inset:0;background:#0008;display:none;place-items:center;padding:15px}.modal.show{display:grid}.modalbox{background:#fff;border-radius:16px;padding:20px;width:min(650px,100%);max-height:90vh;overflow:auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.full{grid-column:1/-1}.chat{max-width:760px}.chatbody{height:330px;overflow:auto;background:#fff;border:1px solid #ddd;padding:12px}.msg{padding:9px 12px;border-radius:12px;margin:7px 0;max-width:78%;background:#eef2ff}.me{margin-left:auto;background:#dbeafe}.chatrow{display:flex;gap:7px;margin-top:7px}.chatrow input{flex:1;padding:10px;border:1px solid #ccd3df;border-radius:9px}@media(max-width:700px){.side{width:60px;padding:10px}.side h2{font-size:0}.side h2:after{content:'SA';font-size:18px}.side button{font-size:0;text-align:center}.main{margin-left:60px;padding:14px}.cards{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.full{grid-column:auto}.client{display:block}.actions{margin-top:8px}}\n</style></head><body>\n<div id=\"login\" class=\"login\"><div class=\"box\"><h1>Shivam AI</h1><p>Admin Login</p><div class=\"field\"><label>Username</label><input id=\"u\" value=\"admin\"></div><div class=\"field\"><label>Password</label><input id=\"p\" type=\"password\"></div><div id=\"err\"></div><button class=\"btn\" style=\"width:100%\" onclick=\"login()\">Login</button></div></div>\n<div id=\"app\" class=\"app\"><aside class=\"side\"><h2>Shivam AI</h2><button onclick=\"show('dash')\">Dashboard</button><button onclick=\"show('clients')\">Clients</button><button onclick=\"show('leads')\">Leads</button><button onclick=\"show('chat')\">Chatbot</button><button onclick=\"logout()\">Logout</button></aside>\n<main class=\"main\"><section id=\"dash\"><div class=\"top\"><div><h1>Dashboard</h1><p>Real server-backed client management.</p></div><button class=\"btn\" onclick=\"openForm()\">+ Add Client</button></div><div class=\"cards\"><div class=\"card\"><small>Total Clients</small><h2 id=\"count\">0</h2></div><div class=\"card\"><small>Active Chatbots</small><h2 id=\"bots\">0</h2></div><div class=\"card\"><small>Leads</small><h2 id=\"leadCount\">0</h2></div></div></section>\n<section id=\"clients\" class=\"hidden\"><div class=\"top\"><h1>Clients</h1><button class=\"btn\" onclick=\"openForm()\">+ Add Client</button></div><div id=\"list\"></div></section>\n<section id=\"leads\" class=\"hidden\"><h1>Leads</h1><div id=\"leadList\"></div></section>\n<section id=\"chat\" class=\"hidden\"><h1>Chatbot Preview</h1><select id=\"sel\" onchange=\"loadChat()\" style=\"padding:10px;width:100%\"></select><div class=\"chat card\"><div id=\"chatbody\" class=\"chatbody\"></div><div class=\"chatrow\"><input id=\"msg\" placeholder=\"Ask about price, timing, trial...\" onkeydown=\"if(event.key==='Enter')send()\"><button class=\"btn\" onclick=\"send()\">Send</button></div></div></section>\n</main></div>\n<div id=\"modal\" class=\"modal\"><div class=\"modalbox\"><h2 id=\"title\">Add Client</h2><div class=\"grid\">\n<div class=\"field\"><label>Business Name *</label><input id=\"name\"></div><div class=\"field\"><label>Owner</label><input id=\"owner\"></div><div class=\"field\"><label>Phone</label><input id=\"phone\"></div><div class=\"field\"><label>Address</label><input id=\"address\"></div><div class=\"field\"><label>Hours</label><input id=\"hours\"></div><div class=\"field\"><label>Price</label><input id=\"price\"></div><div class=\"field full\"><label>Services</label><textarea id=\"services\"></textarea></div><div class=\"field full\"><label>FAQs / Business info</label><textarea id=\"faq\"></textarea></div></div><button class=\"btn gray\" onclick=\"closeForm()\">Cancel</button> <button class=\"btn\" onclick=\"save()\">Save</button></div></div>\n<script>\nlet clients=[],editId=null;\nconst $=id=>document.getElementById(id);\nasync function api(url,opt={}){let r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});let d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}\nasync function login(){try{await api('/api/login',{method:'POST',body:JSON.stringify({username:$('u').value,password:$('p').value})});init()}catch(e){$('err').textContent=e.message}}\nasync function init(){try{await api('/api/me');$('login').style.display='none';$('app').style.display='block';await load()}catch{}}\nasync function logout(){await api('/api/logout',{method:'POST'});location.reload()}\nfunction show(id){document.querySelectorAll('main section').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');if(id==='clients')load();if(id==='leads')loadLeads();if(id==='chat')loadChat()}\nasync function load(){clients=await api('/api/clients');$('count').textContent=clients.length;$('bots').textContent=clients.length;$('list').innerHTML=clients.length?clients.map(c=>`<div class=\"card client\"><div><b>${esc(c.name)}</b><p>${esc(c.phone||'')} \u2022 ${esc(c.address||'')}</p><small>Public link: /c/${esc(c.slug)}</small></div><div class=\"actions\"><button class=\"btn gray\" onclick=\"test('${c.id}')\">Test</button><button class=\"btn gray\" onclick='edit(${JSON.stringify(c)})'>Edit</button><button class=\"btn red\" onclick=\"del('${c.id}')\">Delete</button></div></div>`).join(''):'<div class=\"card\">No clients yet.</div>';$('sel').innerHTML=clients.map(c=>`<option value=\"${c.id}\">${esc(c.name)}</option>`).join('');await loadLeads()}\nasync function loadLeads(){let a=await api('/api/leads');$('leadCount').textContent=a.length;$('leadList').innerHTML=a.length?a.map(x=>`<div class=\"card\"><b>${esc(x.name)}</b> \u2014 ${esc(x.phone)}<br><small>${esc(x.client_name)} \u2022 ${new Date(x.created_at).toLocaleString()}</small></div>`).join(''):'<div class=\"card\">No leads yet.</div>'}\nfunction openForm(c=null){editId=c?.id||null;$('title').textContent=c?'Edit Client':'Add Client';['name','owner','phone','address','hours','price','services','faq'].forEach(k=>$(k).value=c?.[k]||'');$('modal').classList.add('show')}\nfunction edit(c){openForm(c)}function closeForm(){$('modal').classList.remove('show')}\nasync function save(){let d={name:$('name').value,owner:$('owner').value,phone:$('phone').value,address:$('address').value,hours:$('hours').value,price:$('price').value,services:$('services').value,faq:$('faq').value};try{await api(editId?'/api/clients/'+editId:'/api/clients',{method:editId?'PUT':'POST',body:JSON.stringify(d)});closeForm();await load()}catch(e){alert(e.message)}}\nasync function del(id){if(confirm('Delete this client and its leads?')){await api('/api/clients/'+id,{method:'DELETE'});load()}}\nfunction test(id){show('chat');$('sel').value=id;loadChat()}\nasync function loadChat(){let c=clients.find(x=>x.id==$('sel').value);$('chatbody').innerHTML=c?`<div class=\"msg\">Hello! I am ${esc(c.name)}'s assistant.</div>`:''}\nasync function send(){let c=clients.find(x=>x.id==$('sel').value),m=$('msg').value.trim();if(!c||!m)return;$('chatbody').innerHTML+=`<div class=\"msg me\">${esc(m)}</div>`;$('msg').value='';try{let r=await api('/api/public/'+c.slug+'/chat',{method:'POST',body:JSON.stringify({message:m})});$('chatbody').innerHTML+=`<div class=\"msg\">${esc(r.answer)}</div>`}catch(e){$('chatbody').innerHTML+=`<div class=\"msg\">${esc(e.message)}</div>`}}\nfunction esc(x){return String(x||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[m]))}\ninit();\n</script></body></html>";
const CHAT_HTML = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Business Chatbot</title><style>body{font-family:Arial;background:#f4f6fb;margin:0}.wrap{max-width:700px;margin:30px auto;padding:15px}.head{background:#111827;color:white;padding:18px;border-radius:15px 15px 0 0}.body{height:55vh;overflow:auto;background:white;padding:15px;border:1px solid #ddd}.m{padding:10px 13px;border-radius:12px;background:#eef2ff;max-width:78%;margin:8px 0}.me{margin-left:auto;background:#dbeafe}.row{display:flex;gap:7px;background:#fff;padding:10px;border:1px solid #ddd}.row input{flex:1;padding:11px;border:1px solid #ccd3df;border-radius:9px}.row button{background:#2563eb;color:white;border:0;border-radius:9px;padding:10px 15px;font-weight:bold}</style></head><body><div class=\"wrap\"><div class=\"head\"><b id=\"name\">Business Assistant</b><div id=\"sub\" style=\"opacity:.75;margin-top:4px\">Online</div></div><div id=\"body\" class=\"body\"></div><div class=\"row\"><input id=\"q\" placeholder=\"Ask your question...\" onkeydown=\"if(event.key==='Enter')send()\"><button onclick=\"send()\">Send</button></div></div><script>\nconst slug=location.pathname.split('/').pop();let business=null;const body=document.getElementById('body');function esc(x){return String(x||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#039;'}[m]))}\nasync function init(){let r=await fetch('/api/public/'+encodeURIComponent(slug));if(!r.ok){body.innerHTML='<div class=\"m\">Business not found.</div>';return}business=await r.json();name.textContent=business.name;sub.textContent=(business.hours||'Online')+' \u2022 '+(business.phone||'');body.innerHTML='<div class=\"m\">Namaste! \ud83d\udc4b Main '+esc(business.name)+' ka assistant hoon. Aap price, timing, services, location ya trial ke baare mein pooch sakte hain.</div>'}\nasync function send(){let q=document.getElementById('q'),m=q.value.trim();if(!m||!business)return;body.innerHTML+='<div class=\"m me\">'+esc(m)+'</div>';q.value='';let r=await fetch('/api/public/'+encodeURIComponent(slug)+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m})});let d=await r.json();body.innerHTML+='<div class=\"m\">'+esc(d.answer||d.error)+'</div>';body.scrollTop=body.scrollHeight}init();\n</script></body></html>";
fs.mkdirSync('public',{recursive:true});
if(!fs.existsSync('public/admin.html')) fs.writeFileSync('public/admin.html',ADMIN_HTML);
if(!fs.existsSync('public/chat.html')) fs.writeFileSync('public/chat.html',CHAT_HTML);


const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

const db = new Database('shivam_ai.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS clients(
 id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 owner TEXT, phone TEXT, address TEXT, hours TEXT, price TEXT,
 services TEXT, faq TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL, name TEXT NOT NULL,
 phone TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL,
 FOREIGN KEY(client_id) REFERENCES clients(id)
);
`);

app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(express.static('public'));

function signToken(){
  return jwt.sign({role:'admin',sub:ADMIN_USERNAME},JWT_SECRET,{expiresIn:'7d'});
}
function auth(req,res,next){
  try {
    const token=req.cookies.shivam_admin;
    if(!token) return res.status(401).json({error:'Login required'});
    req.user=jwt.verify(token,JWT_SECRET); next();
  } catch { return res.status(401).json({error:'Session expired'}); }
}
function clean(v,max=2000){return String(v??'').trim().slice(0,max)}
function slugify(v){
  const s=clean(v,100).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return s || 'client';
}
function uniqueSlug(name,id){
  let s=slugify(name), n=1;
  while(true){
    const row=db.prepare('SELECT id FROM clients WHERE slug=?').get(s);
    if(!row || row.id===id) return s;
    n++;
    s=`${slugify(name)}-${n}`;
  }
}
function clientPublic(c){
  return {id:c.id,slug:c.slug,name:c.name,owner:c.owner,phone:c.phone,address:c.address,hours:c.hours,price:c.price,services:c.services,faq:c.faq,created_at:c.created_at};
}

app.get('/api/health',(req,res)=>res.json({ok:true,ai:!!process.env.OPENAI_API_KEY}));

app.post('/api/login',(req,res)=>{
  const u=clean(req.body.username,100), p=String(req.body.password||'');
  if(u!==ADMIN_USERNAME || p!==ADMIN_PASSWORD) return res.status(401).json({error:'Invalid username or password'});
  res.cookie('shivam_admin',signToken(),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:7*24*60*60*1000});
  res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{res.clearCookie('shivam_admin');res.json({ok:true})});
app.get('/api/me',auth,(req,res)=>res.json({username:req.user.sub}));

app.get('/api/clients',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  res.json(rows.map(clientPublic));
});
app.post('/api/clients',auth,(req,res)=>{
  const name=clean(req.body.name,120); if(!name) return res.status(400).json({error:'Business name is required'});
  const id=crypto.randomUUID(), now=new Date().toISOString(), slug=uniqueSlug(name,id);
  db.prepare(`INSERT INTO clients(id,slug,name,owner,phone,address,hours,price,services,faq,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id,slug,name,clean(req.body.owner),clean(req.body.phone,40),clean(req.body.address),clean(req.body.hours),clean(req.body.price,500),clean(req.body.services),clean(req.body.faq),now);
  res.status(201).json(clientPublic(db.prepare('SELECT * FROM clients WHERE id=?').get(id)));
});
app.put('/api/clients/:id',auth,(req,res)=>{
  const old=db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if(!old) return res.status(404).json({error:'Client not found'});
  const name=clean(req.body.name,120)||old.name;
  const slug=uniqueSlug(name,old.id);
  db.prepare(`UPDATE clients SET slug=?,name=?,owner=?,phone=?,address=?,hours=?,price=?,services=?,faq=? WHERE id=?`)
    .run(slug,name,clean(req.body.owner),clean(req.body.phone,40),clean(req.body.address),clean(req.body.hours),clean(req.body.price,500),clean(req.body.services),clean(req.body.faq),old.id);
  res.json(clientPublic(db.prepare('SELECT * FROM clients WHERE id=?').get(old.id)));
});
app.delete('/api/clients/:id',auth,(req,res)=>{
  db.prepare('DELETE FROM leads WHERE client_id=?').run(req.params.id);
  const r=db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
  if(!r.changes) return res.status(404).json({error:'Client not found'});
  res.json({ok:true});
});
app.get('/api/leads',auth,(req,res)=>{
  res.json(db.prepare(`SELECT leads.*,clients.name client_name FROM leads JOIN clients ON clients.id=leads.client_id ORDER BY leads.created_at DESC`).all());
});
app.post('/api/leads',(req,res)=>{
  const c=db.prepare('SELECT id FROM clients WHERE slug=?').get(clean(req.body.slug,150));
  if(!c) return res.status(404).json({error:'Business not found'});
  const name=clean(req.body.name,120), phone=clean(req.body.phone,40);
  if(!name||!phone) return res.status(400).json({error:'Name and phone are required'});
  db.prepare('INSERT INTO leads(id,client_id,name,phone,note,created_at) VALUES(?,?,?,?,?,?)')
    .run(crypto.randomUUID(),c.id,name,phone,clean(req.body.note,500),new Date().toISOString());
  res.status(201).json({ok:true});
});

app.get('/api/public/:slug',(req,res)=>{
  const c=db.prepare('SELECT * FROM clients WHERE slug=?').get(req.params.slug);
  if(!c) return res.status(404).json({error:'Business not found'});
  res.json(clientPublic(c));
});

app.post('/api/public/:slug/chat',async(req,res)=>{
  const c=db.prepare('SELECT * FROM clients WHERE slug=?').get(req.params.slug);
  if(!c) return res.status(404).json({error:'Business not found'});
  const message=clean(req.body.message,1200);
  if(!message) return res.status(400).json({error:'Message required'});
  const fallback=`Business: ${c.name}
Hours: ${c.hours||'Not provided'}
Price: ${c.price||'Not provided'}
Services: ${c.services||'Not provided'}
Address: ${c.address||'Not provided'}
Phone: ${c.phone||'Not provided'}
FAQs: ${c.faq||'Not provided'}`;

  if(!process.env.OPENAI_API_KEY){
    const m=message.toLowerCase();
    let answer=c.faq||'Sorry, I do not have that information. Please contact the business directly.';
    if(/price|fee|membership|cost|paisa/.test(m)) answer=c.price||answer;
    else if(/time|timing|open|close|kab/.test(m)) answer=c.hours||answer;
    else if(/service|offer|kya karte/.test(m)) answer=c.services||answer;
    else if(/where|location|address|kaha/.test(m)) answer=c.address||answer;
    else if(/phone|call|contact|number/.test(m)) answer=c.phone||answer;
    else if(/trial|appointment|book/.test(m)) answer='Sure. Please share your name and phone number for a callback.';
    return res.json({answer,mode:'demo'});
  }
  try{
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const r=await client.responses.create({
      model:MODEL,
      instructions:`You are the customer-support assistant for ${c.name}. Answer only from the business information below. If the answer is not present, say you do not have that information and suggest contacting the business. Never invent prices, availability, medical advice, guarantees or policies.
${fallback}`,
      input:message,
      max_output_tokens:250
    });
    res.json({answer:r.output_text||'I do not have that information.',mode:'ai'});
  }catch(e){res.status(502).json({error:'AI service temporarily unavailable',details:'Check server API configuration.'})}
});

app.get('/admin',(req,res)=>res.sendFile(process.cwd()+'/public/admin.html'));
app.get('/c/:slug',(req,res)=>res.sendFile(process.cwd()+'/public/chat.html'));
app.listen(PORT,()=>console.log(`Shivam AI running on port ${PORT}`));
