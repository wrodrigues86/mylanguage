import { Router } from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import { adminController } from '../controllers/adminController.js';
import { assistantController } from '../controllers/assistantController.js';

const router = Router();
router.use(auth, requireAdmin);
router.get('/overview', adminController.overview);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/active', adminController.setUserActive);
router.get('/settings', adminController.getSettings);
router.get('/audit-log', adminController.auditLog);
router.get('/assistant', assistantController.adminConfig);
router.patch('/assistant', assistantController.updateAdminConfig);
router.post('/assistant/test-chat', assistantController.testChat);
router.patch('/settings/:key', adminController.updateSetting);

export default router;
