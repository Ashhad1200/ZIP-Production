import { formatPaisaToRupees, parseDisplayToPaisa } from '@/utils/currency';

describe('formatPaisaToRupees', () => {
  it('converts basic paisa to rupees', () => {
    expect(formatPaisaToRupees(100)).toBe('PKR 1.00');
  });

  it('handles zero', () => {
    expect(formatPaisaToRupees(0)).toBe('PKR 0.00');
  });

  it('handles bigint input', () => {
    expect(formatPaisaToRupees(5500000n)).toBe('PKR 55,000.00');
  });

  it('formats with South Asian grouping (lakhs/crores)', () => {
    // 12,34,567.89 rupees = 123456789 paisa
    expect(formatPaisaToRupees(123456789)).toBe('PKR 12,34,567.89');
  });

  it('handles large numbers (crores)', () => {
    // 20,00,000.00 rupees = 200000000 paisa
    expect(formatPaisaToRupees(20000000n)).toBe('PKR 2,00,000.00');
  });

  it('handles negative values', () => {
    expect(formatPaisaToRupees(-50000)).toBe('PKR -500.00');
  });

  it('handles billions of paisa', () => {
    // 10,00,00,000.00 rupees = 100000000000 paisa (1 arab)
    const result = formatPaisaToRupees(100000000000n);
    expect(result).toBe('PKR 1,00,00,00,000.00');
  });

  it('handles small amounts', () => {
    expect(formatPaisaToRupees(1)).toBe('PKR 0.01');
    expect(formatPaisaToRupees(99)).toBe('PKR 0.99');
  });

  describe('shorthand mode', () => {
    it('formats thousands with K suffix', () => {
      // 5000 rupees = 500000 paisa → 5000/1000 = 5.00K
      expect(formatPaisaToRupees(500000, { useShorthand: true })).toBe('PKR 5.00K');
    });

    it('formats lakhs with L suffix', () => {
      // 2,50,000 rupees = 25000000 paisa
      expect(formatPaisaToRupees(25000000, { useShorthand: true })).toBe('PKR 2.50L');
    });

    it('formats crores with Cr suffix', () => {
      // 1.25 crore rupees = 1,25,00,000 rupees = 1250000000 paisa
      expect(formatPaisaToRupees(1250000000n, { useShorthand: true })).toBe('PKR 1.25Cr');
    });

    it('formats small amounts without suffix', () => {
      expect(formatPaisaToRupees(50000, { useShorthand: true })).toBe('PKR 500.00');
    });
  });
});

describe('parseDisplayToPaisa', () => {
  it('parses plain number string', () => {
    expect(parseDisplayToPaisa('500')).toBe(50000n);
  });

  it('parses formatted rupee string', () => {
    expect(parseDisplayToPaisa('PKR 55,000.00')).toBe(5500000n);
  });

  it('parses South Asian grouped string', () => {
    expect(parseDisplayToPaisa('PKR 2,00,000.00')).toBe(20000000n);
  });

  it('parses crore shorthand', () => {
    expect(parseDisplayToPaisa('1.5Cr')).toBe(1500000000n);
  });

  it('parses lakh shorthand', () => {
    expect(parseDisplayToPaisa('2.5L')).toBe(25000000n);
  });

  it('parses K shorthand', () => {
    expect(parseDisplayToPaisa('5K')).toBe(500000n);
  });

  it('handles PKR prefix with shorthand', () => {
    expect(parseDisplayToPaisa('PKR 1.25Cr')).toBe(1250000000n);
  });

  it('handles case-insensitive suffixes', () => {
    expect(parseDisplayToPaisa('1.5cr')).toBe(1500000000n);
    expect(parseDisplayToPaisa('2.5l')).toBe(25000000n);
    expect(parseDisplayToPaisa('5k')).toBe(500000n);
  });

  it('round-trips with formatPaisaToRupees', () => {
    const original = 123456789n;
    const display = formatPaisaToRupees(original);
    const parsed = parseDisplayToPaisa(display);
    expect(parsed).toBe(original);
  });
});
