import { Request, Response } from 'express';
import logger from '../config/logger';
import prisma from '../config/database';
import { validateJumpsellerSignature, JumpsellerParams, generateJumpsellerSignature } from '../utils/hmac';
import { MercadoPagoService } from '../services/mercadopago.service';
import { PayPalService } from '../services/paypal.service';
import { BinancePayService } from '../services/binance.service';
import { CurrencyService } from '../services/currency.service';
import { JumpsellerService } from '../services/jumpseller.service';
import { addCallbackJob } from '../queues/callback.queue';
import { JumpSellerRequest } from '@/types/jumpseller';

export class PaymentController {
  static async initPayment(req: Request, res: Response) {
    try {
      const jumpsellerParams = req.body as JumpsellerParams;

      logger.info('Payment initialization request received', {
        reference: jumpsellerParams.x_reference,
        amount: jumpsellerParams.x_amount,
        currency: jumpsellerParams.x_currency,
        shopName: jumpsellerParams.x_shop_name,
      });


      const secret = process.env.JUMPSELLER_PAYMENT_SECRET;
      if (!secret) {
        logger.error('Jumpseller payment secret not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const isValidSignature = validateJumpsellerSignature(jumpsellerParams);
      if (!isValidSignature) {
        logger.warn('Invalid HMAC signature', {
          reference: jumpsellerParams.x_reference,
          receivedSignature: jumpsellerParams.x_signature,
        });
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const existingOrder = await prisma.order.findUnique({
        where: { jumpsellerReference: jumpsellerParams.x_reference },
      });

      if (existingOrder) {
        logger.info('Order already exists, redirecting to payment selection', {
          orderId: existingOrder.id,
          reference: jumpsellerParams.x_reference,
        });

        return res.redirect(
          `${process.env.FRONTEND_URL}/payment/select/${existingOrder.id}`
        );
      }

      const order = await prisma.order.create({
        data: {
          jumpsellerReference: jumpsellerParams.x_reference,
          shopName: jumpsellerParams.x_shop_name,
          originalAmount: parseFloat(jumpsellerParams.x_amount),
          originalCurrency: jumpsellerParams.x_currency,
          status: 'pending',
          xUrlComplete: jumpsellerParams.x_url_complete,
          xUrlCancel: jumpsellerParams.x_url_cancel,
          xUrlCallback: jumpsellerParams.x_url_callback,
          metadata: {
            jumpsellerParams,
            receivedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.transactionLog.create({
        data: {
          orderId: order.id,
          eventType: 'payment_initiated',
          gateway: 'jumpseller',
          requestData: jumpsellerParams,
          responseData: { orderId: order.id, status: 'pending' },
        },
      });

      logger.info('Order created successfully', {
        orderId: order.id,
        reference: jumpsellerParams.x_reference,
        amount: jumpsellerParams.x_amount,
        currency: jumpsellerParams.x_currency,
      });

      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/select/${order.id}`
      );

    } catch (error) {
      logger.error('Error initializing payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          logs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      logger.info('Order retrieved', {
        orderId,
        reference: order.jumpsellerReference,
        status: order.status,
      });

      return res.json({
        id: order.id,
        reference: order.jumpsellerReference,
        shopName: order.shopName,
        originalAmount: order.originalAmount,
        originalCurrency: order.originalCurrency,
        convertedAmount: order.convertedAmount,
        convertedCurrency: order.convertedCurrency,
        status: order.status,
        paymentGateway: order.paymentGateway,
        createdAt: order.createdAt,
        logs: order.logs,
      });

    } catch (error) {
      logger.error('Error retrieving order', {
        orderId: req.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async processPayment(req: Request, res: Response) {
    try {
      const { orderId, gateway, country } = req.body;

      logger.info('Processing payment', { orderId, gateway, country });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Order already processed' });
      }

      let redirectUrl: string;
      let gatewayTransactionId: string;

      switch (gateway) {
        case 'mercadopago':
          if (!country || !MercadoPagoService.isCountrySupported(country)) {
            return res.status(400).json({ error: 'Invalid or unsupported country for MercadoPago' });
          }

          const mpResponse = await MercadoPagoService.createPayment({
            orderId,
            amount: Number(order.originalAmount),
            currency: order.originalCurrency,
            description: `Payment for order ${order.jumpsellerReference}`,
            externalReference: order.jumpsellerReference,
            returnUrl: `${req.protocol}://${req.get('host')}/api/callback/mercadopago/success/${orderId}`,
            cancelUrl: `${req.protocol}://${req.get('host')}/api/callback/mercadopago/cancel/${orderId}`,
            notificationUrl: `${req.protocol}://${req.get('host')}/api/webhook/mercadopago`,
          }, country);

          redirectUrl = mpResponse.initPoint;
          gatewayTransactionId = mpResponse.id;
          break;

        case 'paypal':
          if (!PayPalService.isCurrencySupported(order.originalCurrency)) {
            return res.status(400).json({ error: 'Currency not supported by PayPal' });
          }

          const ppResponse = await PayPalService.createPayment({
            orderId,
            amount: Number(order.originalAmount),
            currency: order.originalCurrency,
            description: `Payment for order ${order.jumpsellerReference}`,
            returnUrl: `${req.protocol}://${req.get('host')}/api/callback/paypal/success/${orderId}`,
            cancelUrl: `${req.protocol}://${req.get('host')}/api/callback/paypal/cancel/${orderId}`,
          });

          redirectUrl = ppResponse.approvalUrl;
          gatewayTransactionId = ppResponse.id;
          break;

        case 'binance_pay':
          const convertedAmount = await CurrencyService.convertAmount(
            Number(order.originalAmount),
            order.originalCurrency,
            'USD'
          );

          const bpResponse = await BinancePayService.createPayment({
            orderId,
            amount: Number(order.originalAmount),
            currency: order.originalCurrency,
            description: `Payment for order ${order.jumpsellerReference}`,
            returnUrl: `${req.protocol}://${req.get('host')}/api/callback/binance_pay/success/${orderId}`,
            cancelUrl: `${req.protocol}://${req.get('host')}/api/callback/binance_pay/cancel/${orderId}`,
          });

          redirectUrl = bpResponse.checkoutUrl;
          gatewayTransactionId = bpResponse.id;

          await prisma.order.update({
            where: { id: orderId },
            data: {
              convertedAmount,
              convertedCurrency: 'USD',
            },
          });
          break;

        default:
          return res.status(400).json({ error: 'Unsupported payment gateway' });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'processing',
          paymentGateway: `${gateway}${country ? `_${country.toLowerCase()}` : ''}`,
          gatewayTransactionId,
        },
      });

      await prisma.transactionLog.create({
        data: {
          orderId,
          eventType: 'payment_processing',
          gateway,
          requestData: { gateway, country, orderId },
          responseData: { gatewayTransactionId, redirectUrl },
        },
      });

      logger.info('Payment processing initiated', {
        orderId,
        gateway,
        gatewayTransactionId,
        redirectUrl,
      });

      return res.json({
        success: true,
        redirectUrl,
        gatewayTransactionId,
      });

    } catch (error) {
      logger.error('Error processing payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId: req.body.orderId,
        gateway: req.body.gateway,
      });

      return res.status(500).json({ error: 'Internal server error' });
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
      logger.error('Error processing payment', { error })
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

