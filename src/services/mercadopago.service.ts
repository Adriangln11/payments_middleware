import { JumpSellerRequest } from '@/types/jumpseller';
import logger from '../config/logger';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import axios from 'axios';

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

  static async createTransaction(data: JumpSellerRequest) {
    try {
      logger.info('Creating MercadoPago preference', {
        x_account_id: data.x_account_id,
        x_reference: data.x_reference
      })
      const preference = await new Preference(this.client).create({
        body: {
          items: [
            {
              id: data.x_reference,
              title: data.x_description,
              unit_price: Number(data.x_amount),
              quantity: 1,
              currency_id: data.x_currency
            }
          ],
          payer: {
            name: data.x_customer_first_name,
            surname: data.x_customer_last_name,
            email: data.x_customer_email,
            phone: {
              area_code: data.x_customer_phone.slice(0, 2),
              number: data.x_customer_phone.slice(2)
            },
            address: {
              zip_code: data.x_customer_shipping_zip,
              street_name: data.x_customer_shipping_address1,
              street_number: data.x_customer_shipping_address2
            },
          },
          // "payment_methods": {
          //   "excluded_payment_methods": [
          //     {
          //       "id": "master"
          //     }
          //   ],
          //   "excluded_payment_types": [
          //     {
          //       "id": "ticket"
          //     }
          //   ],
          //   "default_payment_method_id": "amex",
          //   "installments": 10,
          //   "default_installments": 5
          // },
          // "shipments": {
          //   "local_pickup": false,
          //   "dimensions": "32 x 25 x 16",
          //   "default_shipping_method": null,
          //   "free_methods": [
          //     {
          //       "id": null
          //     }
          //   ],
          //   "cost": 20,
          //   "free_shipping": false,
          //   "receiver_address": {
          //     "zip_code": "72549555",
          //     "street_name": "Street address test",
          //     "city_name": "São Paulo",
          //     "state_name": "São Paulo",
          //     "street_number": 100,
          //     "country_name": "Brazil"
          //   }
          // },
          back_urls: {
            success: "https://google.com",
            pending: "https://yahoo.com",
            failure: "https://github.com"
          },
          notification_url: `${process.env.BASE_URL}/api/payment/mercadopago/webhook`,
          metadata: {
            orderData: data
          }
        }
      })
      logger.info('MercadoPago preference created successfully', {
        x_account_id: data.x_account_id,
        x_reference: data.x_reference
      })
      return preference.init_point;

    } catch (error) {
      logger.error('Error creating MercadoPago preference', {
        x_account_id: data.x_account_id,
        x_reference: data.x_reference
      })
      throw error;
    }

  }

  static async webhookPostTransaction(data: any) {

    logger.info('Validating webhook request (mercadopago.service)', { data })

    try {
      if (data.topic === 'merchant_order') {
        logger.info('Received merchant_order notification', { resource: data.resource })

        const res = await axios.get(data.resource, {
          headers: {
            'Authorization': `Bearer ${process.env.DEV_ACCESS_TOKEN_MP}`,
          }
        })

        if (res.data.order_status === 'paid') {
          logger.info('Preference paid successfuly', {
            id: res.data.id,
            preference_id: res.data.preference_id,
            paid_amount: res.data.paid_amount
          })
        }
        return
      }

      if (data.topic === 'payment') {
        logger.info('Received payment notification', { resource: data.resource })

      }

    } catch (error) {
      logger.error('Error completing transaction', { data })
      throw error;
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