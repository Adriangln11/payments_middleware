import { Router } from 'express';
//import { AuthController } from '../controllers/auth.controller';

const router: Router = Router();

//router.post('/login', AuthController.login);

//router.get('/verify', AuthController.verifyToken);
router.get('/', (_, res) => res.send('Auth'))
export default router;
