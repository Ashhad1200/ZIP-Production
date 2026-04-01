/**
 * Format paisa (integer) to PKR display string with South Asian grouping.
 * e.g. 1234567890 paisa → "Rs 1,23,45,678.90"
 */
export function formatPaisaToRupees(
  paisa: number | bigint,
  options?: { useShorthand?: boolean },
): string {
  const num = Number(paisa);
  const rupees = num / 100;

  if (options?.useShorthand) {
    if (rupees >= 1_00_00_000) {
      return `Rs ${(rupees / 1_00_00_000).toFixed(2)}Cr`;
    }
    if (rupees >= 1_00_000) {
      return `Rs ${(rupees / 1_00_000).toFixed(2)}L`;
    }
    if (rupees >= 1_000) {
      return `Rs ${(rupees / 1_000).toFixed(2)}K`;
    }
  }

  const [intPart, decPart] = rupees.toFixed(2).split('.');
  const formatted = applySouthAsianGrouping(intPart!);
  return `Rs ${formatted}.${decPart}`;
}

/** Apply South Asian grouping: 1,23,45,678 */
function applySouthAsianGrouping(intStr: string): string {
  const isNegative = intStr.startsWith('-');
  const digits = isNegative ? intStr.slice(1) : intStr;

  if (digits.length <= 3) {
    return intStr;
  }

  const lastThree = digits.slice(-3);
  const remaining = digits.slice(0, -3);
  const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${isNegative ? '-' : ''}${grouped},${lastThree}`;
}

/**
 * Parse user-entered display string to paisa.
 * Accepts: "2,00,000", "2L", "1.5Cr", "50000", "Rs 1,234.56"
 */
export function parseDisplayToPaisa(input: string): number {
  let cleaned = input
    .replace(/Rs\.?\s*/i, '')
    .replace(/,/g, '')
    .trim();

  // Handle shorthand suffixes
  const crMatch = cleaned.match(/^(-?\d+\.?\d*)\s*[Cc][Rr]?$/);
  if (crMatch) {
    return Math.round(parseFloat(crMatch[1]!) * 1_00_00_000 * 100);
  }

  const lMatch = cleaned.match(/^(-?\d+\.?\d*)\s*[Ll]$/);
  if (lMatch) {
    return Math.round(parseFloat(lMatch[1]!) * 1_00_000 * 100);
  }

  const kMatch = cleaned.match(/^(-?\d+\.?\d*)\s*[Kk]$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]!) * 1_000 * 100);
  }

  // Plain number (already in rupees)
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');
  const rupees = parseFloat(cleaned);
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}
