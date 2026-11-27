import { adminRepository } from '../repositories/adminRepository.js';
import { announcementRepository } from '../repositories/announcementRepository.js';
import { settingDefinitions, settingsRepository } from '../repositories/settingsRepository.js';

export class AdminServiceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const adminService = {
  getOverview() { return adminRepository.overview(); },
  listUsers(search) { return adminRepository.listUsers(String(search || '').trim().slice(0, 100)); },
  setUserActive(adminId, userId, active) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AdminServiceError('Conta inválida.');
    if (typeof active !== 'boolean') throw new AdminServiceError('O estado da conta deve ser ligado ou desligado.');
    const target = adminRepository.getUser(id);
    if (!target) throw new AdminServiceError('Conta não encontrada.', 404);
    if (id === adminId) throw new AdminServiceError('Você não pode desativar sua própria conta.');
    if (target.role === 'admin') throw new AdminServiceError('Contas administrativas não podem ser desativadas por este painel.');
    adminRepository.setUserActive(id, active);
    settingsRepository.recordAdminAction(adminId, active ? 'account_reactivated' : 'account_disabled', target.email);
    return { id, active };
  },
  getSettings() { return settingsRepository.adminSettings(); },
  updateSetting(adminId, key, value) {
    const definition = settingDefinitions[key];
    if (!definition) throw new AdminServiceError('Configuração desconhecida.');
    if (definition.type === 'boolean' && typeof value !== 'boolean') throw new AdminServiceError('O valor deve ser ligado ou desligado.');
    if (definition.type === 'choice' && (!Number.isInteger(value) || !definition.values.includes(value))) throw new AdminServiceError('A opção selecionada não é válida.');
    if (definition.type === 'text' && (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > definition.maxLength || /[\u0000-\u001f\u007f]/.test(value))) throw new AdminServiceError(`Informe um nome de site entre 2 e ${definition.maxLength} caracteres.`);
    settingsRepository.update(key, value, adminId);
    settingsRepository.recordAdminAction(adminId, 'setting_updated', `${key}=${value}`);
    return settingsRepository.adminSettings();
  },
  listAnnouncements() { return announcementRepository.listAll(); },
  createAnnouncement(adminId, input = {}) {
    const { image_data: imageData, alt_text: altText, active = true } = input;
    if (announcementRepository.count() >= 4) throw new AdminServiceError('O limite de 4 banners foi atingido. Exclua um banner para adicionar outro.');
    this.validateAnnouncementImage(imageData);
    this.validateAnnouncementAltText(altText);
    if (typeof active !== 'boolean') throw new AdminServiceError('O estado do banner deve ser ligado ou desligado.');
    const item = announcementRepository.create({ imageData, altText: altText.trim(), active });
    settingsRepository.recordAdminAction(adminId, 'announcement_created', `Banner ${item.id}`);
    return item;
  },
  updateAnnouncement(adminId, announcementId, input = {}) {
    const id = Number(announcementId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AdminServiceError('Banner inválido.');
    const current = announcementRepository.get(id);
    if (!current) throw new AdminServiceError('Banner não encontrado.', 404);
    const imageData = input.image_data === undefined ? current.image_data : input.image_data;
    const altText = input.alt_text === undefined ? current.alt_text : input.alt_text;
    const active = input.active === undefined ? Boolean(current.active) : input.active;
    this.validateAnnouncementImage(imageData);
    this.validateAnnouncementAltText(altText);
    if (typeof active !== 'boolean') throw new AdminServiceError('O estado do banner deve ser ligado ou desligado.');
    const item = announcementRepository.update(id, { imageData, altText: altText.trim(), active });
    if (!item) throw new AdminServiceError('Banner não encontrado.', 404);
    settingsRepository.recordAdminAction(adminId, 'announcement_updated', `Banner ${id}`);
    return item;
  },
  deleteAnnouncement(adminId, announcementId) {
    const id = Number(announcementId);
    if (!Number.isSafeInteger(id) || id < 1) throw new AdminServiceError('Banner inválido.');
    const current = announcementRepository.get(id);
    if (!current) throw new AdminServiceError('Banner não encontrado.', 404);
    announcementRepository.delete(id);
    settingsRepository.recordAdminAction(adminId, 'announcement_deleted', `Banner ${id}`);
  },
  validateAnnouncementImage(value) {
    if (typeof value !== 'string' || value.length > 220000) throw new AdminServiceError('A imagem deve ter no máximo 150 KB após a otimização.');
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new AdminServiceError('Envie uma imagem JPG, PNG ou WebP válida.');
    const image = Buffer.from(match[1], 'base64');
    if (image.length > 150 * 1024 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) throw new AdminServiceError('Não foi possível validar a imagem enviada.');
  },
  validateAnnouncementAltText(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) throw new AdminServiceError('Informe uma descrição acessível de até 160 caracteres.');
  },
  getAuditLog() { return settingsRepository.auditLog(); },
};
