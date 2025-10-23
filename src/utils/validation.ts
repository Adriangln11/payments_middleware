import { z } from 'zod';

export const jumpsellerPaymentSchema = z.object({
  x_reference: z.string().min(1),
  x_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  x_currency: z.string().length(3),
  x_shop_name: z.string().min(1),
  x_url_complete: z.string().url(),
  x_url_cancel: z.string().url(),
  x_url_callback: z.string().url(),
  x_account_id: z.string().min(1),
  x_signature: z.string().min(1),
});

export const paymentProcessSchema = z.object({
  orderId: z.string().uuid(),
  gateway: z.enum(['mercadopago', 'paypal', 'binance_pay']),
  country: z.string().length(2).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const gatewayConfigSchema = z.object({
  shopName: z.string().min(1),
  gatewayType: z.string().min(1),
  countryCode: z.string().length(2),
  currency: z.string().length(3),
  credentials: z.record(z.any()),
  isActive: z.boolean().default(true),
});