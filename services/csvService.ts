import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus, ImportCategory } from '../types';

// Helper to handle CSV lines with commas inside quotes
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Toggle quote state
      if (inQuotes && line[i + 1] === '"') {
        // Handle escaped quote ("")
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Value separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

export const parseShopifyCSV = (csvText: string, category: ImportCategory = 'AUTO'): Order[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV file is empty or invalid.");

  // Normalize headers to lowercase to avoid casing issues
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const getIndex = (name: string) => headers.indexOf(name.toLowerCase());
  
  // Map standard Shopify export columns
  const idx = {
    name: getIndex('Name'),
    createdAt: getIndex('Created at'),
    email: getIndex('Email'),
    financial: getIndex('Financial Status'),
    fulfillment: getIndex('Fulfillment Status'),
    total: getIndex('Total'),
    tags: getIndex('Tags'),
    shippingName: getIndex('Shipping Name'),
    shippingCity: getIndex('Shipping City'),
    shippingProvince: getIndex('Shipping Province'),
    shippingCountry: getIndex('Shipping Country'),
    shippingMethod: getIndex('Shipping Method'),
    lineItemQty: getIndex('Lineitem quantity'),
    cancelReason: getIndex('Cancelled at'),
  };

  // Validate critical columns
  if (idx.name === -1) throw new Error("Invalid CSV: Missing 'Name' column.");

  const orderMap = new Map<string, any>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    
    // Clean string helper
    const val = (index: number) => (row[index] ? row[index].trim() : '');

    const id = val(idx.name);
    // Skip empty rows or rows without ID
    if (!id) continue;

    // Use a Map to group line items into single orders
    if (!orderMap.has(id)) {
      const tagsString = val(idx.tags);
      const tagsList = tagsString.split(',').map(t => t.trim()).filter(t => t);
      const shippingCity = val(idx.shippingCity);
      const shippingProv = val(idx.shippingProvince);
      const shippingCountry = val(idx.shippingCountry);

      let location = 'Unknown';
      if (shippingCity || shippingProv || shippingCountry) {
        location = [shippingCity, shippingProv, shippingCountry].filter(Boolean).join(', ');
      }

      orderMap.set(id, {
        id,
        date: val(idx.createdAt),
        email: val(idx.email),
        financial: val(idx.financial),
        fulfillment: val(idx.fulfillment),
        total: parseFloat(val(idx.total) || '0'),
        tags: tagsList,
        customerName: val(idx.shippingName) || 'Guest',
        location: location,
        shippingMethod: val(idx.shippingMethod),
        itemsCount: 0,
        isCancelled: !!val(idx.cancelReason),
      });
    }

    // Accumulate items count
    const order = orderMap.get(id);
    const qty = parseInt(val(idx.lineItemQty) || '0');
    order.itemsCount += qty > 0 ? qty : 0;
  }

  // Convert map to Order objects
  return Array.from(orderMap.values()).map(o => {
    // Logic for Risk/Disputes based on tags OR Category Override
    const lowerTags = o.tags.map((t: string) => t.toLowerCase());
    
    let disputeStatus = DisputeStatus.NONE;
    let isHighRisk = false;

    // --- LOGIC: Apply Overrides based on User Selection ---
    if (category === 'DISPUTE_OPEN') {
        disputeStatus = DisputeStatus.NEEDS_RESPONSE;
        isHighRisk = true; // Disputes are inherently high risk
    } else if (category === 'DISPUTE_WON') {
        disputeStatus = DisputeStatus.WON;
    } else if (category === 'DISPUTE_LOST') {
        disputeStatus = DisputeStatus.LOST;
    } else if (category === 'RISK') {
        isHighRisk = true;
    } else {
        // --- AUTO MODE (Default) ---
        if (lowerTags.some((t: string) => t.includes('won'))) {
            disputeStatus = DisputeStatus.WON;
        } else if (lowerTags.some((t: string) => t.includes('lost'))) {
            disputeStatus = DisputeStatus.LOST;
        } else if (lowerTags.some((t: string) => t.includes('chargeback') || t.includes('dispute'))) {
            if (lowerTags.some((t: string) => t.includes('submitted') || t.includes('review'))) {
                disputeStatus = DisputeStatus.UNDER_REVIEW;
            } else {
                disputeStatus = DisputeStatus.NEEDS_RESPONSE;
            }
        }
        isHighRisk = lowerTags.some((t: string) => t.includes('fraud') || t.includes('high-risk') || t.includes('risk')) || o.isCancelled;
    }

    // Explicit Risk override check (if they selected RISK category, ensure it stays true even if auto logic ran)
    if (category === 'RISK') isHighRisk = true;

    return {
      id: o.id,
      date: new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customer: {
        id: o.email,
        name: o.customerName,
        email: o.email,
        location: o.location,
        ordersCount: 1 // History is not available in single order export
      },
      channel: 'CSV Import',
      total: o.total,
      paymentStatus: mapFinancialStatus(o.financial),
      fulfillmentStatus: mapFulfillmentStatus(o.fulfillment),
      itemsCount: o.itemsCount,
      deliveryStatus: o.fulfillment?.toLowerCase() === 'fulfilled' ? DeliveryStatus.DELIVERED : DeliveryStatus.NO_STATUS,
      deliveryMethod: o.shippingMethod,
      tags: o.tags,
      isHighRisk: isHighRisk,
      disputeStatus: disputeStatus,
      disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review Data' : undefined
    };
  });
};

const mapFinancialStatus = (status: string): PaymentStatus => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'paid') return PaymentStatus.PAID;
  if (s === 'pending') return PaymentStatus.PENDING;
  if (s === 'refunded') return PaymentStatus.REFUNDED;
  if (s === 'partially_refunded' || s === 'partially refunded') return PaymentStatus.PARTIALLY_REFUNDED;
  if (s === 'voided') return PaymentStatus.VOIDED;
  return PaymentStatus.PENDING;
};

const mapFulfillmentStatus = (status: string): FulfillmentStatus => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'fulfilled') return FulfillmentStatus.FULFILLED;
  if (s === 'partial') return FulfillmentStatus.PARTIAL;
  if (s === 'unfulfilled') return FulfillmentStatus.UNFULFILLED;
  return FulfillmentStatus.UNFULFILLED;
};
