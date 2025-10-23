import { Router } from 'express';
import { CallbackController } from '../controllers/callback.controller';

const router: Router = Router();

router.get('/:gateway/success/:orderId', CallbackController.handleSuccess);
router.get('/:gateway/cancel/:orderId', CallbackController.handleCancel);
router.get('/:gateway/pending/:orderId', CallbackController.handlePending);

export default router;