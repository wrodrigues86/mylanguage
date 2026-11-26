import { adminRepository } from '../repositories/adminRepository.js';
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
    settingsRepository.update(key, value, adminId);
    settingsRepository.recordAdminAction(adminId, 'setting_updated', `${key}=${value}`);
    return settingsRepository.adminSettings();
  },
  getAuditLog() { return settingsRepository.auditLog(); },
};
