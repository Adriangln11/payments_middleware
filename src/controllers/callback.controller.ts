import { Request, Response } from 'express';
import logger from '../config/logger';
import prisma from '../config/database';
import { JumpsellerService } from '../services/jumpseller.service';
import { addCallbackJob } from '../queues/callback.queue';

export class CallbackController {
  static async handleSuccess(req: Request, res: Response) {
    try {
      const { gateway, orderId } = req.params;

      logger.info('Handling success callback', { gateway, orderId });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        logger.error('Order not found for success callback', { orderId });
        return res.status(404).send('Order not found');
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'completed' },
      });


      await prisma.transactionLog.create({
        data: {
          orderId,
          eventType: 'payment_completed',
          gateway,
          requestData: req.query,
          responseData: { status: 'completed' },
        },
      });

      const callbackParams = JumpsellerService.generateCallbackParams(
        'completed',
        order.jumpsellerReference,
        order.originalAmount.toString(),
        order.originalCurrency,
        `Payment completed via ${gateway}`
      );

      await addCallbackJob({
        orderId,
        callbackUrl: order.xUrlCallback,
        params: callbackParams,
      });

      logger.info('Payment completed successfully', {
        orderId,
        gateway,
        reference: order.jumpsellerReference,
      });

      const redirectUrl = JumpsellerService.getRedirectUrl(
        order.xUrlComplete,
        callbackParams
      );

      return res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Error handling success callback', {
        gateway: req.params.gateway,
        orderId: req.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).send('Internal server error');
    }
  }

  static async handleCancel(req: Request, res: Response) {
    try {
      const { gateway, orderId } = req.params;

      logger.info('Handling cancel callback', { gateway, orderId });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        logger.error('Order not found for cancel callback', { orderId });
        return res.status(404).send('Order not found');
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      await prisma.transactionLog.create({
        data: {
          orderId,
          eventType: 'payment_cancelled',
          gateway,
          requestData: req.query,
          responseData: { status: 'cancelled' },
        },
      });

      const callbackParams = JumpsellerService.generateCallbackParams(
        'cancelled',
        order.jumpsellerReference,
        order.originalAmount.toString(),
        order.originalCurrency,
        `Payment cancelled by user via ${gateway}`
      );

      await addCallbackJob({
        orderId,
        callbackUrl: order.xUrlCallback,
        params: callbackParams,
      });

      logger.info('Payment cancelled', {
        orderId,
        gateway,
        reference: order.jumpsellerReference,
      });

      const redirectUrl = JumpsellerService.getRedirectUrl(
        order.xUrlCancel,
        callbackParams
      );

      return res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Error handling cancel callback', {
        gateway: req.params.gateway,
        orderId: req.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).send('Internal server error');
    }
  }

  static async handlePending(req: Request, res: Response) {
    try {
      const { gateway, orderId } = req.params;

      logger.info('Handling pending callback', { gateway, orderId });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        logger.error('Order not found for pending callback', { orderId });
        return res.status(404).send('Order not found');
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'processing' },
      });

      await prisma.transactionLog.create({
        data: {
          orderId,
          eventType: 'payment_pending',
          gateway,
          requestData: req.query,
          responseData: { status: 'pending' },
        },
      });

      const callbackParams = JumpsellerService.generateCallbackParams(
        'pending',
        order.jumpsellerReference,
        order.originalAmount.toString(),
        order.originalCurrency,
        `Payment pending via ${gateway}`
      );

      await addCallbackJob({
        orderId,
        callbackUrl: order.xUrlCallback,
        params: callbackParams,
      });

      logger.info('Payment pending', {
        orderId,
        gateway,
        reference: order.jumpsellerReference,
      });

      const redirectUrl = JumpsellerService.getRedirectUrl(
        order.xUrlComplete,
        callbackParams
      );

      return res.redirect(redirectUrl);

    } catch (error) {
      logger.error('Error handling pending callback', {
        gateway: req.params.gateway,
        orderId: req.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).send('Internal server error');
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const { gateway } = req.params;
      const webhookData = req.body;

      logger.info('Webhook received', { gateway, data: webhookData });


      logger.info('Webhook processed', { gateway });

      return res.status(200).json({ success: true });

    } catch (error) {
      logger.error('Error handling webhook', {
        gateway: req.params.gateway,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}