import crypto from 'crypto';
import logger from '../config/logger';

export interface JumpsellerParams {
  x_reference: string;
  x_amount: string;
  x_currency: string;
  x_shop_name: string;
  x_url_complete: string;
  x_url_cancel: string;
  x_url_callback: string;
  x_account_id: string;
  x_signature?: string;
  x_result?: string;
  x_timestamp?: string;
  x_message?: string;
}

export function validateJumpsellerSignature(
  params: JumpsellerParams
): boolean {
  const { x_signature, ...otherParams } = params;

  if (!x_signature) {
    logger.warn('Missing x_signature parameter');
    return false;
  }

  const xParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(otherParams)) {
    if (key.startsWith('x_') && value !== undefined) {
      xParams[key] = String(value);
    }
  }


  const sortedKeys = Object.keys(xParams).sort();


  const concatenatedString = sortedKeys
    .map(key => `${key}+${xParams[key]}`)
    .join('+');

  logger.debug('HMAC validation string:', concatenatedString);

  const calculatedSignature = crypto
    .createHmac('sha256', process.env.SECRET_KEY!)
    .update(concatenatedString)
    .digest('hex');

  const isValid = calculatedSignature === x_signature;

  if (!isValid) {
    logger.warn('HMAC validation failed', {
      calculated: calculatedSignature,
      received: x_signature,
      concatenatedString
    });
  }

  return isValid;
}

export function generateJumpsellerSignature(
  params: Record<string, string | number>
): string {

  const xParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('x_') && key !== 'x_signature' && value !== undefined) {
      xParams[key] = String(value);
    }
  }

  const sortedKeys = Object.keys(xParams).sort();

  const concatenatedString = sortedKeys
    .map(key => `${key}+${xParams[key]}`)
    .join('+');

  logger.debug('Generating HMAC for string:', concatenatedString);

  return crypto
    .createHmac('sha256', process.env.SECRET_KEY!)
    .update(concatenatedString)
    .digest('hex');
}