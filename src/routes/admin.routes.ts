import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(authenticateToken);

router.get('/dashboard/stats', AdminController.getDashboardStats);

router.get('/transactions', AdminController.getTransactions);
router.get('/transactions/:transactionId', AdminController.getTransactionDetails);


router.get('/gateway-configs', AdminController.getGatewayConfigs);
router.put('/gateway-configs/:configId', AdminController.updateGatewayConfig);

export default router;