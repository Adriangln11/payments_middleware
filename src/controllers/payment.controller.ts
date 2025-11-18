import { Request, Response } from 'express';
import logger from '../config/logger';
import { MercadoPagoService } from '../services/mercadopago.service';
import { PayPalService } from '../services/paypal.service';
import { JumpsellerService } from '../services/jumpseller.service';
import { JumpSellerRequest } from '@/types/jumpseller';

const mockData = {
  "x_url_callback": "https://mi-tienda.com/api/payment/callback",
  "x_url_complete": "https://mi-tienda.com/checkout/complete",
  "x_url_cancel": "https://mi-tienda.com/checkout/cancel",
  "x_account_id": "123456",
  "x_amount": "149.99",
  "x_currency": "USD",
  "x_reference": "ORDER-2025-0001",
  "x_shop_country": "US",
  "x_shop_name": "MiTiendaOnline",
  "x_description": "Compra de productos electrónicos",
  "x_customer_first_name": "Carlos",
  "x_customer_last_name": "Pérez",
  "x_customer_email": "carlos.perez@example.com",
  "x_customer_phone": "+17861234567",
  "x_customer_shipping_first_name": "Carlos",
  "x_customer_shipping_last_name": "Pérez",
  "x_customer_shipping_city": "Miami",
  "x_customer_shipping_address1": "1234 NW 5th St",
  "x_customer_shipping_address2": "Apto 3B",
  "x_customer_shipping_state": "FL",
  "x_customer_shipping_zip": "33101",
  "x_customer_shipping_country": "US",
  "x_customer_shipping_phone": "+17861234567",
  "x_customer_billing_first_name": "Carlos",
  "x_customer_billing_last_name": "Pérez",
  "x_customer_billing_city": "Miami",
  "x_customer_billing_address1": "1234 NW 5th St",
  "x_customer_billing_address2": "Apto 3B",
  "x_customer_billing_state": "FL",
  "x_customer_billing_zip": "33101",
  "x_customer_billing_country": "US",
  "x_customer_billing_phone": "+17861234567",
  "x_customer_taxid": "123456789",
  "x_signature": "4f8b9c2d3e7a11f5c4b2a0f7d1e6c9b8"
}


export class PaymentController {
  static async initPaymentProcess(req: Request, res: Response) {

    try {
      const data = req.body
      const params = new URLSearchParams(data).toString()

      return res.status(200).redirect(`/index.html?${params}`)
    } catch (error) {
      logger.error('Error processing payment (payment.controller)', {
        error
      })
      return res.status(500).json(error)
    }

  }

  static async mercadoPago(req: Request, res: Response) {
    try {

      const data: JumpSellerRequest = req.body

      logger.info('Processing Mercadopago payment (payment.controller)', {
        x_account_id: data.x_account_id,
        x_reference: data.x_reference
      })

      if (!data.x_account_id || !data.x_reference || !data.x_amount || !data.x_customer_email || !data.x_signature) {
        logger.error('Missing fields on request', {
          x_account_id: data.x_account_id,
          x_reference: data.x_reference
        })
        return res.status(400).json({ error: 'Missing fields on request' });
      }

      const urlToRedirect = await MercadoPagoService.createTransaction(data)


      return res.status(200).json({ url: urlToRedirect })

    } catch (error) {
      logger.error('Error processing MercadoPago payment', {
        x_account_id: req.body.x_account_id,
        x_reference: req.body.x_reference
      })
      console.log(error)
      return res.status(500).json({ error })
    }
  }

  static async webhookMercadoPago(req: Request, res: Response) {

    logger.info('Payment webhook received (payment.controller)', { data: req.body })

    await MercadoPagoService.webhookPostTransaction(req.body)

    logger.info('Payment webhook processed (payment.controller)', { data: req.body })

    return res.status(200).json({ success: true });

  }

  static async paypal(req: Request, res: Response) {

    try {
      const { body } = req

      const response = await PayPalService.createTransaction(body)

      return res.status(200).json(response)

    } catch (error) {
      logger.error('Error processing payment (payment.controller)', { error })
      return res.status(500).json({ error: 'Internal server error' });
    }

  }

  static async paypalWebhook(req: Request, res: Response) {

    logger.info('PayPal webhook received', { body: req.body })

    await PayPalService.completeTransaction(req.body)

    logger.info('PayPal webhook processed', { data: req.body })

    return res.status(200).json({ success: true });
  }

  static async paypalSuccess(req: Request, res: Response) {
    try {
      const { token, reference } = req.query;

      logger.info('PayPal success redirect received', { token, reference });

      if (!token || !reference) {
        logger.error('Missing token or reference in PayPal success redirect');
        return res.status(400).json({ error: 'Missing token or reference' });
      }

      const result = await PayPalService.handlePaymentSuccess(
        token as string,
        reference as string
      );

      if (result.success && result.redirectUrl) {
        logger.info('Redirecting to Jumpseller complete URL', { url: result.redirectUrl });
        return res.redirect(result.redirectUrl);
      } else {
        logger.error('PayPal payment failed', { result });
        return res.status(400).json({ error: result.error || 'Payment failed' });
      }
    } catch (error) {
      logger.error('Error processing PayPal success', { error });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async paymentCompleted(req: Request, res: Response) {

    try {
      const { orderId, ...jumpsellerData } = req.body;

      logger.info('Payment completed (payment.controller)', {
        x_reference: jumpsellerData.x_reference,
        orderId
      });

      if (!orderId || !jumpsellerData.x_reference) {
        logger.error('Missing orderId or x_reference');
        return res.status(400).json({ error: 'Missing orderId or x_reference' });
      }

      // Save order to database if not exists
      await JumpsellerService.saveOrder(jumpsellerData as JumpSellerRequest, 'paypal_card', orderId);

      // Capture the PayPal payment
      const captureResult = await PayPalService.capturePayment(orderId);

      if (captureResult.status === 'COMPLETED') {
        // Notify Jumpseller
        const notified = await JumpsellerService.notifyPaymentComplete(
          jumpsellerData.x_reference,
          'completed',
          `PayPal card payment ${orderId} completed successfully`
        );

        if (notified) {
          logger.info('Jumpseller notified of card payment', {
            reference: jumpsellerData.x_reference,
            orderId
          });
        } else {
          logger.error('Failed to notify Jumpseller of card payment', {
            reference: jumpsellerData.x_reference
          });
        }

        const url = `/completed.html?x_reference=${jumpsellerData.x_reference}`;
        return res.status(200).json({
          success: true,
          url,
          redirectUrl: jumpsellerData.x_url_complete
        });
      } else {
        logger.error('PayPal capture failed', { orderId, status: captureResult.status });
        return res.status(400).json({ error: 'Payment capture failed' });
      }
    }
    catch (error) {
      logger.error('Error completing payment (payment.controller)', { error })
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getPayPalConfig(req: Request, res: Response) {
    try {
      const clientId = process.env.CLIENT_ID_PAYPAL;
      logger.info('Getting PayPal config for client')
      if (!clientId) {
        logger.error('PayPal Client ID not configured in environment variables');
        return res.status(500).json({ error: 'PayPal configuration missing' });
      }

      return res.status(200).json({
        clientId,
        environment: process.env.PAYPAL_MODE || 'sandbox'
      });
    } catch (error) {
      logger.error('Error getting PayPal config', { error });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

}

