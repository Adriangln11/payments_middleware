import axios from 'axios';
import logger from '../config/logger';
import { JumpSellerRequest } from '@/types/jumpseller';


export class PayPalService {

  static async createTransaction(order: JumpSellerRequest) {

    try {
      logger.info('Processing PayPal payment', { order })

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
      const formatedOrder = {
        intent: "CAPTURE",
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              landing_page: "BILLING",
              shipping_preference: "GET_FROM_FILE",
              user_action: "PAY_NOW",
              return_url: order.x_url_complete,
              cancel_url: order.x_url_cancel
            }
          }
        },
        purchase_units: [
          {
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

      return res.data;
    } catch (error) {
      logger.error('Error processing PayPal payment', { order })
      throw error;
    }
  }

  static async completeTransaction(webhookData: any) {
    try {
      logger.info('Processing PayPal webhook', { eventType: webhookData.event_type })


      switch (webhookData.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          logger.info('Payment completed', {
            paymentId: webhookData.resource.id,
            amount: webhookData.resource.amount
          })

          break;

        case 'PAYMENT.CAPTURE.DENIED':
          logger.info('Payment denied', { paymentId: webhookData.resource.id })
          break;

        case 'CHECKOUT.ORDER.APPROVED':
          logger.info('Order approved', { orderId: webhookData.resource.id })
          break;

        default:
          logger.info('Unhandled PayPal event', { eventType: webhookData.event_type })
      }

    } catch (error) {
      logger.error('Error processing PayPal webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

}