import { Router } from 'express';
import { CallbackController } from '../controllers/callback.controller';

const router: Router = Router();

router.post('/:gateway', CallbackController.handleWebhook);

export default router;