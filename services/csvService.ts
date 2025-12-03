// src/services/csvService.ts
import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus, ImportCategory } from '../types';

// Helper to handle CSV lines with commas inside quotes
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const mapFinancialStatus = (status: string): PaymentStatus => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'paid') return PaymentStatus.PAID;
  if (s === 'pending') return PaymentStatus.PENDING;
  if (s === 'refunded') return PaymentStatus.REFUNDED;
  if (s.includes('partially')) return PaymentStatus.PARTIALLY_REFUNDED;
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

export const parseShopifyCSV = (csvText: string, category: ImportCategory = 'AUTO'): Order[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV file is empty or invalid.");

  // Normalize headers
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const getIndex = (name: string) => headers.indexOf(name.toLowerCase());
  
  // Dynamic column mapping (handles standard export formats)
  const idx = {
    name: getIndex('Name'),
    createdAt: getIndex('Created at'),
    email: getIndex('Email'),
    financial: getIndex('Financial Status'),
    fulfillment: getIndex('Fulfillment Status'),
    total: getIndex('Total'),
    currency: getIndex('Currency'),
    tags: getIndex('Tags'),
    riskLevel: getIndex('Risk Level'), // New: Read native Shopify Risk Level
    shippingName: getIndex('Shipping Name'),
    shippingCity: getIndex('Shipping City'),
    shippingProvince: getIndex('Shipping Province'),
    shippingCountry: getIndex('Shipping Country'),
    shippingMethod: getIndex('Shipping Method'),
    lineItemQty: getIndex('Lineitem quantity'),
    cancelReason: getIndex('Cancelled at'),
  };

  if (idx.name === -1) throw new Error("Invalid CSV: Missing 'Name' column.");

  const orderMap = new Map<string, any>();

  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    const val = (index: number) => (row[index] ? row[index].trim() : '');

    const id = val(idx.name);
    if (!id) continue;

    // Group line items
    if (!orderMap.has(id)) {
      const tagsString = val(idx.tags);
      // Clean up tags (remove quotes/spaces)
      const tagsList = tagsString.split(',').map(t => t.trim().replace(/^"|"$/g, '')).filter(t => t);
      
      // Parse Risk Level from CSV (High/Medium/Low)
      const csvRisk = val(idx.riskLevel).toLowerCase();
      const isNativeHighRisk = csvRisk === 'high' || csvRisk === 'medium';

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
        currency: val(idx.currency) || 'USD',
        tags: tagsList,
        nativeRisk: isNativeHighRisk, // Store this to combine with override logic later
        customerName: val(idx.shippingName) || 'Guest',
        location: location,
        shippingMethod: val(idx.shippingMethod),
        itemsCount: 0,
        isCancelled: !!val(idx.cancelReason),
      });
    }

    const order = orderMap.get(id);
    const qty = parseInt(val(idx.lineItemQty) || '0');
    order.itemsCount += qty > 0 ? qty : 0;
  }

  // Convert to App Order Objects
  return Array.from(orderMap.values()).map(o => {
    const lowerTags = o.tags.map((t: string) => t.toLowerCase());
    
    let disputeStatus = DisputeStatus.NONE;
    let isHighRisk = o.nativeRisk; // Default to what the CSV says
    let importCat = category; 
    let injectedTag = '';

    // --- LOGIC: Apply Overrides based on User Selection ---
    
    // 1. Force Manual Categories (Overrides everything)
    if (category === 'DISPUTE_OPEN') {
        disputeStatus = DisputeStatus.NEEDS_RESPONSE;
        isHighRisk = true; // Disputes are inherently risk
        injectedTag = 'Import: Open Dispute';
    } else if (category === 'DISPUTE_SUBMITTED') {
        disputeStatus = DisputeStatus.UNDER_REVIEW;
        injectedTag = 'Import: Submitted';
    } else if (category === 'DISPUTE_WON') {
        disputeStatus = DisputeStatus.WON;
        injectedTag = 'Import: Won';
    } else if (category === 'DISPUTE_LOST') {
        disputeStatus = DisputeStatus.LOST;
        injectedTag = 'Import: Lost';
    } else if (category === 'RISK') {
        isHighRisk = true;
        injectedTag = 'Import: Fraud';
    } else {
        // 2. AUTO DETECT (Fallback if user selected 'Auto')
        // Only works if tags are actually present in the file
        
        if (lowerTags.some((t: string) => t.includes('won'))) {
            disputeStatus = DisputeStatus.WON;
            importCat = 'DISPUTE_WON';
        } else if (lowerTags.some((t: string) => t.includes('lost'))) {
            disputeStatus = DisputeStatus.LOST;
            importCat = 'DISPUTE_LOST';
        } else if (lowerTags.some((t: string) => t.includes('submitted') || t.includes('review'))) {
            disputeStatus = DisputeStatus.UNDER_REVIEW;
            importCat = 'DISPUTE_SUBMITTED';
        } else if (lowerTags.some((t: string) => t.includes('chargeback') || t.includes('dispute'))) {
            disputeStatus = DisputeStatus.NEEDS_RESPONSE;
            importCat = 'DISPUTE_OPEN';
            isHighRisk = true;
        } else if (lowerTags.some((t: string) => t.includes('fraud') || t.includes('risk') || t.includes('high'))) {
            isHighRisk = true;
            importCat = 'RISK';
        }
    }

    // INJECT TAG: Add a visual tag so the user knows why it's categorized this way
    // This solves the "inventory confusion" problem.
    const finalTags = [...o.tags];
    if (injectedTag && !finalTags.includes(injectedTag)) {
        finalTags.push(injectedTag);
    }

    return {
      id: o.id,
      date: new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      created_at: o.date,
      customer: {
        id: o.email,
        name: o.customerName,
        email: o.email,
        location: o.location,
        ordersCount: 1 
      },
      channel: 'CSV Import',
      total: o.total,
      currency: o.currency,
      paymentStatus: mapFinancialStatus(o.financial),
      fulfillmentStatus: mapFulfillmentStatus(o.fulfillment),
      itemsCount: o.itemsCount,
      deliveryStatus: o.fulfillment?.toLowerCase() === 'fulfilled' ? DeliveryStatus.DELIVERED : DeliveryStatus.NO_STATUS,
      deliveryMethod: o.shippingMethod,
      tags: finalTags, // Use the enhanced tags list
      isHighRisk: isHighRisk,
      risk_category: isHighRisk ? 'High Risk' : 'Normal',
      disputeStatus: disputeStatus,
      disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review CSV Data' : undefined,
      import_category: importCat
    };
  });
};
