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
            }
          };
          customer: {
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

  return {
    id: node.name,
    date: new Date(node.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    customer: {
      id: node.customer?.id || 'guest',
      name: node.customer ? `${node.customer.firstName || ''} ${node.customer.lastName || ''}`.trim() : 'Guest',
      email: node.customer?.email || '',
      location: customerLoc === ', ,' ? 'Unknown' : customerLoc,
      ordersCount: parseInt(node.customer?.ordersCount || '0'),
    },
    channel: node.app?.name || 'Online Store',
    total: total,
    paymentStatus: mapFinancialStatus(node.displayFinancialStatus),
    fulfillmentStatus: mapFulfillmentStatus(node.displayFulfillmentStatus),
    itemsCount: node.lineItems?.edges?.length || 0,
    deliveryStatus: node.displayFulfillmentStatus === 'FULFILLED' ? DeliveryStatus.DELIVERED : DeliveryStatus.NO_STATUS,
    deliveryMethod: node.shippingLine?.title || 'Standard',
    tags: tagsList,
    isHighRisk: isHighRisk,
    disputeStatus: disputeStatus,
    disputeDeadline: disputeStatus === DisputeStatus.NEEDS_RESPONSE ? 'Review ASAP' : undefined
  };
};

const extractShopDomain = (input: string): string => {
  let domain = input.trim().toLowerCase();
  
  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes
  domain = domain.replace(/\/$/, '');

  // Handle "admin.shopify.com/store/shop-name"
  if (domain.startsWith('admin.shopify.com/store/')) {
    const parts = domain.split('/');
    if (parts.length >= 3) {
      return `${parts[2]}.myshopify.com`;
    }
  }

  return domain;
};

export const fetchOrders = async (domain: string, accessToken: string, useProxy: boolean = false): Promise<Order[]> => {
  const cleanDomain = extractShopDomain(domain);
  
  console.log(`Configuring connection for: ${cleanDomain}`);

  // Base GraphQL URL - Updated to latest stable version 2025-01
  const targetUrl = `https://${cleanDomain}/admin/api/2025-01/graphql.json`;

  // Proxy strategies
  const strategies = useProxy 
    ? [
        // Strategy 1: corsproxy.io (Best performance)
        { name: 'corsproxy.io', url: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
        // Strategy 2: CodeTabs (Good fallback)
        { name: 'codetabs', url: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
        // Strategy 3: Thingproxy (Backup)
        { name: 'thingproxy', url: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}` },
        // Strategy 4: Cors Anywhere (Last resort, sometimes needs activation)
        { name: 'cors-anywhere', url: (url: string) => `https://cors-anywhere.herokuapp.com/${url}` }
      ] 
    : [{ name: 'Direct', url: (url: string) => url }];

  const query = `
    {
      orders(first: 60, sortKey: CREATED_AT, reverse: true) {
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
              }
            }
            customer {
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
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

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
        // Handle 403 specifically for scope issues
        if (response.status === 403) {
           console.error(`[ShopifyService] 403 Forbidden`);
           throw new Error(`Shopify API Error: 403 Forbidden.\n\nThis usually means your Access Token is missing the 'read_orders' permission.\n\nFix:\n1. Go to Shopify Admin > Settings > Apps and sales channels > Develop apps.\n2. Select your app > Configuration > Admin API integration.\n3. Search for 'Orders' and check 'read_orders'.\n4. Save and click 'Install app' (or Re-install) to apply changes.`);
        }

        // If 401/404, we reached Shopify but auth/domain failed. Don't retry other proxies.
        if ([401, 404].includes(response.status)) {
           console.error(`[ShopifyService] Auth/Domain Error: ${response.status}`);
           throw new Error(`Shopify API Error: ${response.status} ${response.statusText}. Check your Shop Domain and Access Token.`);
        }
        
        console.warn(`[ShopifyService] Strategy ${strategy.name} failed with status ${response.status}`);
        throw new Error(`Proxy Error: ${response.status}`);
      }

      const json: ShopifyGraphQLResponse = await response.json();
      
      if (!json.data && !json.errors) {
         throw new Error("Invalid JSON response from proxy");
      }
      
      if (json.errors) throw new Error(json.errors[0].message);
      
      if (!json.data?.orders) {
        return [];
      }

      console.log(`[ShopifyService] Success via ${strategy.name}`);
      return json.data.orders.edges.map(edge => mapGraphQLToAppOrder(edge.node));

    } catch (err: any) {
      console.warn(`[ShopifyService] Strategy ${strategy.name} threw error:`, err.message);
      lastError = err;

      // Stop if it's a definitive Shopify error
      if (err.message && err.message.includes('Shopify API Error')) {
        throw err;
      }
      
      // If direct mode, don't loop
      if (!useProxy) throw err;
      
      // Small delay before next proxy
      await new Promise(res => setTimeout(res, 500));
    }
  }

  throw lastError;
};