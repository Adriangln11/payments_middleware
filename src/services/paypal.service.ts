import axios from 'axios';
import logger from '../config/logger';

export interface PayPalPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalPaymentResponse {
  id: string;
  approvalUrl: string;
  status: string;
}

export class PayPalService {
  private static getCredentials() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured');
    }

    return { clientId, clientSecret, mode };
  }

  static async createPayment(request: PayPalPaymentRequest): Promise<PayPalPaymentResponse> {
    logger.info('Creating PayPal payment', { orderId: request.orderId });

    try {
      const credentials = this.getCredentials();
      logger.debug('Using PayPal credentials', { mode: credentials.mode, hasCredentials: !!credentials.clientId });


      const mockResponse: PayPalPaymentResponse = {
        id: `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        approvalUrl: `${process.env.FRONTEND_URL}/mock/paypal/checkout?order=${request.orderId}`,
        status: 'CREATED'
      };

      logger.info('PayPal payment created successfully', {
        orderId: request.orderId,
        ppId: mockResponse.id,
        approvalUrl: mockResponse.approvalUrl
      });

      return mockResponse;

    } catch (error) {
      logger.error('Error creating PayPal payment', {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async capturePayment(paymentId: string): Promise<string> {
    logger.info('Capturing PayPal payment', { paymentId });

    try {

      const statuses = ['COMPLETED', 'FAILED', 'PENDING'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      logger.info('PayPal payment captured', { paymentId, status: randomStatus });

      return randomStatus;

    } catch (error) {
      logger.error('Error capturing PayPal payment', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async getPaymentStatus(paymentId: string): Promise<string> {
    logger.info('Getting PayPal payment status', { paymentId });

    try {

      const statuses = ['CREATED', 'APPROVED', 'COMPLETED', 'CANCELLED', 'FAILED'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      logger.info('PayPal payment status retrieved', { paymentId, status: randomStatus });

      return randomStatus;

    } catch (error) {
      logger.error('Error getting PayPal payment status', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'ARS', 'MXN', 'CLP', 'COP'];
  }

  static isCurrencySupported(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }

  static async createTransaction(order: any) {

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

      const res = await axios.post(`${process.env.URL_API_PAYPAL}/v2/checkout/orders`, order, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
      )
      console.log(res.data)

      return res.data
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