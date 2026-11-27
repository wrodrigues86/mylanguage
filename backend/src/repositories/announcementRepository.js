import { db } from '../database/db.js';

const publicFields = 'id,image_data,alt_text';
const adminFields = 'id,image_data,alt_text,active,created_at,updated_at';

export const announcementRepository = {
  listActive() {
    return db.prepare(`SELECT ${publicFields} FROM announcements WHERE active=1 AND image_data<>'' ORDER BY id LIMIT 4`).all();
  },
  listAll() {
    return db.prepare(`SELECT ${adminFields} FROM announcements WHERE image_data<>'' ORDER BY id DESC`).all();
  },
  get(id) {
    return db.prepare(`SELECT ${adminFields} FROM announcements WHERE id=?`).get(id);
  },
  count() {
    return db.prepare("SELECT COUNT(*) AS count FROM announcements WHERE image_data<>''").get().count;
  },
  create({ imageData, altText, active }) {
    const result = db.prepare("INSERT INTO announcements(title,message,image_data,alt_text,active) VALUES('','',?,?,?)").run(imageData, altText, active ? 1 : 0);
    return this.get(Number(result.lastInsertRowid));
  },
  update(id, { imageData, altText, active }) {
    const result = db.prepare('UPDATE announcements SET image_data=?,alt_text=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(imageData, altText, active ? 1 : 0, id);
    return result.changes ? this.get(id) : null;
  },
  delete(id) {
    return db.prepare('DELETE FROM announcements WHERE id=?').run(id).changes > 0;
  },
};
