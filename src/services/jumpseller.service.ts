import logger from '../config/logger';
import { generateJumpsellerSignature } from '../utils/hmac';

export interface JumpsellerCallbackParams {
  x_result: 'completed' | 'cancelled' | 'failed' | 'pending';
  x_reference: string;
  x_amount: string;
  x_currency: string;
  x_timestamp: string;
  x_message: string;
  x_account_id: string;
  x_signature?: string;
}

export class JumpsellerService {
  private static getSecret(): string {
    const secret = process.env.JUMPSELLER_PAYMENT_SECRET;
    if (!secret) {
      throw new Error('Jumpseller payment secret not configured');
    }
    return secret;
  }

  private static getAccountId(): string {
    const accountId = process.env.JUMPSELLER_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('Jumpseller account ID not configured');
    }
    return accountId;
  }

  static generateCallbackParams(
    result: 'completed' | 'cancelled' | 'failed' | 'pending',
    reference: string,
    amount: string,
    currency: string,
    message: string = ''
  ): JumpsellerCallbackParams {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const accountId = this.getAccountId();

    const params: Omit<JumpsellerCallbackParams, 'x_signature'> = {
      x_result: result,
      x_reference: reference,
      x_amount: amount,
      x_currency: currency,
      x_timestamp: timestamp,
      x_message: message,
      x_account_id: accountId,
    };

    const signature = generateJumpsellerSignature(params, this.getSecret());

    return {
      ...params,
      x_signature: signature,
    };
  }

  static buildCallbackUrl(callbackUrl: string, params: JumpsellerCallbackParams): string {
    const url = new URL(callbackUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  static async sendCallback(
    callbackUrl: string,
    params: JumpsellerCallbackParams
  ): Promise<{ success: boolean; statusCode?: number; responseBody?: string }> {
    logger.info('Sending callback to Jumpseller', {
      callbackUrl,
      result: params.x_result,
      reference: params.x_reference,
    });

    try {


      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params as any).toString(),
      });

      const responseBody = await response.text();

      logger.info('Jumpseller callback response', {
        statusCode: response.status,
        success: response.ok,
        responseBody: responseBody.substring(0, 200), // Log first 200 chars
      });

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody,
      };

    } catch (error) {
      logger.error('Error sending Jumpseller callback', {
        callbackUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        statusCode: undefined,
        responseBody: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static getRedirectUrl(
    baseUrl: string,
    params: JumpsellerCallbackParams
  ): string {
    const url = new URL(baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  static mapPaymentStatus(
    gateway: string,
    gatewayStatus: string
  ): 'completed' | 'cancelled' | 'failed' | 'pending' {
    const statusMappings: Record<string, Record<string, JumpsellerCallbackParams['x_result']>> = {
      mercadopago: {
        approved: 'completed',
        pending: 'pending',
        rejected: 'failed',
        cancelled: 'cancelled',
      },
      paypal: {
        COMPLETED: 'completed',
        APPROVED: 'pending',
        CANCELLED: 'cancelled',
        FAILED: 'failed',
        CREATED: 'pending',
      },
      binance_pay: {
        PAID: 'completed',
        PENDING: 'pending',
        EXPIRED: 'cancelled',
        CANCELLED: 'cancelled',
        ERROR: 'failed',
      },
    };

    const mapping = statusMappings[gateway];
    if (!mapping) {
      logger.warn(`Unknown gateway: ${gateway}, defaulting to failed`);
      return 'failed';
    }

    const result = mapping[gatewayStatus];
    if (!result) {
      logger.warn(`Unknown status ${gatewayStatus} for gateway ${gateway}, defaulting to failed`);
      return 'failed';
    }

    return result;
  }
}