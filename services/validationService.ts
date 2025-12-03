// src/services/validationService.ts
import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus } from '../types';
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
  // If it passes rules AND was previously INVALID -> Move to RISK (Safe default)
  // If it passes rules AND was NOT INVALID -> Keep existing category (Don't touch Won/Lost/Open)

  if (isInvalid) {
    return {
      ...order,
      import_category: 'INVALID',
      import_error: errorReasons.join(', '),
      isHighRisk: false, // Hide from risk tab
      disputeStatus: DisputeStatus.NONE // Hide from dispute tab
    };
  } 
  
  if (!isInvalid && order.import_category === 'INVALID') {
    // It was broken, now it's fixed. Restore to a safe bucket.
    return {
      ...order,
      import_category: 'RISK', // Default bucket for recovered items
      import_error: undefined,
      isHighRisk: true
    };
  }

  // Data is fine, leave it alone
  return order;
};

export const revalidateDatabase = async (): Promise<number> => {
  // 1. Load everything
  const allOrders = await loadOrdersFromDb();
  if (allOrders.length === 0) return 0;

  // 2. Run validation on everything
  let changesCount = 0;
  const validatedOrders = allOrders.map(order => {
    const validated = validateOrder(order);
    
    // Check if anything actually changed to avoid useless writes
    if (validated.import_category !== order.import_category || validated.import_error !== order.import_error) {
      changesCount++;
    }
    return validated;
  });

  // 3. Save back if changes found
  if (changesCount > 0) {
    await saveOrdersToDb(validatedOrders);
  }

  return changesCount;
};
