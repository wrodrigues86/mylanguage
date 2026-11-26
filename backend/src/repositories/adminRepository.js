import { db } from '../database/db.js';

export const adminRepository = {
  overview() {
    return {
      users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      admins: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count,
      languages: db.prepare('SELECT COUNT(*) AS count FROM languages').get().count,
      learnings: db.prepare('SELECT COUNT(*) AS count FROM learnings').get().count,
      flashcards: db.prepare('SELECT COUNT(*) AS count FROM flashcards').get().count,
    };
  },
  listUsers(search = '') {
    const term = `%${search}%`;
    return db.prepare(`SELECT id,name,email,role,active,created_at FROM users
      WHERE name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200`).all(term, term);
  },
  getUser(id) { return db.prepare('SELECT id,email,role,active FROM users WHERE id=?').get(id); },
  setUserActive(id, active) { return db.prepare('UPDATE users SET active=? WHERE id=?').run(active ? 1 : 0, id); },
};
