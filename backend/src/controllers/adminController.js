import { adminService, AdminServiceError } from '../services/adminService.js';

function handleError(res, error) {
  if (error instanceof AdminServiceError) return res.status(error.status).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'Não foi possível concluir a ação administrativa.' });
}

export const adminController = {
  overview(_req, res) {
    try { return res.json(adminService.getOverview()); } catch (error) { return handleError(res, error); }
  },
  listUsers(req, res) {
    try { return res.json(adminService.listUsers(req.query.search)); } catch (error) { return handleError(res, error); }
  },
  setUserActive(req, res) {
    try { return res.json(adminService.setUserActive(req.user.id, req.params.id, req.body?.active)); }
    catch (error) { return handleError(res, error); }
  },
  getSettings(_req, res) {
    try { return res.json(adminService.getSettings()); } catch (error) { return handleError(res, error); }
  },
  auditLog(_req, res) {
    try { return res.json(adminService.getAuditLog()); } catch (error) { return handleError(res, error); }
  },
  updateSetting(req, res) {
    try { return res.json(adminService.updateSetting(req.user.id, req.params.key, req.body?.value ?? req.body?.enabled)); }
    catch (error) { return handleError(res, error); }
  },
  listAnnouncements(_req, res) {
    try { return res.json(adminService.listAnnouncements()); } catch (error) { return handleError(res, error); }
  },
  createAnnouncement(req, res) {
    try { return res.status(201).json(adminService.createAnnouncement(req.user.id, req.body || {})); }
    catch (error) { return handleError(res, error); }
  },
  updateAnnouncement(req, res) {
    try { return res.json(adminService.updateAnnouncement(req.user.id, req.params.id, req.body || {})); }
    catch (error) { return handleError(res, error); }
  },
  deleteAnnouncement(req, res) {
    try { adminService.deleteAnnouncement(req.user.id, req.params.id); return res.status(204).end(); }
    catch (error) { return handleError(res, error); }
  },
};
