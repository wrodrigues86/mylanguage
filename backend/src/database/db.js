import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(here, '../../data/mylingua.db');
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), preferred_language TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT 'owl', avatar_data TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS languages (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT DEFAULT '', level TEXT NOT NULL DEFAULT 'Iniciante', is_native INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS learnings (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, title TEXT NOT NULL, translation TEXT NOT NULL DEFAULT '', pronunciation TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', example TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'Palavra', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS learning_tags (learning_id INTEGER NOT NULL REFERENCES learnings(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(learning_id,tag_id));
CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS collection_learnings (collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE, learning_id INTEGER NOT NULL REFERENCES learnings(id) ON DELETE CASCADE, PRIMARY KEY(collection_id,learning_id));
CREATE TABLE IF NOT EXISTS flashcards (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, learning_id INTEGER REFERENCES learnings(id) ON DELETE SET NULL, language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL, front TEXT NOT NULL, front_pronunciation TEXT NOT NULL DEFAULT '', back TEXT NOT NULL, interval INTEGER NOT NULL DEFAULT 0, repetitions INTEGER NOT NULL DEFAULT 0, ease REAL NOT NULL DEFAULT 2.5, due_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS review_history (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, flashcard_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE, quality INTEGER NOT NULL, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, interval INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS study_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, reviewed_count INTEGER NOT NULL DEFAULT 0, studied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS admin_audit_log (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', image_data TEXT NOT NULL DEFAULT '', alt_text TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS assistant_config (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT 'Lia', model TEXT NOT NULL DEFAULT 'gpt-4o-mini', instructions TEXT NOT NULL DEFAULT 'Voce e uma assistente de idiomas da MyLingua. Ajude com traducao, gramatica, pronuncia, exemplos e pratica. Responda de forma clara, encorajadora e no idioma do usuario.', welcome_message TEXT NOT NULL DEFAULT 'Ola! Posso ajudar com vocabulario, gramatica ou pratica de conversacao.', temperature REAL NOT NULL DEFAULT 0.7, max_output_tokens INTEGER NOT NULL DEFAULT 500, api_key_ciphertext TEXT NOT NULL DEFAULT '', active_start TEXT, active_end TEXT, timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo');
CREATE INDEX IF NOT EXISTS idx_learnings_user ON learnings(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON review_history(user_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, id);
`);

const userColumns = db.pragma('table_info(users)');
const announcementColumns = db.pragma('table_info(announcements)');
if (!announcementColumns.some(column => column.name === 'image_data')) db.exec("ALTER TABLE announcements ADD COLUMN image_data TEXT NOT NULL DEFAULT ''");
if (!announcementColumns.some(column => column.name === 'alt_text')) db.exec("ALTER TABLE announcements ADD COLUMN alt_text TEXT NOT NULL DEFAULT ''");
if (!userColumns.some(column => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin'))");
}
if (!userColumns.some(column => column.name === 'active')) {
  db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))');
}
if (!userColumns.some(column => column.name === 'preferred_language')) {
  db.exec("ALTER TABLE users ADD COLUMN preferred_language TEXT NOT NULL DEFAULT ''");
}
if (!userColumns.some(column => column.name === 'avatar')) {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'owl'");
}
if (!userColumns.some(column => column.name === 'avatar_data')) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_data TEXT NOT NULL DEFAULT ''");
}
db.exec('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
db.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES(?,?)').run('registration_open','true');
db.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES(?,?)').run('study_audio_enabled','true');
for (const [key, value] of [['maintenance_mode','false'],['session_duration_days','7'],['min_password_length','10'],['daily_review_limit','0']]) {
  db.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES(?,?)').run(key, value);
}
const exampleBannerSeeded = db.prepare('SELECT value FROM app_settings WHERE key=?').get('example_banner_seeded')?.value === 'true';
const exampleBannerPath = path.resolve(here, '../../assets/banner-exemplo.jpg');
if (!exampleBannerSeeded && fs.existsSync(exampleBannerPath)) {
  const imageData = `data:image/jpeg;base64,${fs.readFileSync(exampleBannerPath).toString('base64')}`;
  db.prepare("INSERT INTO announcements(title,message,image_data,alt_text,active) VALUES('','',?,?,1)")
    .run(imageData, 'Ilustração de um globo, um livro aberto e balões de conversa em tons de verde e creme.');
  db.prepare('INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)').run('example_banner_seeded', 'true');
}
db.prepare('INSERT OR IGNORE INTO assistant_config(id) VALUES(1)').run();
const assistantColumns = db.pragma('table_info(assistant_config)');
if (!assistantColumns.some(column => column.name === 'active_start')) db.exec('ALTER TABLE assistant_config ADD COLUMN active_start TEXT');
if (!assistantColumns.some(column => column.name === 'active_end')) db.exec('ALTER TABLE assistant_config ADD COLUMN active_end TEXT');
if (!assistantColumns.some(column => column.name === 'timezone')) db.exec("ALTER TABLE assistant_config ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'");
const flashcardColumns = db.pragma('table_info(flashcards)');
if (!flashcardColumns.some(column => column.name === 'language_id')) db.exec('ALTER TABLE flashcards ADD COLUMN language_id INTEGER REFERENCES languages(id) ON DELETE SET NULL');
if (!flashcardColumns.some(column => column.name === 'front_pronunciation')) db.exec("ALTER TABLE flashcards ADD COLUMN front_pronunciation TEXT NOT NULL DEFAULT ''");
db.exec('CREATE INDEX IF NOT EXISTS idx_flashcards_language ON flashcards(user_id,language_id)');
