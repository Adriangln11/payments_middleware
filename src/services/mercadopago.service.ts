import { JumpSellerRequest } from '@/types/jumpseller';
import logger from '../config/logger';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import axios from 'axios';
import dotenv from 'dotenv';
import { JumpsellerService } from './jumpseller.service';
dotenv.config();

export class MercadoPagoService {

  private static client = new MercadoPagoConfig({
    accessToken: process.env.DEV_ACCESS_TOKEN_MP || '',
  })

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
          external_reference: data.x_reference, // Store Jumpseller reference
          back_urls: {
            success: data.x_url_complete,
            pending: data.x_url_callback,
            failure: data.x_url_cancel
          },
          notification_url: `${process.env.BASE_URL}/api/payment/mercadopago/webhook`,
          metadata: {
            orderData: data
          }
        }
      })

      // Save order to database with preference ID
      await JumpsellerService.saveOrder(data, 'mercadopago', preference.id);

      logger.info('MercadoPago preference created successfully', {
        x_account_id: data.x_account_id,
        x_reference: data.x_reference,
        preference_id: preference.id
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

        const merchantOrder = res.data;

        if (merchantOrder.order_status === 'paid') {
          logger.info('Preference paid successfully', {
            id: merchantOrder.id,
            preference_id: merchantOrder.preference_id,
            paid_amount: merchantOrder.paid_amount,
            external_reference: merchantOrder.external_reference
          })

          // Get the Jumpseller reference from external_reference
          const reference = merchantOrder.external_reference;

          if (reference) {
            // Notify Jumpseller of successful payment
            const notified = await JumpsellerService.notifyPaymentComplete(
              reference,
              'completed',
              `MercadoPago payment completed - Order ${merchantOrder.id}`
            );

            if (notified) {
              logger.info('Jumpseller notified of MercadoPago payment', {
                reference,
                merchantOrderId: merchantOrder.id
              });
            } else {
              logger.error('Failed to notify Jumpseller', {
                reference,
                merchantOrderId: merchantOrder.id
              });
            }
          } else {
            logger.warn('No external_reference found in merchant order', {
              merchantOrderId: merchantOrder.id
            });
          }
        }
        return
      }

      if (data.topic === 'payment') {
        logger.info('Received payment notification', { resource: data.resource })

        // Get payment details
        const paymentRes = await axios.get(data.resource, {
          headers: {
            'Authorization': `Bearer ${process.env.DEV_ACCESS_TOKEN_MP}`,
          }
        })

        const payment = paymentRes.data;

        logger.info('Payment details', {
          id: payment.id,
          status: payment.status,
          external_reference: payment.external_reference
        })

        // Handle payment based on status
        if (payment.status === 'approved' && payment.external_reference) {
          const notified = await JumpsellerService.notifyPaymentComplete(
            payment.external_reference,
            'completed',
            `MercadoPago payment ${payment.id} approved`
          );

          if (notified) {
            logger.info('Jumpseller notified of MercadoPago payment (via payment webhook)', {
              reference: payment.external_reference,
              paymentId: payment.id
            });
          }
        } else if (payment.status === 'rejected' && payment.external_reference) {
          await JumpsellerService.notifyPaymentComplete(
            payment.external_reference,
            'failed',
            `MercadoPago payment ${payment.id} rejected`
          );
        } else if (payment.status === 'pending' && payment.external_reference) {
          await JumpsellerService.notifyPaymentComplete(
            payment.external_reference,
            'pending',
            `MercadoPago payment ${payment.id} pending`
          );
        }
      }

    } catch (error) {
      logger.error('Error completing transaction', { data, error })
      throw error;
    }

  }
}
