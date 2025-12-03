// src/services/shopifyService.ts
import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus } from '../types';

interface ShopifyGraphQLResponse {
  data?: {
    orders: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          createdAt: string;
          riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
          displayFinancialStatus: string;
          displayFulfillmentStatus: string;
          tags: string[];
          cancelReason: string | null;
          totalPriceSet: {
            shopMoney: {
              amount: string;
              currencyCode: string;
            }
          };
          customer: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            ordersCount: string;
            defaultAddress: {
              city: string;
              provinceCode: string;
              countryCode: string;
            } | null;
          } | null;
          app: {
            name: string;
          } | null;
          shippingLine: {
            title: string;
          } | null;
          lineItems: {
            edges: Array<{
              node: {
                title: string;
              }
            }>
          };
        }
      }>
    }
  };
  errors?: Array<{ message: string }>;
}

const mapFinancialStatus = (status: string): PaymentStatus => {
  const s = status ? status.toLowerCase() : '';
  if (s === 'paid') return PaymentStatus.PAID;
  if (s === 'pending') return PaymentStatus.PENDING;
  if (s === 'refunded') return PaymentStatus.REFUNDED;
  if (s === 'partially_refunded') return PaymentStatus.PARTIALLY_REFUNDED;
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

const determineDisputeStatus = (tags: string[]): DisputeStatus => {
  const lowerTags = tags.map(t => t.toLowerCase());
  
  if (lowerTags.some(t => t.includes('won'))) return DisputeStatus.WON;
  if (lowerTags.some(t => t.includes('lost'))) return DisputeStatus.LOST;
  
  if (lowerTags.some(t => t.includes('chargeback') || t.includes('dispute'))) {
     if (lowerTags.some(t => t.includes('submitted') || t.includes('review') || t.includes('pending'))) {
        return DisputeStatus.UNDER_REVIEW;
     }
     return DisputeStatus.NEEDS_RESPONSE;
  }

  return DisputeStatus.NONE;
};

const mapGraphQLToAppOrder = (node: any): Order => {
  const tagsList = node.tags || [];
  
  const nativeRisk = node.riskLevel === 'HIGH' || node.riskLevel === 'MEDIUM';
  const tagRisk = tagsList.some((t: string) => ['fraud', 'high-risk', 'risk'].includes(t.toLowerCase()));
  const cancelRisk = node.cancelReason === 'fraud';

  const isHighRisk = nativeRisk || tagRisk || cancelRisk;
  
  const customerLoc = node.customer?.defaultAddress 
    ? `${node.customer.defaultAddress.city || ''}, ${node.customer.defaultAddress.provinceCode || ''}, ${node.customer.defaultAddress.countryCode || ''}`.replace(/^, /, '').replace(/, $/, '')
    : 'Unknown';

  const disputeStatus = determineDisputeStatus(tagsList);

  const total = parseFloat(node.totalPriceSet?.shopMoney?.amount || '0');
  const currency = node.totalPriceSet?.shopMoney?.currencyCode || 'USD';

  return {
    id: node.name,
    date: new Date(node.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    created_at: node.createdAt, // Strict field
    customer: {
      id: node.customer?.id || 'guest',
      name: node.customer ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() : 'Guest',
      email: node.customer?.email || '',
      location: customerLoc === ', ,' ? 'Unknown' : customerLoc,
      ordersCount: parseInt(node.customer?.ordersCount || '0'),
    },
    channel: node.app?.name || 'Online Store',
    source_name: node.app?.name, // Strict field
    total: total,
    currency: currency, // Strict field
    paymentStatus: mapFinancialStatus(node.displayFinancialStatus),
    fulfillmentStatus: mapFulfillmentStatus(node.displayFulfillmentStatus),
    itemsCount: node.lineItems?.edges?.length || 0,
    deliveryStatus: node.displayFulfillmentStatus === 'FULFILLED' ? DeliveryStatus.DELIVERED : DeliveryStatus.NO_STATUS,
    deliveryMethod: node.shippingLine?.title || 'Standard',
    tags: tagsList,
    isHighRisk: isHighRisk,
    risk_category: isHighRisk ? 'High Risk' : 'Normal', // Strict field
    disputeStatus: disputeStatus,
    disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review ASAP' : undefined
  };
};

const extractShopDomain = (input: string): string => {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/$/, '');
  if (domain.startsWith('admin.shopify.com/store/')) {
    const parts = domain.split('/');
    if (parts.length >= 3) return `${parts[2]}.myshopify.com`;
  }
  return domain;
};

export const fetchOrders = async (domain: string, accessToken: string, useProxy: boolean = false): Promise<Order[]> => {
  const cleanDomain = extractShopDomain(domain);
  
  console.log(`[ShopifyService] Connecting to: ${cleanDomain}`);

  const targetUrl = `https://${cleanDomain}/admin/api/2024-01/graphql.json`;

  const strategies = useProxy 
    ? [
        { name: 'corsproxy.io', url: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
        { name: 'thingproxy', url: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}` }
      ] 
    : [{ name: 'Direct', url: (url: string) => url }];

  // Increased limit to 250 (Shopify Max)
  const query = `
    {
      orders(first: 250, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            name
            createdAt
            riskLevel
            displayFinancialStatus
            displayFulfillmentStatus
            tags
            cancelReason
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              firstName
              lastName
              email
              ordersCount
              defaultAddress {
                city
                provinceCode
                countryCode
              }
            }
            app {
              name
            }
            shippingLine {
              title
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  let lastError: any = new Error("Unknown error occurred");

  for (const strategy of strategies) {
    try {
      const url = strategy.url(targetUrl);
      console.log(`[ShopifyService] Attempting strategy: ${strategy.name}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 403) throw new Error(`Shopify 403: Check 'read_orders' scope.`);
        if (response.status === 401) throw new Error(`Shopify 401: Invalid Access Token.`);
        throw new Error(`Proxy/API Error: ${response.status}`);
      }

      const json: ShopifyGraphQLResponse = await response.json();
      
      if (json.errors) throw new Error(json.errors[0].message);
      if (!json.data?.orders) return [];

      console.log(`[ShopifyService] Success via ${strategy.name}`);
      return json.data.orders.edges.map(edge => mapGraphQLToAppOrder(edge.node));

    } catch (err: any) {
      console.warn(`[ShopifyService] ${strategy.name} failed:`, err.message);
      lastError = err;
      if (!useProxy) throw err;
      await new Promise(res => setTimeout(res, 500));
    }
  }

  throw lastError;
};
