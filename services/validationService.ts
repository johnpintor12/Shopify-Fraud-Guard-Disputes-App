// src/services/validationService.ts
import { Order, DisputeStatus, ImportCategory } from '../types';
import { loadOrdersFromDb, saveOrdersToDb } from './storageService';

// --- RULES ENGINE ---
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidDate = (dateStr: string) => !isNaN(Date.parse(dateStr));
const hasNumbers = (str: string) => /\d/.test(str);

export const validateOrder = (order: Order): Order => {
  const errorReasons: string[] = [];

  // 1. ID Check
  if (!order.id || !hasNumbers(order.id)) {
    errorReasons.push("Invalid Order #");
  }

  // 2. Date Check
  if (!order.date || !isValidDate(order.date)) {
    errorReasons.push("Invalid Date");
  }

  // 3. Email Check
  if (!order.customer.email || !isValidEmail(order.customer.email)) {
    errorReasons.push("Invalid Email");
  }

  // 4. Tag Check
  if (!order.tags || order.tags.length === 0) {
    errorReasons.push("Missing Tags");
  }

  const isInvalid = errorReasons.length > 0;

  // LOGIC:
  // If it fails rules -> Move to INVALID
  // If it passes rules AND was previously INVALID -> Move to INTELLIGENT CATEGORY (Restore)
  // If it passes rules AND was NOT INVALID -> Keep existing category

  if (isInvalid) {
    return {
      ...order,
      import_category: 'INVALID',
      import_error: errorReasons.join(', '),
      isHighRisk: false, 
      disputeStatus: DisputeStatus.NONE 
    };
  } 
  
  if (!isInvalid && order.import_category === 'INVALID') {
    // It was broken, now it's fixed.
    // Try to determine where it belongs.
    const classification = determineCategoryFromTags(order.tags);

    // For AUTO-SCAN only: If we can't figure it out, default to RISK (Safe Fallback)
    // We don't want to throw errors during a background scan.
    const finalClass = classification || { 
        category: 'RISK', 
        status: DisputeStatus.NONE, 
        isHighRisk: true 
    };

    return {
      ...order,
      import_category: finalClass.category as ImportCategory,
      import_error: undefined,
      disputeStatus: finalClass.status,
      isHighRisk: finalClass.isHighRisk
    };
  }

  return order;
};

// --- NEW HELPERS ---

/**
 * Helper to figure out where an order belongs based on tags.
 * Returns NULL if it can't find a matching tag.
 */
const determineCategoryFromTags = (tags: string[]) => {
    const lowerTags = tags.map(t => t.toLowerCase());
    
    if (lowerTags.some(t => t.includes('won'))) {
        return { category: 'DISPUTE_WON', status: DisputeStatus.WON, isHighRisk: false };
    } 
    if (lowerTags.some(t => t.includes('lost'))) {
        return { category: 'DISPUTE_LOST', status: DisputeStatus.LOST, isHighRisk: false };
    } 
    if (lowerTags.some(t => t.includes('submitted') || t.includes('under review'))) {
        return { category: 'DISPUTE_SUBMITTED', status: DisputeStatus.UNDER_REVIEW, isHighRisk: true };
    } 
    if (lowerTags.some(t => t.includes('open') || t.includes('chargeback') || t.includes('dispute'))) {
        return { category: 'DISPUTE_OPEN', status: DisputeStatus.NEEDS_RESPONSE, isHighRisk: true };
    }
    // No specific category found
    return null;
};

/**
 * Applies manual edits to an order and immediately re-checks if it is valid.
 */
export const applyFixesAndRevalidate = (original: Order, updates: Partial<Order>): Order => {
    const merged = { 
        ...original, 
        ...updates,
        customer: {
            ...original.customer,
            ...(updates.customer || {})
        }
    };
    return validateOrder(merged);
};

/**
 * Forcefully moves an order out of Quarantine.
 * STRICT MODE: Throws an error if the tags don't clearly indicate where the order belongs.
 */
export const forceApproveOrder = (order: Order): Order => {
    const classification = determineCategoryFromTags(order.tags);

    // If we can't tell what this order is, FAIL and tell the user to fix it.
    if (!classification) {
        throw new Error(
            "Cannot determine order type. Please EDIT the tags to include 'won', 'lost', 'submitted', or 'chargeback' before marking as valid."
        );
    }

    return {
        ...order,
        import_category: classification.category as ImportCategory,
        disputeStatus: classification.status,
        isHighRisk: classification.isHighRisk,
        import_error: undefined
    };
};

export const revalidateDatabase = async (): Promise<number> => {
  const allOrders = await loadOrdersFromDb();
  if (allOrders.length === 0) return 0;

  let changesCount = 0;
  const validatedOrders = allOrders.map(order => {
    const validated = validateOrder(order);
    if (validated.import_category !== order.import_category || validated.import_error !== order.import_error) {
      changesCount++;
    }
    return validated;
  });

  if (changesCount > 0) {
    await saveOrdersToDb(validatedOrders);
  }

  return changesCount;
};
