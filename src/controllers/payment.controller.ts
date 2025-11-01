import { Request, Response } from 'express';
import logger from '../config/logger';
import { MercadoPagoService } from '../services/mercadopago.service';
import { PayPalService } from '../services/paypal.service';
import { JumpSellerRequest } from '@/types/jumpseller';

export class PaymentController {
  static async initPaymentProcess(req: Request, res: Response) {

    try {
      console.log(req.body)
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


      return res.status(200).redirect(urlToRedirect!)

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
}

