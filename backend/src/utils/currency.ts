/**
 * Format paisa (integer) to PKR display string with South Asian grouping.
 * Examples:
 *   formatPaisaToRupees(5500000n) → "PKR 55,000.00"
 *   formatPaisaToRupees(20000000n) → "PKR 2,00,000.00"
 *   formatPaisaToRupees(1250000000n, { useShorthand: true }) → "PKR 1.25Cr"
 */
export function formatPaisaToRupees(
  paisa: bigint | number,
  options?: { useShorthand?: boolean }
): string {
  const paisaNum = typeof paisa === 'bigint' ? Number(paisa) : paisa;
  const rupees = paisaNum / 100;

  if (options?.useShorthand) {
    return formatShorthand(rupees);
  }

  return `PKR ${formatWithSouthAsianGrouping(rupees)}`;
}

function formatShorthand(rupees: number): string {
  const absRupees = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';

  if (absRupees >= 10000000) {
    // Crores (1Cr = 10,000,000)
    return `${sign}PKR ${(absRupees / 10000000).toFixed(2)}Cr`;
  } else if (absRupees >= 100000) {
    // Lakhs (1L = 100,000)
    return `${sign}PKR ${(absRupees / 100000).toFixed(2)}L`;
  } else if (absRupees >= 1000) {
    return `${sign}PKR ${(absRupees / 1000).toFixed(2)}K`;
  }
  return `${sign}PKR ${absRupees.toFixed(2)}`;
}

function formatWithSouthAsianGrouping(rupees: number): string {
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);

  // Use Intl.NumberFormat with en-IN locale for South Asian grouping
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(absRupees);
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse a display string or shorthand back to paisa.
 * Accepts: "2,00,000", "2L", "1.5Cr", "55000", "55,000.00"
 */
export function parseDisplayToPaisa(input: string): bigint {
  let cleaned = input.replace(/PKR\s*/i, '').replace(/,/g, '').trim();

  if (cleaned.endsWith('Cr') || cleaned.endsWith('cr')) {
    const num = parseFloat(cleaned.replace(/Cr$/i, ''));
    return BigInt(Math.round(num * 10000000 * 100));
  }
  if (cleaned.endsWith('L') || cleaned.endsWith('l')) {
    const num = parseFloat(cleaned.replace(/L$/i, ''));
    return BigInt(Math.round(num * 100000 * 100));
  }
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    const num = parseFloat(cleaned.replace(/K$/i, ''));
    return BigInt(Math.round(num * 1000 * 100));
  }

  const num = parseFloat(cleaned);
  return BigInt(Math.round(num * 100));
}
