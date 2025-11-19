import axios from "axios";
import prisma from "@/config/prisma";
import logger from "@/config/logger";
import { JumpSellerRequest } from "@/types/jumpseller";
import { generateJumpsellerSignature } from "@/utils/hmac";

export type PaymentResult = 'completed' | 'pending' | 'failed';

export class JumpsellerService {


  static async saveOrder(data: JumpSellerRequest, paymentGateway: string, gatewayTransactionId?: string) {
    try {
      const existingOrder = await prisma.order.findUnique({
        where: { jumpsellerReference: data.x_reference }
      });

      if (existingOrder) {
        logger.info('Order already exists, updating... (jumseller.service)', { reference: data.x_reference });
        return prisma.order.update({
          where: { jumpsellerReference: data.x_reference },
          data: {
            gatewayTransactionId,
            paymentGateway,
            metadata: JSON.stringify(data)
          }
        });
      }

      const order = await prisma.order.create({
        data: {
          jumpsellerReference: data.x_reference,
          xAccountId: data.x_account_id,
          shopName: data.x_shop_name,
          originalAmount: parseFloat(data.x_amount),
          originalCurrency: data.x_currency,
          status: 'pending',
          paymentGateway,
          gatewayTransactionId,
          xUrlComplete: data.x_url_complete,
          xUrlCancel: data.x_url_cancel,
          xUrlCallback: data.x_url_callback,
          metadata: JSON.stringify(data)
        }
      });

      logger.info('Order saved to database (jumseller.service)', {
        orderId: order.id,
        reference: data.x_reference
      });

      return order;
    } catch (error) {
      logger.error('Error saving order to database (jumseller.service)', { error, reference: data.x_reference });
      throw error;
    }
  }

  static async updateOrderGatewayId(reference: string, gatewayTransactionId: string) {
    try {
      const order = await prisma.order.update({
        where: { jumpsellerReference: reference },
        data: { gatewayTransactionId }
      });

      logger.info('Order updated with gateway transaction ID (jumseller.service)', {
        orderId: order.id,
        gatewayTransactionId
      });

      return order;
    } catch (error) {
      logger.error('Error updating order gateway ID (jumseller.service)', { error, reference });
      throw error;
    }
  }

  static async getOrderByReference(reference: string) {
    return prisma.order.findUnique({
      where: { jumpsellerReference: reference }
    });
  }

  static async getOrderByGatewayId(gatewayTransactionId: string) {
    return prisma.order.findFirst({
      where: { gatewayTransactionId }
    });
  }

  static async notifyPaymentComplete(
    reference: string,
    result: PaymentResult = 'completed',
    message?: string
  ): Promise<boolean> {
    const order = await this.getOrderByReference(reference);

    if (!order) {
      logger.error('Order not found for notification (jumseller.service)', { reference });
      throw new Error(`Order not found: ${reference}`);
    }

    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const dataToSign: Record<string, string> = {
      x_account_id: order.xAccountId,
      x_amount: order.originalAmount.toString(),
      x_currency: order.originalCurrency,
      x_reference: order.jumpsellerReference,
      x_result: result,
      x_timestamp: timestamp,
    };

    if (message) {
      dataToSign.x_message = message;
    }

    const hmacSignature = generateJumpsellerSignature(dataToSign);
    const payload = { ...dataToSign, x_signature: hmacSignature };

    logger.info('Notifying Jumpseller (jumseller.service)', {
      reference,
      result,
      callbackUrl: order.xUrlCallback,
      payload
    });

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(order.xUrlCallback, payload, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        });

        await prisma.callbackRetry.create({
          data: {
            orderId: order.id,
            callbackUrl: order.xUrlCallback,
            attemptNumber: attempt,
            statusCode: response.status,
            responseBody: JSON.stringify(response.data)
          }
        });

        if (response.status === 200) {

          await prisma.order.update({
            where: { id: order.id },
            data: { status: result }
          });

          logger.info('Jumpseller notification successful (jumseller.service)', {
            reference,
            attempt,
            status: response.status
          });

          return true;
        }
      } catch (error) {
        lastError = error as Error;

        await prisma.callbackRetry.create({
          data: {
            orderId: order.id,
            callbackUrl: order.xUrlCallback,
            attemptNumber: attempt,
            statusCode: axios.isAxiosError(error) ? error.response?.status : null,
            responseBody: axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : (error as Error).message,
            nextRetryAt: attempt < maxRetries ? new Date(Date.now() + attempt * 5000) : null
          }
        });

        logger.warn('Jumpseller notification failed, retrying... (jumseller.service)', {
          reference,
          attempt,
          error: (error as Error).message
        });

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }

    logger.error('All Jumpseller notification attempts failed (jumseller.service)', {
      reference,
      error: lastError?.message
    });

    return false;
  }

  static async completeOrder(data: JumpSellerRequest, status: string) {
    try {
      logger.info('Processing jumpseller callback (jumpseller.service)', { x_reference: data.x_reference, status });

      if (!data.x_reference || !data.x_account_id || !data.x_amount || !data.x_currency || !status) {
        logger.error('Missing fields on request (jumpseller.service)', { x_reference: data.x_reference, status });
        throw new Error('Missing fields on request');
      }

      const dataToSign = {
        x_reference: data.x_reference,
        x_amount: data.x_amount,
        x_currency: data.x_currency,
        x_account_id: data.x_account_id,
        x_result: status,
        x_timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        x_message: data.x_description
      };

      const hmacSignature = generateJumpsellerSignature(dataToSign);

      await axios.post(data.x_url_callback, { ...dataToSign, x_signature: hmacSignature });

      return true;
    } catch (error) {
      logger.error('Error processing jumpseller callback (jumpseller.service)', { error });
      throw error;
    }
  }

  static async logTransaction(
    orderId: string,
    eventType: string,
    gateway: string,
    requestData?: any,
    responseData?: any
  ) {
    return prisma.transactionLog.create({
      data: {
        orderId,
        eventType,
        gateway,
        requestData: requestData ? JSON.stringify(requestData) : null,
        responseData: responseData ? JSON.stringify(responseData) : null
      }
    });
  }
}
