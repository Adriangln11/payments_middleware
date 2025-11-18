import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router: Router = Router();


router.post('/', PaymentController.initPaymentProcess)

router.post('/completed', PaymentController.paymentCompleted)

router.post('/mercadopago', PaymentController.mercadoPago)

router.post('/mercadopago/webhook', PaymentController.webhookMercadoPago)

router.post('/paypal', PaymentController.paypal)

router.post('/paypal/webhook', PaymentController.paypalWebhook)

router.get('/paypal/config', PaymentController.getPayPalConfig)

router.get('/paypal/success', PaymentController.paypalSuccess)

export default router;