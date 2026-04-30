/**
 * Source-of-truth pricing for per-course one-time purchases.
 * Mirrors COURSE_PRICES in api/guidian/routers/billing.py — keep in sync.
 */
export const COURSE_PRICES: Record<string, { amount: number; label: string }> = {
  "nmls-8hr-safe-act-ce": { amount: 4900, label: "NMLS 8-Hour SAFE Act CE" },
  "certified-home-inspector-100hr": { amount: 19900, label: "Certified Home Inspector — 100-Hour Course" },
  "tx-home-inspector-ce": { amount: 4900, label: "TX Home Inspector CE" },
  "fl-real-estate-ethics": { amount: 3900, label: "FL Real Estate Ethics CE" },
  "tx-real-estate-ethics": { amount: 3900, label: "TX Real Estate Ethics CE" },
  "nc-real-estate-annual-update": { amount: 3900, label: "NC Real Estate Annual Update" },
  "fl-fair-housing": { amount: 3900, label: "FL Fair Housing CE" },
  "ga-real-estate-ce-36hr": { amount: 4900, label: "GA Real Estate CE" },
  "fl-general-contractor-ce-14hr": { amount: 3900, label: "FL General Contractor CE" },
  "fl-insurance-adjuster-ce-24hr": { amount: 4900, label: "FL Insurance Adjuster CE" },
  "ohio-real-estate-ce": { amount: 3900, label: "OH Real Estate CE" },
  "fl-mortgage-broker-ce": { amount: 3900, label: "FL Mortgage Broker CE" },
};

export const DEFAULT_COURSE_PRICE = 3900;

export const PRO_PRICE_CENTS = 1900;

export function priceForSlug(slug: string | null | undefined): number {
  if (!slug) return DEFAULT_COURSE_PRICE;
  return COURSE_PRICES[slug]?.amount ?? DEFAULT_COURSE_PRICE;
}

export function formatPriceUSD(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}
