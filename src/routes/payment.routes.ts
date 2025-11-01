import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router: Router = Router();


router.post('/', PaymentController.initPaymentProcess)

router.post('/mercadopago', PaymentController.mercadoPago)

router.post('/mercadopago/webhook', PaymentController.webhookMercadoPago)

router.post('/paypal', PaymentController.paypal)

router.post('/paypal/webhook', PaymentController.paypalWebhook)

export default router;