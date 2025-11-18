import axios from 'axios';
import logger from '../config/logger';
import { JumpSellerRequest } from '@/types/jumpseller';
import { JumpsellerService } from './jumpseller.service';


export class PayPalService {

  static async createTransaction(order: JumpSellerRequest) {

    try {
      logger.info('Processing PayPal payment', { reference: order.x_reference })

      logger.info('Generating paypal token')

      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');

      const { data: { access_token } } = await axios.post(`${process.env.URL_API_PAYPAL}/v1/oauth2/token`,
        params,
        {
          auth: {
            username: process.env.CLIENT_ID_PAYPAL!,
            password: process.env.SECRET_KEY_PAYPAL!
          }
        }
      )

      // Use our backend URL for return/cancel to handle the callback
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

      const formatedOrder = {
        intent: "CAPTURE",
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              landing_page: "BILLING",
              shipping_preference: "GET_FROM_FILE",
              user_action: "PAY_NOW",
              return_url: `${baseUrl}/api/payment/paypal/success?reference=${order.x_reference}`,
              cancel_url: order.x_url_cancel
            }
          }
        },
        purchase_units: [
          {
            reference_id: order.x_reference, // Store Jumpseller reference
            amount: {
              currency_code: order.x_currency,
              value: order.x_amount
            }
          }
        ]
      }

      const res = await axios.post(`${process.env.URL_API_PAYPAL}/v2/checkout/orders`, formatedOrder, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      })

      // Save order to database with PayPal order ID
      await JumpsellerService.saveOrder(order, 'paypal', res.data.id);

      logger.info('PayPal order created and saved', {
        reference: order.x_reference,
        paypalOrderId: res.data.id
      });

      return res.data;
    } catch (error) {
      logger.error('Error processing PayPal payment', { reference: order.x_reference, error })
      throw error;
    }
  }

  /**
   * Capture PayPal payment after user approval
   */
  static async capturePayment(paypalOrderId: string) {
    try {
      logger.info('Capturing PayPal payment', { paypalOrderId });

      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');

      const { data: { access_token } } = await axios.post(`${process.env.URL_API_PAYPAL}/v1/oauth2/token`,
        params,
        {
          auth: {
            username: process.env.CLIENT_ID_PAYPAL!,
            password: process.env.SECRET_KEY_PAYPAL!
          }
        }
      );

      const res = await axios.post(
        `${process.env.URL_API_PAYPAL}/v2/checkout/orders/${paypalOrderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('PayPal payment captured', {
        paypalOrderId,
        status: res.data.status
      });

      return res.data;
    } catch (error) {
      logger.error('Error capturing PayPal payment', { paypalOrderId, error });
      throw error;
    }
  }

  /**
   * Handle PayPal success redirect - capture payment and notify Jumpseller
   */
  static async handlePaymentSuccess(paypalOrderId: string, reference: string) {
    try {
      logger.info('Handling PayPal payment success', { paypalOrderId, reference });

      // Capture the payment
      const captureResult = await this.capturePayment(paypalOrderId);

      if (captureResult.status === 'COMPLETED') {
        // Notify Jumpseller
        const notified = await JumpsellerService.notifyPaymentComplete(
          reference,
          'completed',
          `PayPal payment ${paypalOrderId} completed successfully`
        );

        if (notified) {
          logger.info('Jumpseller notified of PayPal payment', { reference, paypalOrderId });
        } else {
          logger.error('Failed to notify Jumpseller', { reference, paypalOrderId });
        }

        // Get order to return the complete URL
        const order = await JumpsellerService.getOrderByReference(reference);
        return {
          success: true,
          redirectUrl: order?.xUrlComplete
        };
      } else {
        logger.warn('PayPal payment not completed', { paypalOrderId, status: captureResult.status });
        return {
          success: false,
          error: 'Payment not completed'
        };
      }
    } catch (error) {
      logger.error('Error handling PayPal payment success', { paypalOrderId, reference, error });
      throw error;
    }
  }

  static async completeTransaction(webhookData: any) {
    try {
      logger.info('Processing PayPal webhook', { eventType: webhookData.event_type })

      switch (webhookData.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          logger.info('Payment completed via webhook', {
            paymentId: webhookData.resource.id,
            amount: webhookData.resource.amount
          });

          // Try to find the order by the PayPal order ID
          // Note: The webhook contains capture ID, not order ID
          // We may need to handle this differently based on your flow
          break;

        case 'PAYMENT.CAPTURE.DENIED':
          logger.info('Payment denied', { paymentId: webhookData.resource.id });

          // Find order and notify Jumpseller of failure
          const deniedOrder = await JumpsellerService.getOrderByGatewayId(webhookData.resource.id);
          if (deniedOrder) {
            await JumpsellerService.notifyPaymentComplete(
              deniedOrder.jumpsellerReference,
              'failed',
              'Payment was denied'
            );
          }
          break;

        case 'CHECKOUT.ORDER.APPROVED':
          logger.info('Order approved', { orderId: webhookData.resource.id });
          break;

        default:
          logger.info('Unhandled PayPal event', { eventType: webhookData.event_type });
      }

    } catch (error) {
      logger.error('Error processing PayPal webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

}
