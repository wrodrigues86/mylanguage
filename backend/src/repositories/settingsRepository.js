import { db } from '../database/db.js';

export const settingDefinitions = {
  registration_open: { type: 'boolean', fallback: true },
  study_audio_enabled: { type: 'boolean', fallback: true },
  maintenance_mode: { type: 'boolean', fallback: false },
  session_duration_days: { type: 'choice', values: [1, 7, 30], fallback: 7 },
  min_password_length: { type: 'choice', values: [10, 12, 14, 16], fallback: 10 },
  daily_review_limit: { type: 'choice', values: [0, 20, 50, 100], fallback: 0 },
};

function read(key) {
  const definition = settingDefinitions[key];
  const raw = db.prepare('SELECT value FROM app_settings WHERE key=?').get(key)?.value;
  if (definition.type === 'boolean') return raw === undefined ? definition.fallback : raw === 'true';
  const value = Number(raw);
  return definition.values.includes(value) ? value : definition.fallback;
}

export const settingsRepository = {
  publicSettings() {
    return {
      registrationOpen: read('registration_open'),
      studyAudioEnabled: read('study_audio_enabled'),
      maintenanceMode: read('maintenance_mode'),
      sessionDurationDays: read('session_duration_days'),
      minPasswordLength: read('min_password_length'),
      dailyReviewLimit: read('daily_review_limit'),
    };
  },
  adminSettings() { return Object.fromEntries(Object.keys(settingDefinitions).map(key => [key, read(key)])); },
  update(key, value, adminId) {
    const stored = settingDefinitions[key].type === 'boolean' ? String(value) : String(Number(value));
    db.prepare(`INSERT INTO app_settings(key,value,updated_at,updated_by) VALUES(?,?,CURRENT_TIMESTAMP,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`)
      .run(key, stored, adminId);
  },
  recordAdminAction(adminId, action, target = '') {
    const actor = db.prepare('SELECT email FROM users WHERE id=?').get(adminId);
    db.prepare('INSERT INTO admin_audit_log(actor_id,actor_email,action,target) VALUES(?,?,?,?)')
      .run(adminId, actor?.email || 'admin desconhecido', action, String(target).slice(0, 200));
  },
  auditLog() {
    return db.prepare('SELECT id,actor_email,action,target,created_at FROM admin_audit_log ORDER BY id DESC LIMIT 50').all();
  },
};
