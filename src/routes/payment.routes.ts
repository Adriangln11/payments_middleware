import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { jumpsellerPaymentSchema, paymentProcessSchema } from '../utils/validation';

const router: Router = Router();


router.post('/init', validateBody(jumpsellerPaymentSchema), PaymentController.initPayment);


router.get('/order/:orderId', PaymentController.getOrder);


router.post('/process', validateBody(paymentProcessSchema), PaymentController.processPayment);

router.post('/mercadopago', PaymentController.mercadoPago)

router.post('/mercadopago/webhook', PaymentController.webhookMercadoPago)

router.post('/paypal', PaymentController.paypal)

router.post('/paypal/webhook', PaymentController.paypalWebhook)

export default router;