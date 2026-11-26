import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database/db.js';
import { auth, requireLearner } from './middleware/auth.js';
import adminRoutes from './routes/adminRoutes.js';
import { ensureMasterAdmin } from './services/adminBootstrapService.js';
import { settingsRepository } from './repositories/settingsRepository.js';
import { assistantController } from './controllers/assistantController.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) throw new Error('Configure JWT_SECRET com pelo menos 24 caracteres.');
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
const fail = (res, message, status = 400) => res.status(status).json({ error: message });
const owned = (table, id, userId) => db.prepare(`SELECT id FROM ${table} WHERE id=? AND user_id=?`).get(id, userId);

app.get('/api/health', (_req,res) => res.json({ status: 'ok' }));
app.get('/api/settings/public', (_req,res) => res.json(settingsRepository.publicSettings()));
app.post('/api/auth/register', async (req,res) => {
  if (settingsRepository.publicSettings().maintenanceMode) return res.status(503).json({ error: 'A aplicação está em manutenção. Tente novamente mais tarde.' });
  if (!settingsRepository.publicSettings().registrationOpen) return res.status(403).json({ error: 'Novos cadastros estão temporariamente desativados.' });
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < settingsRepository.publicSettings().minPasswordLength) return fail(res, 'Senha abaixo do minimo configurado.');
  try { const hash = await bcrypt.hash(password, 12); const result = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim(), email.trim().toLowerCase(), hash); res.status(201).json(issue(result.lastInsertRowid, name.trim(), 'user')); }
  catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return fail(res, 'Este e-mail já está cadastrado.', 409); throw error; }
});
app.post('/api/auth/login', async (req,res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return fail(res, 'Informe e-mail e senha.');
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase());
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) return fail(res, 'E-mail ou senha incorretos.', 401);
  res.json(issue(user.id, user.name, user.role));
});
function issue(id, name, role) { const days = settingsRepository.publicSettings().sessionDurationDays; return { token: jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: `${days}d` }), user: { id, name, role } }; }

app.use('/api/admin', adminRoutes);
app.use('/api', auth);
app.use('/api', (req, res, next) => { if (req.user.role === 'user' && settingsRepository.publicSettings().maintenanceMode && !['GET','HEAD','OPTIONS'].includes(req.method)) return res.status(503).json({ error: 'Read-only maintenance mode.' }); next(); });
app.get('/api/me', (req,res) => res.json({ id:req.user.id, name:req.user.name, email:req.user.email, role:req.user.role, created_at:req.user.created_at }));
app.delete('/api/me', async (req,res) => {
  if (req.user.role === 'admin') return fail(res, 'Contas administrativas não podem ser excluídas pelo perfil.');
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) return fail(res, 'Informe sua senha para confirmar o cancelamento.');
  const account = db.prepare('SELECT password_hash FROM users WHERE id=? AND active=1').get(req.user.id);
  if (!account || !(await bcrypt.compare(password, account.password_hash))) return fail(res, 'Senha incorreta.', 401);
  db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
  return res.status(204).end();
});
app.use('/api', requireLearner);
app.get('/api/assistant/config', assistantController.publicConfig);
app.post('/api/assistant/chat', assistantController.chat);
app.post('/api/assistant/cards', assistantController.generateCards);
app.get('/api/study/progress',(req,res)=>{const dailyLimit=settingsRepository.publicSettings().dailyReviewLimit;const todayReviewed=db.prepare("SELECT COUNT(*) AS count FROM review_history WHERE user_id=? AND reviewed_at>=date('now')").get(req.user.id).count;res.json({dailyLimit,todayReviewed,remaining:dailyLimit===0?null:Math.max(0,dailyLimit-todayReviewed)});});
app.post('/api/flashcards/:id/review',(req,res,next)=>{const dailyLimit=settingsRepository.publicSettings().dailyReviewLimit;if(dailyLimit>0&&db.prepare("SELECT COUNT(*) AS count FROM review_history WHERE user_id=? AND reviewed_at>=date('now')").get(req.user.id).count>=dailyLimit)return res.status(429).json({error:'Daily review limit reached.'});next();});
app.get('/api/languages', (req,res) => res.json(db.prepare('SELECT * FROM languages WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
app.post('/api/languages', (req,res) => { const {name,code='',level='Iniciante',is_native=false}=req.body||{}; if(typeof name!=='string'||!name.trim()) return fail(res,'Informe o idioma.'); const r=db.prepare('INSERT INTO languages(user_id,name,code,level,is_native) VALUES(?,?,?,?,?)').run(req.user.id,name.trim(),String(code).slice(0,12),String(level).slice(0,40),is_native?1:0); res.status(201).json(db.prepare('SELECT * FROM languages WHERE id=?').get(r.lastInsertRowid)); });
app.patch('/api/languages/:id', (req,res) => { const id=Number(req.params.id); if(!owned('languages',id,req.user.id))return fail(res,'Idioma não encontrado.',404); const {name,level,is_native}=req.body||{}; if(typeof name!=='string'||!name.trim())return fail(res,'Informe o idioma.'); db.prepare('UPDATE languages SET name=?,level=?,is_native=? WHERE id=? AND user_id=?').run(name.trim(),String(level||'Iniciante'),is_native?1:0,id,req.user.id); res.json({ok:true}); });
app.delete('/api/languages/:id',(req,res)=>{const r=db.prepare('DELETE FROM languages WHERE id=? AND user_id=?').run(Number(req.params.id),req.user.id); if(!r.changes)return fail(res,'Idioma não encontrado.',404); res.status(204).end();});
app.get('/api/learnings',(req,res)=>{const q=String(req.query.q||'').slice(0,100); res.json(db.prepare(`SELECT l.*,g.name AS language_name FROM learnings l LEFT JOIN languages g ON g.id=l.language_id WHERE l.user_id=? AND (l.title LIKE ? OR l.translation LIKE ?) ORDER BY l.created_at DESC`).all(req.user.id,`%${q}%`,`%${q}%`));});
app.post('/api/learnings',(req,res)=>{const {title,translation='',pronunciation='',description='',example='',kind='Palavra',language_id=null}=req.body||{}; if(typeof title!=='string'||!title.trim())return fail(res,'Informe a palavra ou expressão.'); if(language_id&&!owned('languages',Number(language_id),req.user.id))return fail(res,'Idioma inválido.'); const r=db.prepare('INSERT INTO learnings(user_id,language_id,title,translation,pronunciation,description,example,kind) VALUES(?,?,?,?,?,?,?,?)').run(req.user.id,language_id||null,title.trim(),String(translation).slice(0,500),String(pronunciation).slice(0,300),String(description).slice(0,2000),String(example).slice(0,2000),String(kind).slice(0,40)); res.status(201).json(db.prepare('SELECT * FROM learnings WHERE id=?').get(r.lastInsertRowid));});
app.delete('/api/learnings/:id',(req,res)=>{const r=db.prepare('DELETE FROM learnings WHERE id=? AND user_id=?').run(Number(req.params.id),req.user.id); if(!r.changes)return fail(res,'Aprendizado não encontrado.',404);res.status(204).end();});
app.get('/api/collections',(req,res)=>res.json(db.prepare('SELECT c.*,COUNT(cl.learning_id) AS item_count FROM collections c LEFT JOIN collection_learnings cl ON cl.collection_id=c.id WHERE c.user_id=? GROUP BY c.id ORDER BY c.created_at DESC').all(req.user.id)));
app.post('/api/collections',(req,res)=>{const {name,description=''}=req.body||{};if(typeof name!=='string'||!name.trim())return fail(res,'Informe o nome da coleção.'); const r=db.prepare('INSERT INTO collections(user_id,name,description) VALUES(?,?,?)').run(req.user.id,name.trim(),String(description).slice(0,500));res.status(201).json(db.prepare('SELECT * FROM collections WHERE id=?').get(r.lastInsertRowid));});
app.post('/api/collections/:id/items',(req,res)=>{const c=owned('collections',Number(req.params.id),req.user.id), l=owned('learnings',Number(req.body?.learning_id),req.user.id);if(!c||!l)return fail(res,'Coleção ou aprendizado inválido.',404);db.prepare('INSERT OR IGNORE INTO collection_learnings VALUES(?,?)').run(c.id,l.id);res.status(204).end();});
app.get('/api/flashcards',(req,res)=>res.json(db.prepare('SELECT f.id,f.user_id,f.learning_id,COALESCE(f.language_id,l.language_id) AS language_id,f.front,f.back,f.interval,f.repetitions,f.ease,f.due_at,f.created_at,l.title AS learning_title,l.example AS learning_example,g.name AS language_name,g.code AS language_code FROM flashcards f LEFT JOIN learnings l ON l.id=f.learning_id LEFT JOIN languages g ON g.id=COALESCE(f.language_id,l.language_id) WHERE f.user_id=? ORDER BY f.due_at').all(req.user.id)));
app.post('/api/flashcards',(req,res)=>{const {front,back,learning_id=null,language_id=null}=req.body||{};if(typeof front!=='string'||!front.trim()||front.length>500||typeof back!=='string'||!back.trim()||back.length>2000)return fail(res,'Preencha frente e verso com no maximo 500 e 2000 caracteres.');const languageId=language_id===null?null:Number(language_id);if(languageId!==null&&(!Number.isSafeInteger(languageId)||!owned('languages',languageId,req.user.id)))return fail(res,'Idioma invalido.',404);if(learning_id&&!owned('learnings',Number(learning_id),req.user.id))return fail(res,'Aprendizado invalido.',404);if(languageId&&learning_id){const linked=db.prepare('SELECT language_id FROM learnings WHERE id=? AND user_id=?').get(Number(learning_id),req.user.id)?.language_id;if(linked&&linked!==languageId)return fail(res,'O idioma do card deve corresponder ao aprendizado.');}const r=db.prepare('INSERT INTO flashcards(user_id,learning_id,language_id,front,back) VALUES(?,?,?,?,?)').run(req.user.id,learning_id||null,languageId,front.trim(),back.trim());res.status(201).json(db.prepare('SELECT * FROM flashcards WHERE id=?').get(r.lastInsertRowid));});
app.post('/api/flashcards/bulk',(req,res)=>{const {language_id,cards}=req.body||{};const languageId=Number(language_id);if(!Number.isSafeInteger(languageId)||!owned('languages',languageId,req.user.id))return fail(res,'Idioma invalido.',404);if(!Array.isArray(cards)||cards.length<1||cards.length>10)return fail(res,'Selecione de 1 a 10 cards.');for(const card of cards){if(!card||typeof card.front!=='string'||!card.front.trim()||card.front.length>500||typeof card.back!=='string'||!card.back.trim()||card.back.length>2000)return fail(res,'Um card esta invalido ou excede o limite de texto.');}const ids=[];const save=db.transaction(()=>{const insert=db.prepare('INSERT INTO flashcards(user_id,language_id,front,back) VALUES(?,?,?,?)');for(const card of cards)ids.push(insert.run(req.user.id,languageId,card.front.trim(),card.back.trim()).lastInsertRowid);});save();const created=ids.map(id=>db.prepare('SELECT * FROM flashcards WHERE id=?').get(id));res.status(201).json({created:created.length,cards:created});});
app.post('/api/flashcards/:id/review',(req,res)=>{const id=Number(req.params.id), card=db.prepare('SELECT * FROM flashcards WHERE id=? AND user_id=?').get(id,req.user.id);const quality=Number(req.body?.quality);if(!card)return fail(res,'Cartão não encontrado.',404);if(!Number.isInteger(quality)||quality<0||quality>5)return fail(res,'Avaliação inválida.');let reps=card.repetitions, interval=card.interval, ease=card.ease;if(quality<3){reps=0;interval=1;}else{if(reps===0)interval=1;else if(reps===1)interval=6;else interval=Math.round(interval*ease);reps++;ease=Math.max(1.3,ease+(0.1-(5-quality)*(0.08+(5-quality)*0.02)));}const due=new Date(Date.now()+interval*86400000).toISOString();const tx=db.transaction(()=>{db.prepare('UPDATE flashcards SET repetitions=?,interval=?,ease=?,due_at=? WHERE id=? AND user_id=?').run(reps,interval,ease,due,id,req.user.id);db.prepare('INSERT INTO review_history(user_id,flashcard_id,quality,interval) VALUES(?,?,?,?)').run(req.user.id,id,quality,interval);db.prepare('INSERT INTO study_sessions(user_id,reviewed_count) VALUES(?,1)').run(req.user.id);});tx();res.json({interval,due_at:due});});
app.get('/api/dashboard',(req,res)=>{const id=req.user.id;const languages=db.prepare('SELECT COUNT(*) n FROM languages WHERE user_id=?').get(id).n;const learnings=db.prepare('SELECT COUNT(*) n FROM learnings WHERE user_id=?').get(id).n;const cards=db.prepare('SELECT COUNT(*) n FROM flashcards WHERE user_id=?').get(id).n;const due=db.prepare("SELECT COUNT(*) n FROM flashcards WHERE user_id=? AND date(due_at)<=date('now')").get(id).n;const reviewed=db.prepare('SELECT COUNT(*) n FROM review_history WHERE user_id=?').get(id).n;const correct=db.prepare('SELECT COUNT(*) n FROM review_history WHERE user_id=? AND quality>=3').get(id).n;const sessions=db.prepare('SELECT COUNT(DISTINCT date(studied_at)) n FROM study_sessions WHERE user_id=?').get(id).n;const activity=db.prepare('SELECT l.title,l.created_at,g.name language_name FROM learnings l LEFT JOIN languages g ON g.id=l.language_id WHERE l.user_id=? ORDER BY l.created_at DESC LIMIT 5').all(id);res.json({languages,learnings,cards,due,reviewed,accuracy:reviewed?Math.round(correct/reviewed*100):0,studyDays:sessions,activity});});
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req,res,next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Erro interno. Tente novamente.'});});
await ensureMasterAdmin();
const port=Number(process.env.PORT)||3001;app.listen(port,()=>console.log(`MyLingua API disponível em http://localhost:${port}`));
