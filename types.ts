// src/types.ts
export enum PaymentStatus {
  PAID = 'Paid',
  PENDING = 'Pending',
  REFUNDED = 'Refunded',
  VOIDED = 'Voided',
  PARTIALLY_REFUNDED = 'Partially refunded'
}

export enum FulfillmentStatus {
  FULFILLED = 'Fulfilled',
  UNFULFILLED = 'Unfulfilled',
  PARTIAL = 'Partial',
  NULL = 'Unfulfilled'
}

export enum DeliveryStatus {
  DELIVERED = 'Delivered',
  IN_TRANSIT = 'In transit',
  NO_STATUS = ''
}

export enum DisputeStatus {
  NONE = 'None',
  NEEDS_RESPONSE = 'Needs Response',
  UNDER_REVIEW = 'Under Review',
  WON = 'Won',
  LOST = 'Lost'
}

export type TabType = 'RISK' | 'DISPUTES' | 'HISTORY' | 'ALL';

export type ImportCategory = 'AUTO' | 'RISK' | 'DISPUTE_OPEN' | 'DISPUTE_WON' | 'DISPUTE_LOST';

export interface Customer {
  id: string;
  name: string;
  email: string;
  location: string;
  ordersCount: number;
  // Added optional fields for better type safety
  first_name?: string;
  last_name?: string;
}

export interface SavedDispute {
  id: string;
  order_id: string;
  status: string;
  rebuttal_text: string;
  created_at: string;
}

export interface Order {
  id: string; 
  date: string; // Display string (e.g. "Nov 23")
  customer: Customer;
  channel: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  itemsCount: number;
  deliveryStatus: DeliveryStatus;
  deliveryMethod: string;
  tags: string[];
  isHighRisk: boolean;
  disputeStatus: DisputeStatus;
  disputeDeadline?: string;
  
  // Database/Optional fields enabling strict typing
  savedDispute?: SavedDispute; 
  created_at?: string; // Raw timestamp
  currency?: string;
  source_name?: string;
  risk_category?: string;
  import_category?: string;
}

export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
  useProxy?: boolean;
}
