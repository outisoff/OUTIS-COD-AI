import type { Charge, ChargeFrequency } from '@/hooks/useCharges';

/**
 * Compute the number of occurrences of a recurring charge between two dates
 * (inclusive on the start date, capped by charge_date_to if set).
 *
 * For non-recurring frequencies (one_time, per_order), returns 1 if the
 * charge_date falls within the range, otherwise 0.
 */
export function getChargeOccurrences(
  charge: Charge,
  rangeFrom?: Date,
  rangeTo?: Date,
  /**
   * Optional resolver returning the number of qualifying orders for a
   * "per_order" charge (filtered by the charge's product_id / store_id).
   * When provided, "per_order" returns this count instead of 1.
   */
  perOrderResolver?: (charge: Charge) => number
): number {
  const start = new Date(charge.charge_date + 'T00:00:00');
  // Effective end = min(today, charge_date_to, rangeTo)
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let end = new Date(today);
  if (charge.charge_date_to) {
    const dto = new Date(charge.charge_date_to + 'T23:59:59');
    if (dto < end) end = dto;
  }
  if (rangeTo) {
    const rt = new Date(rangeTo);
    rt.setHours(23, 59, 59, 999);
    if (rt < end) end = rt;
  }

  // Effective start = max(charge.charge_date, rangeFrom)
  let effStart = new Date(start);
  if (rangeFrom) {
    const rf = new Date(rangeFrom);
    rf.setHours(0, 0, 0, 0);
    if (rf > effStart) effStart = rf;
  }

  if (end < effStart) return 0;

  const freq: ChargeFrequency = charge.frequency || 'one_time';

  if (freq === 'per_order' || freq === 'per_product') {
    // Per-order / per-product frequency: number of qualifying orders or
    // total product units sold in the active window. The resolver is
    // responsible for applying the date range and the charge's
    // product_id / store_id linkage and dispatching on frequency.
    if (end < effStart) return 0;
    if (perOrderResolver) return perOrderResolver(charge);
    return 0;
  }

  if (freq === 'one_time') {
    // If a charge_date_to is set, treat the amount as spread linearly over
    // [charge_date, charge_date_to] and return the fraction that overlaps
    // [effStart, end]. Otherwise count once if the single date is in range.
    if (charge.charge_date_to) {
      const spanStart = new Date(charge.charge_date + 'T00:00:00');
      const spanEnd = new Date(charge.charge_date_to + 'T23:59:59');
      const totalMs = spanEnd.getTime() - spanStart.getTime();
      if (totalMs <= 0) {
        // Same-day: count once if in range
        if (effStart <= spanStart && spanStart <= end) return 1;
        return 0;
      }
      const overlapStart = effStart > spanStart ? effStart : spanStart;
      const overlapEnd = end < spanEnd ? end : spanEnd;
      const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
      if (overlapMs <= 0) return 0;
      return overlapMs / totalMs;
    }
    if (start > end) return 0;
    if (rangeFrom) {
      const rf = new Date(rangeFrom);
      rf.setHours(0, 0, 0, 0);
      if (start < rf) return 0;
    }
    return 1;
  }

  // For recurring frequencies, each occurrence covers a period
  // [occurrence, nextOccurrence). Pro-rate by the fraction of that period
  // overlapping [effStart, end].
  let total = 0;
  const cursor = new Date(start);
  let safety = 0;
  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const periodEnd = new Date(cursor);
    if (freq === 'weekly') periodEnd.setDate(periodEnd.getDate() + 7);
    else if (freq === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (freq === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else break;

    const periodMs = periodEnd.getTime() - periodStart.getTime();
    if (periodMs > 0) {
      const oStart = effStart > periodStart ? effStart : periodStart;
      const oEndCandidate = end < periodEnd ? end : periodEnd;
      const overlapMs = oEndCandidate.getTime() - oStart.getTime();
      if (overlapMs > 0) total += overlapMs / periodMs;
    }

    // Advance cursor to next occurrence
    if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else if (freq === 'yearly') cursor.setFullYear(cursor.getFullYear() + 1);
    else break;

    if (++safety > 10000) break;
  }
  return total;
}

/**
 * Total amount accrued by a charge over a date range, taking recurrence
 * into account: amount × occurrences.
 */
export function getChargeAccruedAmount(
  charge: Charge,
  rangeFrom?: Date,
  rangeTo?: Date,
  perOrderResolver?: (charge: Charge) => number
): number {
  return Number(charge.amount) * getChargeOccurrences(charge, rangeFrom, rangeTo, perOrderResolver);
}
