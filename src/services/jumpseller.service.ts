import axios from "axios";
import prisma from "@/config/prisma";
import logger from "@/config/logger";
import { JumpSellerRequest } from "@/types/jumpseller";
import { generateJumpsellerSignature } from "@/utils/hmac";

export type PaymentResult = 'completed' | 'pending' | 'failed';

export class JumpsellerService {

  /**
   * Save order data from Jumpseller to database
   */
  static async saveOrder(data: JumpSellerRequest, paymentGateway: string, gatewayTransactionId?: string) {
    try {
      // Check if order already exists
      const existingOrder = await prisma.order.findUnique({
        where: { jumpsellerReference: data.x_reference }
      });

      if (existingOrder) {
        logger.info('Order already exists, updating...', { reference: data.x_reference });
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

      logger.info('Order saved to database', {
        orderId: order.id,
        reference: data.x_reference
      });

      return order;
    } catch (error) {
      logger.error('Error saving order to database', { error, reference: data.x_reference });
      throw error;
    }
  }

  /**
   * Update order with gateway transaction ID
   */
  static async updateOrderGatewayId(reference: string, gatewayTransactionId: string) {
    try {
      const order = await prisma.order.update({
        where: { jumpsellerReference: reference },
        data: { gatewayTransactionId }
      });

      logger.info('Order updated with gateway transaction ID', {
        orderId: order.id,
        gatewayTransactionId
      });

      return order;
    } catch (error) {
      logger.error('Error updating order gateway ID', { error, reference });
      throw error;
    }
  }

  /**
   * Get order by reference
   */
  static async getOrderByReference(reference: string) {
    return prisma.order.findUnique({
      where: { jumpsellerReference: reference }
    });
  }

  /**
   * Get order by gateway transaction ID
   */
  static async getOrderByGatewayId(gatewayTransactionId: string) {
    return prisma.order.findFirst({
      where: { gatewayTransactionId }
    });
  }

  /**
   * Notify Jumpseller about payment completion with retry logic
   */
  static async notifyPaymentComplete(
    reference: string,
    result: PaymentResult = 'completed',
    message?: string
  ): Promise<boolean> {
    const order = await this.getOrderByReference(reference);

    if (!order) {
      logger.error('Order not found for notification', { reference });
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

    logger.info('Notifying Jumpseller', {
      reference,
      result,
      callbackUrl: order.xUrlCallback,
      payload
    });

    // Retry logic - minimum 3 attempts as required by Jumpseller
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

        // Log callback attempt
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
          // Update order status
          await prisma.order.update({
            where: { id: order.id },
            data: { status: result }
          });

          logger.info('Jumpseller notification successful', {
            reference,
            attempt,
            status: response.status
          });

          return true;
        }
      } catch (error) {
        lastError = error as Error;

        // Log failed attempt
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

        logger.warn('Jumpseller notification failed, retrying...', {
          reference,
          attempt,
          error: (error as Error).message
        });

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }

    logger.error('All Jumpseller notification attempts failed', {
      reference,
      error: lastError?.message
    });

    return false;
  }

  /**
   * Legacy method - kept for compatibility
   * @deprecated Use notifyPaymentComplete instead
   */
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

  /**
   * Log transaction event
   */
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
