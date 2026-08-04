const VAT_MULTIPLIER = 1.22;

export type PricingMarkups = {
  upTo3: number;
  upTo6: number;
  upTo18: number;
  upTo30: number;
  over30: number;
};

export const DEFAULT_PRICING_MARKUPS: PricingMarkups = {
  upTo3: 70,
  upTo6: 60,
  upTo18: 50,
  upTo30: 40,
  over30: 30,
};

export function getMarkupRate(
  purchasePrice: number,
  markups: PricingMarkups = DEFAULT_PRICING_MARKUPS
): number {
  if (purchasePrice <= 3) return markups.upTo3 / 100;
  if (purchasePrice <= 6) return markups.upTo6 / 100;
  if (purchasePrice <= 18) return markups.upTo18 / 100;
  if (purchasePrice <= 30) return markups.upTo30 / 100;
  return markups.over30 / 100;
}

/** Prezzo di vendita IVA inclusa, arrotondato al decimo di euro. */
export function calculateSalePrice(
  purchasePrice: number,
  markups: PricingMarkups = DEFAULT_PRICING_MARKUPS
): number {
  const price = Number(purchasePrice || 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const gross = price * (1 + getMarkupRate(price, markups)) * VAT_MULTIPLIER;
  return Math.round((gross + Number.EPSILON) * 10) / 10;
}
