import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { db } from '../database/db.js';

function encryptionKey() {
  return Buffer.from(hkdfSync('sha256', process.env.JWT_SECRET, 'mylingua-assistant-key', 'aes-256-gcm', 32));
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64')).join('.');
}

function decrypt(value) {
  if (!value) return '';
  const [iv, tag, ciphertext] = value.split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

const select = `SELECT enabled,name,model,instructions,welcome_message,temperature,max_output_tokens,api_key_ciphertext,active_start,active_end,timezone
  FROM assistant_config WHERE id=1`;

export const assistantRepository = {
  get() { return db.prepare(select).get(); },
  getAdminConfig() {
    const { api_key_ciphertext, ...config } = this.get();
    return { ...config, enabled: Boolean(config.enabled), apiKeyConfigured: Boolean(api_key_ciphertext) };
  },
  getPublicConfig() {
    const { enabled, name, welcome_message } = this.get();
    return { enabled: Boolean(enabled), name, welcomeMessage: welcome_message };
  },
  getApiKey() { return decrypt(this.get().api_key_ciphertext); },
  update(config) {
    const current = this.get();
    const apiKey = config.clearApiKey ? '' : config.apiKey ? encrypt(config.apiKey) : current.api_key_ciphertext;
    db.prepare(`UPDATE assistant_config SET enabled=?,name=?,model=?,instructions=?,welcome_message=?,temperature=?,max_output_tokens=?,api_key_ciphertext=?,active_start=?,active_end=?,timezone=? WHERE id=1`)
      .run(config.enabled ? 1 : 0, config.name.trim(), config.model.trim(), config.instructions.trim(), config.welcomeMessage.trim(), config.temperature, config.maxOutputTokens, apiKey, config.activeStart, config.activeEnd, config.timezone);
  },
};
