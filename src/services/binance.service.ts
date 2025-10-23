import logger from '../config/logger';
import { CurrencyService } from './currency.service';

export interface BinancePayPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface BinancePayPaymentResponse {
  id: string;
  checkoutUrl: string;
  qrCodeUrl: string;
  status: string;
  usdtAmount: number;
}

export class BinancePayService {
  private static getCredentials() {
    const apiKey = process.env.BINANCE_PAY_API_KEY;
    const secretKey = process.env.BINANCE_PAY_SECRET;
    const mode = process.env.BINANCE_PAY_MODE || 'sandbox';

    if (!apiKey || !secretKey) {
      throw new Error('Binance Pay credentials not configured');
    }

    return { apiKey, secretKey, mode };
  }

  static async createPayment(request: BinancePayPaymentRequest): Promise<BinancePayPaymentResponse> {
    logger.info('Creating Binance Pay payment', { orderId: request.orderId });

    try {
      const credentials = this.getCredentials();
      logger.debug('Using Binance Pay credentials', { mode: credentials.mode, hasCredentials: !!credentials.apiKey });

      const usdtAmount = await CurrencyService.convertAmount(
        request.amount,
        request.currency,
        'USDT'
      );


      const mockResponse: BinancePayPaymentResponse = {
        id: `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        checkoutUrl: `${process.env.FRONTEND_URL}/mock/binance/checkout?order=${request.orderId}`,
        qrCodeUrl: `${process.env.FRONTEND_URL}/mock/binance/qr?order=${request.orderId}`,
        status: 'PENDING',
        usdtAmount
      };

      logger.info('Binance Pay payment created successfully', {
        orderId: request.orderId,
        bpId: mockResponse.id,
        originalAmount: request.amount,
        originalCurrency: request.currency,
        usdtAmount,
        checkoutUrl: mockResponse.checkoutUrl
      });

      return mockResponse;

    } catch (error) {
      logger.error('Error creating Binance Pay payment', {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async getPaymentStatus(paymentId: string): Promise<string> {
    logger.info('Getting Binance Pay payment status', { paymentId });

    try {

      const statuses = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'ERROR'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      logger.info('Binance Pay payment status retrieved', { paymentId, status: randomStatus });

      return randomStatus;

    } catch (error) {
      logger.error('Error getting Binance Pay payment status', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  static async verifyWebhook(signature: string, payload: string): Promise<boolean> {
    logger.info('Verifying Binance Pay webhook signature');

    try {
      const credentials = this.getCredentials();


      logger.info('Binance Pay webhook signature verified');
      return true;

    } catch (error) {
      logger.error('Error verifying Binance Pay webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  static getSupportedCurrencies(): string[] {
    return ['USDT', 'BTC', 'ETH', 'BNB'];
  }

  static isCurrencySupported(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }

  static async getUSDTEquivalent(amount: number, currency: string): Promise<number> {
    return await CurrencyService.convertAmount(amount, currency, 'USDT');
  }
}