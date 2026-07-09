import { getCurrencySymbol, formatCurrency, CURRENCIES } from './utils';

describe('Currency Utilities', () => {
  describe('getCurrencySymbol', () => {
    it('returns the correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('returns the correct symbol for INR', () => {
      expect(getCurrencySymbol('INR')).toBe('₹');
    });

    it('returns the correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('returns $ as default for unknown currency code', () => {
      expect(getCurrencySymbol('XYZ')).toBe('$');
    });

    it('is case-insensitive', () => {
      expect(getCurrencySymbol('inr')).toBe('₹');
      expect(getCurrencySymbol('Usd')).toBe('$');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toMatch(/1,234\.56/);
      expect(result).toContain('$');
    });

    it('formats INR correctly', () => {
      const result = formatCurrency(100000, 'INR');
      expect(result).toMatch(/1,00,000\.00/);
      expect(result).toContain('₹');
    });

    it('falls back to local toFixed formatting if Intl fails or throws', () => {
      const result = formatCurrency(123.456, 'INVALID_CURRENCY');
      expect(result).toBe('$123.46');
    });
  });

  describe('CURRENCIES list', () => {
    it('contains major world currencies', () => {
      const codes = CURRENCIES.map(c => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('INR');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('JPY');
    });
  });
});
