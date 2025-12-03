// src/services/csvService.ts
import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus, ImportCategory } from '../types';

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

// Validation Helpers
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidDate = (dateStr: string) => !isNaN(Date.parse(dateStr));
const hasNumbers = (str: string) => /\d/.test(str); 

export const parseShopifyCSV = (csvText: string, category: ImportCategory = 'AUTO'): Order[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV file is empty or invalid.");

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => h.trim().toLowerCase());
  const getIndex = (name: string) => headers.indexOf(name.toLowerCase());
  
  const idx = {
    name: getIndex('Name'),
    createdAt: getIndex('Created at'),
    email: getIndex('Email'),
    financial: getIndex('Financial Status'),
    fulfillment: getIndex('Fulfillment Status'),
    total: getIndex('Total'),
    currency: getIndex('Currency'),
    tags: getIndex('Tags'),
    riskLevel: getIndex('Risk Level'),
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

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    const val = (index: number) => (row[index] ? row[index].trim() : '');

    // --- STRICT VALIDATION LOGIC ---
    const rawId = val(idx.name);
    const rawDate = val(idx.createdAt);
    const rawEmail = val(idx.email);
    const rawTags = val(idx.tags);

    const errorReasons: string[] = [];

    // 1. ID Check
    if (!rawId || !hasNumbers(rawId)) {
        errorReasons.push("Invalid Order #");
    }

    // 2. Date Check
    if (!rawDate || !isValidDate(rawDate)) {
        errorReasons.push("Invalid Date");
    }

    // 3. Email Check
    if (!rawEmail || !isValidEmail(rawEmail)) {
        errorReasons.push("Invalid Email");
    }

    // 4. Tag Check
    // FIX: If user manually selected a category (NOT Auto), we allow missing tags.
    if (category === 'AUTO' && (!rawTags || rawTags.trim().length === 0)) {
        errorReasons.push("Missing Tags");
    }

    const isRowInvalid = errorReasons.length > 0;
    const mapId = rawId || `BAD-ROW-${i}`;

    const extraData: Record<string, string> = {};
    rawHeaders.forEach((header, index) => {
        extraData[header] = val(index);
    });

    if (!orderMap.has(mapId)) {
      const tagsList = rawTags ? rawTags.split(',').map(t => t.trim().replace(/^"|"$/g, '')).filter(t => t) : [];
      const csvRisk = val(idx.riskLevel).toLowerCase();
      const isNativeHighRisk = csvRisk === 'high' || csvRisk === 'medium';

      let location = 'Unknown';
      const city = val(idx.shippingCity);
      const country = val(idx.shippingCountry);
      if (city || country) location = [city, country].filter(Boolean).join(', ');

      orderMap.set(mapId, {
        id: mapId,
        date: rawDate || 'N/A',
        email: rawEmail || 'N/A',
        financial: val(idx.financial),
        fulfillment: val(idx.fulfillment),
        total: parseFloat(val(idx.total) || '0'),
        currency: val(idx.currency) || 'USD',
        tags: tagsList,
        nativeRisk: isNativeHighRisk,
        customerName: val(idx.shippingName) || 'Unknown',
        location: location,
        shippingMethod: val(idx.shippingMethod),
        itemsCount: 0,
        isCancelled: !!val(idx.cancelReason),
        additional_data: extraData,
        isInvalid: isRowInvalid,
        importError: errorReasons.join(', ')
      });
    }

    const order = orderMap.get(mapId);
    const qty = parseInt(val(idx.lineItemQty) || '0');
    order.itemsCount += qty > 0 ? qty : 0;
  }

  return Array.from(orderMap.values()).map(o => {
    // --- DETERMINE CATEGORY FIRST (Even if Invalid) ---
    const lowerTags = o.tags.map((t: string) => t.toLowerCase());
    let disputeStatus = DisputeStatus.NONE;
    let isHighRisk = o.nativeRisk;
    let importCat = category; 
    let injectedTag = '';

    if (category === 'DISPUTE_OPEN') {
        disputeStatus = DisputeStatus.NEEDS_RESPONSE;
        isHighRisk = true; 
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
        // AUTO DETECT
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

    const finalTags = [...o.tags];
    if (injectedTag && !finalTags.includes(injectedTag)) {
        finalTags.push(injectedTag);
    }

    // --- NOW HANDLE INVALID STATE ---
    if (o.isInvalid) {
        return {
            id: o.id,
            date: o.date,
            created_at: new Date().toISOString(), 
            customer: {
                id: o.email,
                name: o.customerName,
                email: o.email,
                location: o.location,
                ordersCount: 0
            },
            channel: 'Import Error',
            total: o.total,
            currency: o.currency,
            paymentStatus: PaymentStatus.PENDING,
            fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
            itemsCount: o.itemsCount,
            deliveryStatus: DeliveryStatus.NO_STATUS,
            deliveryMethod: 'Unknown',
            tags: finalTags,
            isHighRisk: false,
            disputeStatus: DisputeStatus.NONE,
            import_category: 'INVALID',
            
            // KEY CHANGE: Save the calculated category here!
            original_category: importCat, 
            
            import_error: o.importError, 
            additional_data: o.additional_data
        };
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
      tags: finalTags,
      isHighRisk: isHighRisk,
      risk_category: isHighRisk ? 'High Risk' : 'Normal',
      disputeStatus: disputeStatus,
      disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review CSV Data' : undefined,
      import_category: importCat,
      additional_data: o.additional_data
    };
  });
};
