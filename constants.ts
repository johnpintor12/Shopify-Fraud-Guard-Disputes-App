import { Order, PaymentStatus, FulfillmentStatus, DeliveryStatus, DisputeStatus } from './types';

export const MOCK_ORDERS: Order[] = [
  {
    id: '#439715',
    date: 'Nov 23 at 11:13 pm',
    customer: {
      id: 'c1',
      name: 'Stacy Hollensworth',
      email: 'stacy.h@example.com',
      location: 'Princeton, TX, US',
      ordersCount: 12
    },
    channel: 'Online Store',
    total: 308.88,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.FULFILLED,
    itemsCount: 11,
    deliveryStatus: DeliveryStatus.DELIVERED,
    deliveryMethod: 'Standard + 1',
    tags: ['fraud', 'high-risk'],
    isHighRisk: true,
    disputeStatus: DisputeStatus.NEEDS_RESPONSE,
    disputeDeadline: 'Due in 3 days'
  },
  {
    id: '#439713',
    date: 'Nov 23 at 11:12 pm',
    customer: {
      id: 'c1',
      name: 'Stacy Hollensworth',
      email: 'stacy.h@example.com',
      location: 'Princeton, TX, US',
      ordersCount: 12
    },
    channel: 'Online Store',
    total: 308.88,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.FULFILLED,
    itemsCount: 11,
    deliveryStatus: DeliveryStatus.DELIVERED,
    deliveryMethod: 'Standard + 1',
    tags: ['sent-to-a2b'],
    isHighRisk: false,
    disputeStatus: DisputeStatus.NONE
  },
  {
    id: '#439709',
    date: 'Nov 23 at 11:09 pm',
    customer: {
      id: 'c1',
      name: 'Stacy Hollensworth',
      email: 'stacy.h@example.com',
      location: 'Princeton, TX, US',
      ordersCount: 12
    },
    channel: 'Online Store',
    total: 308.88,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.FULFILLED,
    itemsCount: 11,
    deliveryStatus: DeliveryStatus.DELIVERED,
    deliveryMethod: 'Standard + 1',
    tags: ['sent-to-a2b'],
    isHighRisk: false,
    disputeStatus: DisputeStatus.NONE
  },
  {
    id: '#439705',
    date: 'Nov 23 at 10:45 pm',
    customer: {
      id: 'c2',
      name: 'Michael B. Jordan',
      email: 'mbj@example.com',
      location: 'Los Angeles, CA, US',
      ordersCount: 1
    },
    channel: 'Online Store',
    total: 1250.00,
    paymentStatus: PaymentStatus.PAID,
    fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
    itemsCount: 2,
    deliveryStatus: DeliveryStatus.NO_STATUS,
    deliveryMethod: 'Express',
    tags: ['high-value', 'review-needed'],
    isHighRisk: true,
    disputeStatus: DisputeStatus.UNDER_REVIEW,
    disputeDeadline: 'Submitted'
  },
  {
    id: '#439622',
    date: 'Nov 22 at 09:15 am',
    customer: {
      id: 'c3',
      name: 'Alex Chen',
      email: 'alex.chen@test.com',
      location: 'San Francisco, CA, US',
      ordersCount: 3
    },
    channel: 'Online Store',
    total: 89.99,
    paymentStatus: PaymentStatus.REFUNDED,
    fulfillmentStatus: FulfillmentStatus.FULFILLED,
    itemsCount: 1,
    deliveryStatus: DeliveryStatus.DELIVERED,
    deliveryMethod: 'Standard',
    tags: ['chargeback-won'],
    isHighRisk: true,
    disputeStatus: DisputeStatus.WON
  }
];

export const GOOGLE_SCRIPT_TEMPLATE = `
/**
 * SHOPIFY FRAUD & CHARGEBACK MONITOR
 * 
 * 1. Open Google Sheets
 * 2. Extensions > Apps Script
 * 3. Paste this code
 * 4. Update CONFIG with your API details
 */

const CONFIG = {
  API_KEY: 'YOUR_API_KEY',
  ACCESS_TOKEN: 'YOUR_ADMIN_ACCESS_TOKEN',
  SHOP_NAME: 'your-shop-name.myshopify.com',
  API_VERSION: '2024-01',
  FRAUD_SHEET_NAME: 'Fraud Monitor'
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Fraud Monitor')
    .addItem('Sync High-Risk Orders', 'syncFraudOrders')
    .addToUi();
}

function syncFraudOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.FRAUD_SHEET_NAME) || 
                SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG.FRAUD_SHEET_NAME);
  
  // Setup Headers
  if (sheet.getLastRow() === 0) {
    const headers = [
      'Order ID', 'Date', 'Customer', 'Total', 'Risk Level', 
      'Payment Status', 'Fulfillment', 'Tags', 'Action Needed'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f4f6f8');
    sheet.setFrozenRows(1);
  }

  // Fetch orders with any status
  const url = \`https://\${CONFIG.SHOP_NAME}/admin/api/\${CONFIG.API_VERSION}/orders.json?status=any&limit=50\`;
  
  const options = {
    'method': 'get',
    'headers': {
      'X-Shopify-Access-Token': CONFIG.ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.orders) {
      // Filter for orders that are tagged as fraud, high risk, or have risk indicators
      const fraudOrders = json.orders.filter(order => {
         const tags = order.tags ? order.tags.toLowerCase() : '';
         return tags.includes('fraud') || tags.includes('risk') || tags.includes('chargeback');
      });

      const rows = fraudOrders.map(order => {
        let actionNeeded = 'Monitor';
        if (order.tags.includes('chargeback')) actionNeeded = 'RESPOND ASAP';
        
        return [
          order.name,
          order.created_at.split('T')[0],
          order.customer ? order.customer.first_name + ' ' + order.customer.last_name : 'Guest',
          order.total_price,
          'HIGH',
          order.financial_status,
          order.fulfillment_status || 'unfulfilled',
          order.tags,
          actionNeeded
        ];
      });
      
      if(rows.length > 0) {
        // Clear old data (optional, or just append)
        // sheet.getRange(2, 1, sheet.getLastRow(), 9).clearContent(); 
        
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
        
        // Highlight logic
        const lastRow = sheet.getLastRow();
        const range = sheet.getRange(lastRow - rows.length + 1, 1, rows.length, 9);
        range.setBorder(true, true, true, true, true, true);
      }
      
      Browser.msgBox(\`Synced \${rows.length} high-risk orders to sheet.\`);
    }
  } catch (e) {
    Browser.msgBox('Error: ' + e.toString());
  }
}
`;