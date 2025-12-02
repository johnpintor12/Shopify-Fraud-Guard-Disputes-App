import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus } from '../types';

export const parseShopifyCSV = (csvText: string): Order[] => {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

  const getIndex = (name: string) => headers.indexOf(name);
  
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
    cancelReason: getIndex('Cancelled at'), // If cancelled_at exists, we check headers for cancel reason or infer
  };

  // Group rows by Order Name (ID)
  const orderMap = new Map<string, any>();

  for (let i = 1; i < lines.length; i++) {
    // Handle split lines (basic CSV parsing, assuming no commas in quoted fields for simplicity in this demo)
    // For production, a robust library like PapaParse is recommended.
    // Here we use a simple split but regex to ignore commas inside quotes
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    
    if (!row || row.length < headers.length) continue;

    const clean = (val: string) => val ? val.replace(/^"|"$/g, '').trim() : '';

    const id = clean(row[idx.name]);
    if (!id) continue;

    if (!orderMap.has(id)) {
      orderMap.set(id, {
        id,
        date: clean(row[idx.createdAt]),
        email: clean(row[idx.email]),
        financial: clean(row[idx.financial]),
        fulfillment: clean(row[idx.fulfillment]),
        total: parseFloat(clean(row[idx.total]) || '0'),
        tags: clean(row[idx.tags]),
        shippingName: clean(row[idx.shippingName]),
        shippingLocation: `${clean(row[idx.shippingCity])}, ${clean(row[idx.shippingProvince])}, ${clean(row[idx.shippingCountry])}`,
        shippingMethod: clean(row[idx.shippingMethod]),
        itemsCount: 0,
        isCancelled: !!clean(row[idx.cancelReason]),
      });
    }

    // Accumulate items
    const order = orderMap.get(id);
    order.itemsCount += parseInt(clean(row[idx.lineItemQty]) || '0');
  }

  // Convert map to Order[]
  return Array.from(orderMap.values()).map(o => {
    const tagsList = o.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
    
    // Logic for Risk/Disputes based on tags
    const lowerTags = tagsList.map((t: string) => t.toLowerCase());
    
    // Determine Dispute Status
    let disputeStatus = DisputeStatus.NONE;
    if (lowerTags.some((t: string) => t.includes('won'))) disputeStatus = DisputeStatus.WON;
    else if (lowerTags.some((t: string) => t.includes('lost'))) disputeStatus = DisputeStatus.LOST;
    else if (lowerTags.some((t: string) => t.includes('chargeback') || t.includes('dispute'))) {
        if (lowerTags.some((t: string) => t.includes('submitted') || t.includes('review'))) {
            disputeStatus = DisputeStatus.UNDER_REVIEW;
        } else {
            disputeStatus = DisputeStatus.NEEDS_RESPONSE;
        }
    }

    // Determine Risk
    // In CSV, we rely heavily on tags or if we assume all exported orders are high risk (user context)
    const isHighRisk = lowerTags.some((t: string) => t.includes('fraud') || t.includes('risk')) || o.isCancelled;

    return {
      id: o.id,
      date: new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customer: {
        id: o.email,
        name: o.shippingName || 'Guest',
        email: o.email,
        location: o.shippingLocation.replace(/^, /, '').replace(/, $/, '') || 'Unknown',
        ordersCount: 1 // CSV doesn't provide history count easily
      },
      channel: 'Imported',
      total: o.total,
      paymentStatus: mapFinancialStatus(o.financial),
      fulfillmentStatus: mapFulfillmentStatus(o.fulfillment),
      itemsCount: o.itemsCount,
      deliveryStatus: o.fulfillment === 'fulfilled' ? DeliveryStatus.DELIVERED : DeliveryStatus.NO_STATUS,
      deliveryMethod: o.shippingMethod,
      tags: tagsList,
      isHighRisk: isHighRisk,
      disputeStatus: disputeStatus,
      disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review CSV Data' : undefined
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
