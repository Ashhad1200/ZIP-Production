/**
 * Calculate raw material consumption from production data.
 * gramsConsumed = gramsPerMeter × metersProduced
 * bagsConsumed = gramsConsumed / bagWeightGrams
 */
export function calculateRawMaterialConsumption(
  gramsPerMeter: number,
  metersProduced: number,
  bagWeightGrams: number
): { gramsConsumed: number; bagsConsumed: number } {
  const gramsConsumed = gramsPerMeter * metersProduced;
  const bagsConsumed = gramsConsumed / bagWeightGrams;
  return {
    gramsConsumed: Math.round(gramsConsumed * 100) / 100,
    bagsConsumed: Math.round(bagsConsumed * 10000) / 10000,
  };
}

/**
 * Detect electricity consumption discrepancy.
 * expectedUnits = (machine.kwhRating × shiftHours) × (metersProduced / machine.expectedOutputPerShift)
 * deviationPercent = |actualUnits - expectedUnits| / expectedUnits × 100
 */
export function detectElectricityDiscrepancy(
  actualUnits: number,
  machineKwhRating: number,
  shiftHours: number,
  metersProduced: number,
  expectedOutputPerShift: number,
  thresholdPercent: number
): { isDiscrepancy: boolean; deviationPercent: number; expectedUnits: number; notes: string } {
  const productionRatio = metersProduced / expectedOutputPerShift;
  const expectedUnits = machineKwhRating * shiftHours * productionRatio;

  if (expectedUnits === 0) {
    return {
      isDiscrepancy: false,
      deviationPercent: 0,
      expectedUnits: 0,
      notes: 'Expected output is zero; cannot calculate discrepancy.',
    };
  }

  const deviationPercent = Math.abs(actualUnits - expectedUnits) / expectedUnits * 100;
  const isDiscrepancy = deviationPercent > thresholdPercent;

  return {
    isDiscrepancy,
    deviationPercent: Math.round(deviationPercent * 100) / 100,
    expectedUnits: Math.round(expectedUnits * 100) / 100,
    notes: isDiscrepancy
      ? `Electricity deviation ${deviationPercent.toFixed(1)}% exceeds ${thresholdPercent}% threshold. Expected: ${expectedUnits.toFixed(1)} units, Actual: ${actualUnits} units.`
      : '',
  };
}

/**
 * Calculate order fulfillment percentage.
 */
export function calculateFulfillmentPercent(
  metersDelivered: number,
  metersOrdered: number
): number {
  if (metersOrdered === 0) return 100;
  return Math.round((metersDelivered / metersOrdered) * 10000) / 100;
}
