import logger from '../config/logger';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'

export interface MercadoPagoPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  externalReference: string;
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
}

export interface MercadoPagoPaymentResponse {
  id: string;
  initPoint: string;
  status: string;
}

export class MercadoPagoService {

  private static client = new MercadoPagoConfig({
    accessToken: process.env.DEV_ACCESS_TOKEN_MP || '',
  })

  private static getAccessToken(country: string): string {
    const tokens = {
      AR: process.env.MERCADOPAGO_ACCESS_TOKEN_AR,
      MX: process.env.MERCADOPAGO_ACCESS_TOKEN_MX,
      CL: process.env.MERCADOPAGO_ACCESS_TOKEN_CL,
    };

    const token = tokens[country as keyof typeof tokens];
    if (!token) {
      throw new Error(`MercadoPago access token not configured for country: ${country}`);
    }

    return token;
  }

  static async createPayment(
    request: MercadoPagoPaymentRequest,
    country: string
  ): Promise<MercadoPagoPaymentResponse> {
    logger.info('Creating MercadoPago payment', { orderId: request.orderId, country });

    try {

      const accessToken = this.getAccessToken(country);
      logger.debug('Using access token for country', { country, hasToken: !!accessToken });

      // Mock MercadoPago API response
      const mockResponse: MercadoPagoPaymentResponse = {
        id: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        initPoint: `${process.env.FRONTEND_URL}/mock/mercadopago/checkout?order=${request.orderId}&country=${country}`,
        status: 'pending'
      };

      logger.info('MercadoPago payment created successfully', {
        orderId: request.orderId,
        mpId: mockResponse.id,
        initPoint: mockResponse.initPoint
      });

      return mockResponse;

    } catch (error) {
      logger.error('Error creating MercadoPago payment', {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async getPaymentStatus(paymentId: string, country: string): Promise<string> {
    logger.info('Getting MercadoPago payment status', { paymentId, country });

    try {

      const statuses = ['pending', 'approved', 'rejected', 'cancelled'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      logger.info('MercadoPago payment status retrieved', { paymentId, status: randomStatus });

      return randomStatus;

    } catch (error) {
      logger.error('Error getting MercadoPago payment status', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static getSupportedCountries(): string[] {
    return ['AR', 'MX', 'CL'];
  }

  static getSupportedCurrencies(): Record<string, string> {
    return {
      AR: 'ARS',
      MX: 'MXN',
      CL: 'CLP'
    };
  }

  static isCountrySupported(country: string): boolean {
    return this.getSupportedCountries().includes(country.toUpperCase());
  }

  static async createTransaction(orderData: any) {

    try {

      logger.info('Processing MercadoPago payment', { orderId: orderData.x_reference })
      const preference = await new Preference(this.client).create({
        body: {
          items: [
            {
              id: orderData.x_reference,
              title: `Compra con referencia ${orderData.x_reference}`,
              unit_price: orderData.x_amount,
              quantity: 1,
              currency_id: orderData.x_currency
            }
          ],
          metadata: {
            orderData
          },
          // back_urls: {
          //   success: orderData.x_url_complete,
          //   failure: orderData.x_url_cancel,
          // },
          notification_url: `${process.env.BASE_URL}/api/payment/mercadopago/webhook`,
        }
      })
      return preference.init_point;

    } catch (error) {
      logger.error('Error processing MercadoPago payment', {
        orderId: orderData.x_reference,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

  }

  static async completeTransaction(data: any) {

    console.log('Full webhook data:', data)
    try {
      if (data.topic === 'merchant_order') {
        logger.info('Received merchant_order notification', { resource: data.resource })

        const res = await fetch(data.resource, {
          headers: {
            'Authorization': `Bearer ${process.env.DEV_ACCESS_TOKEN_MP}`,

          }
        })

        console.log('RESPONSE RESOURCE', await res.json())
        return;
      }


      // if (data.topic !== 'payment' && !data.data?.id) {
      //   logger.warn('Unknown webhook type', { data })
      //   return;
      // }

      // console.log('Payment data:', data)
      // logger.info('Payment ID from webhook', { id: data.data.id })
      // const id = data.data.id
      // console.log('Payment ID from webhook', id)
      //const payment = await new Payment(this.client).get({ id });
      //logger.info('Payment found', { payment })
    } catch (error) {
      logger.error('Error completing transaction', { data })
    }
    // if (!payment) {
    //   logger.error('Payment not found', { id })
    //   return
    // }

    // logger.info('Payment found', { payment })

    // if (payment.status === 'approved') {
    //   // if (exist) {
    //   //   logger.error('Payment already exist', { id })
    //   //   throw new Error('Payment already exist');
    //   // }
    //   logger.info('Payment completed and approved', { id })
    // }
    // logger.info('Payment completed but declined', { id })
    // return

  }
}