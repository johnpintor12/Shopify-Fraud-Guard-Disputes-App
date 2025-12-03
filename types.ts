// src/types.ts
// ... (keep existing enums and interfaces) ...

export interface Customer {
  id: string;
  name: string;
  email: string;
  location: string;
  ordersCount: number;
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

// NEW: Alert Interface for Database
export interface Alert {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: 'success' | 'error';
  details?: string;
  read: boolean;
  created_at: string;
}

export interface Order {
  // ... (keep existing Order fields) ...
  id: string; 
  date: string;
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
  savedDispute?: SavedDispute; 
  created_at?: string;
  currency?: string;
  source_name?: string;
  risk_category?: string;
  import_category?: string;
  additional_data?: Record<string, any>;
}

export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
  useProxy?: boolean;
}
