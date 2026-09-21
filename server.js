import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import crypto from 'crypto';

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
