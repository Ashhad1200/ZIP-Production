import prisma from '../config/database';

/**
 * Generate sequential numbers for gate passes, orders, vouchers, journal entries.
 * Format: PREFIX-YYYY-NNNNN (e.g., GP-2025-00001)
 */
export async function generateSequenceNumber(
  prefix: string,
  model: 'gatePass' | 'order' | 'voucher' | 'journalEntry' | 'salesReturn'
): Promise<string> {
  const year = new Date().getFullYear();
  const yearStr = String(year);
  const pattern = `${prefix}-${yearStr}-`;

  let lastNumber = 0;

  if (model === 'gatePass') {
    const last = await prisma.gatePass.findFirst({
      where: { gatePassNumber: { startsWith: pattern } },
      orderBy: { gatePassNumber: 'desc' },
      select: { gatePassNumber: true },
    });
    if (last) {
      lastNumber = parseInt(last.gatePassNumber.split('-').pop() || '0', 10);
    }
  } else if (model === 'order') {
    const last = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: pattern } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    if (last) {
      lastNumber = parseInt(last.orderNumber.split('-').pop() || '0', 10);
    }
  } else if (model === 'voucher') {
    const last = await prisma.voucher.findFirst({
      where: { voucherNumber: { startsWith: pattern } },
      orderBy: { voucherNumber: 'desc' },
      select: { voucherNumber: true },
    });
    if (last) {
      lastNumber = parseInt(last.voucherNumber.split('-').pop() || '0', 10);
    }
  } else if (model === 'journalEntry') {
    const last = await prisma.journalEntry.findFirst({
      where: { entryNumber: { startsWith: pattern } },
      orderBy: { entryNumber: 'desc' },
      select: { entryNumber: true },
    });
    if (last) {
      lastNumber = parseInt(last.entryNumber.split('-').pop() || '0', 10);
    }
  } else if (model === 'salesReturn') {
    const last = await prisma.salesReturn.findFirst({
      where: { returnNumber: { startsWith: pattern } },
      orderBy: { returnNumber: 'desc' },
      select: { returnNumber: true },
    });
    if (last) {
      lastNumber = parseInt(last.returnNumber.split('-').pop() || '0', 10);
    }
  }

  const nextNumber = String(lastNumber + 1).padStart(5, '0');
  return `${pattern}${nextNumber}`;
}
