import bcrypt from 'bcrypt';
import { db } from '../database/db.js';

export async function ensureMasterAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name && !email && !password) return;
  if (!name || !email || !password || !/^\S+@\S+\.\S+$/.test(email) || password.length < 24) {
    throw new Error('Configure ADMIN_NAME, ADMIN_EMAIL válido e ADMIN_PASSWORD com pelo menos 24 caracteres no backend/.env.');
  }
  const hash = await bcrypt.hash(password, 12);
  db.prepare(`INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')
    ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash,role='admin'`)
    .run(name, email, hash);
  console.log(`Conta master administrativa preparada: ${email}`);
}
