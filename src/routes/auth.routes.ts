import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { loginSchema } from '../utils/validation';

const router: Router = Router();

router.post('/login', validateBody(loginSchema), AuthController.login);

router.get('/verify', AuthController.verifyToken);

export default router;