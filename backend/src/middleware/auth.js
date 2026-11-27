import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';
export function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id,name,email,role,active,preferred_language,avatar_data,created_at FROM users WHERE id=?').get(claims.id);
    if (!user) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    if (!user.active) return res.status(401).json({ error: 'Esta conta está desativada.' });
    req.user = user;
    next();
  }
  catch { return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' }); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  next();
}

export function requireLearner(req, res, next) {
  if (req.user?.role !== 'user') return res.status(403).json({ error: 'Administradores gerenciam a aplicação e não acessam as áreas de estudo.' });
  next();
}
