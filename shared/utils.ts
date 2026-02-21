// Utility functions for customer types and pricing

export const CUSTOMER_TYPES = {
  RESELLER: "дилер",
  CORPORATE: "корпоративный",
  GOVERNMENT: "гос. учреждение",
} as const;

export type CustomerType = typeof CUSTOMER_TYPES[keyof typeof CUSTOMER_TYPES];

/**
 * Calculate the display price based on customer type
 * Reseller (дилер): Base price
 * Corporate (корпоративный): Base price + corporateMarkupPercentage%, rounded up to nearest 100
 * Government (гос. учреждение): Base price + governmentMarkupPercentage%, rounded up to nearest 100
 */
export function calculatePrice(
  basePrice: number, 
  customerType: string, 
  corporateMarkupPercentage: number = 10,
  governmentMarkupPercentage: number = 10
): number {
  if (customerType === CUSTOMER_TYPES.RESELLER) {
    return basePrice;
  }
  
  let markupPercentage = 0;
  if (customerType === CUSTOMER_TYPES.CORPORATE) {
    markupPercentage = corporateMarkupPercentage;
  } else if (customerType === CUSTOMER_TYPES.GOVERNMENT) {
    markupPercentage = governmentMarkupPercentage;
  }
  
  // Apply markup and round up to nearest 100
  const priceWithMarkup = basePrice * (1 + markupPercentage / 100);
  return Math.ceil(priceWithMarkup / 100) * 100;
}

/**
 * Get display name for customer type
 */
export function getCustomerTypeLabel(type: string): string {
  switch (type) {
    case CUSTOMER_TYPES.RESELLER:
      return "Дилер";
    case CUSTOMER_TYPES.CORPORATE:
      return "Корпоративный";
    case CUSTOMER_TYPES.GOVERNMENT:
      return "Гос. учреждение";
    default:
      return type;
  }
}
