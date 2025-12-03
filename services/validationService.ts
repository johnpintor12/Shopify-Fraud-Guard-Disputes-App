import { Order, DisputeStatus, ImportCategory } from '../types';
import { loadOrdersFromDb, saveOrdersToDb } from './storageService';

// --- RULES ENGINE ---
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidDate = (dateStr: string) => !isNaN(Date.parse(dateStr));
const hasNumbers = (str: string) => /\d/.test(str);

export const validateOrder = (order: Order): Order => {
  const errorReasons: string[] = [];

  if (!order.id || !hasNumbers(order.id)) errorReasons.push("Invalid Order #");
  if (!order.date || !isValidDate(order.date)) errorReasons.push("Invalid Date");
  if (!order.customer.email || !isValidEmail(order.customer.email)) errorReasons.push("Invalid Email");
  if (!order.tags || order.tags.length === 0) errorReasons.push("Missing Tags");

  const isInvalid = errorReasons.length > 0;

  if (isInvalid) {
    // Preserve original category if it exists, so we don't lose track of what it was
    const prevCategory = order.import_category !== 'INVALID' ? order.import_category : order.original_category;

    return {
      ...order,
      import_category: 'INVALID',
      original_category: prevCategory,
      import_error: errorReasons.join(', '),
      isHighRisk: false, 
      disputeStatus: DisputeStatus.NONE 
    };
  } 
  
  if (!isInvalid && order.import_category === 'INVALID') {
    // RECOVERY LOGIC: It was broken, now it is fixed.
    
    // 1. Try to use the remembered original category
    let targetCategory = order.original_category;
    let classification = null;

    if (targetCategory && targetCategory !== 'AUTO' && targetCategory !== 'INVALID') {
        // Restore based on saved intent
        if (targetCategory === 'DISPUTE_WON') classification = { category: 'DISPUTE_WON', status: DisputeStatus.WON, isHighRisk: false };
        else if (targetCategory === 'DISPUTE_LOST') classification = { category: 'DISPUTE_LOST', status: DisputeStatus.LOST, isHighRisk: false };
        else if (targetCategory === 'DISPUTE_SUBMITTED') classification = { category: 'DISPUTE_SUBMITTED', status: DisputeStatus.UNDER_REVIEW, isHighRisk: true };
        else if (targetCategory === 'DISPUTE_OPEN') classification = { category: 'DISPUTE_OPEN', status: DisputeStatus.NEEDS_RESPONSE, isHighRisk: true };
        else classification = { category: 'RISK', status: DisputeStatus.NONE, isHighRisk: true };
    } else {
        // 2. Fallback to tags if no memory
        const tagClass = determineCategoryFromTags(order.tags);
        
        // 3. Last resort fallback for AUTO-SCAN (Default to Risk to avoid crash)
        classification = tagClass || { category: 'RISK', status: DisputeStatus.NONE, isHighRisk: true };
    }

    return {
      ...order,
      import_category: classification.category as ImportCategory,
      import_error: undefined,
      disputeStatus: classification.status,
      isHighRisk: classification.isHighRisk
    };
  }

  return order;
};

// --- HELPERS ---

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
    return null;
};

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

export const forceApproveOrder = (order: Order): Order => {
    // STRICT CHECK: Manual approval must have a valid category
    const classification = determineCategoryFromTags(order.tags);

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
