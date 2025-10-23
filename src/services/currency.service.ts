import logger from '../config/logger';

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

const mockExchangeRates: Record<string, Record<string, number>> = {
  USD: {
    ARS: 350.50,
    MXN: 17.25,
    CLP: 900.00,
    COP: 4100.00,
    USDT: 1.00,
  },
  ARS: {
    USD: 1 / 350.50,
    USDT: 1 / 350.50,
  },
  MXN: {
    USD: 1 / 17.25,
    USDT: 1 / 17.25,
  },
  CLP: {
    USD: 1 / 900.00,
    USDT: 1 / 900.00,
  },
  COP: {
    USD: 1 / 4100.00,
    USDT: 1 / 4100.00,
  },
};

export class CurrencyService {
  static async getExchangeRate(from: string, to: string): Promise<number> {
    logger.info(`Getting exchange rate from ${from} to ${to}`);

    if (from === to) {
      return 1;
    }

    const rate = mockExchangeRates[from]?.[to];
    if (rate) {
      logger.info(`Exchange rate ${from} -> ${to}: ${rate}`);
      return rate;
    }

    logger.warn(`No exchange rate found for ${from} -> ${to}, using default 1.0`);
    return 1.0;
  }

  static async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    logger.info(`Converted ${amount} ${fromCurrency} to ${convertedAmount.toFixed(2)} ${toCurrency}`);

    return Math.round(convertedAmount * 100) / 100;
  }

  static getSupportedCurrencies(): string[] {
    return ['USD', 'ARS', 'MXN', 'CLP', 'COP', 'USDT'];
  }

  static isValidCurrency(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }
}