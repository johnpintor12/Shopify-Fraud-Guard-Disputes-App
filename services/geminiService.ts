import { GoogleGenAI } from "@google/genai";
import { Order } from '../types';

// safely access the key, defaulting to empty string to prevent constructor crash
const apiKey = process.env.API_KEY || '';

// Only initialize if key exists, otherwise we handle it in the function
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateChargebackResponse = async (order: Order): Promise<string> => {
  if (!ai) {
    return "API Key missing. Please add API_KEY to your Vercel Environment Variables.";
  }

  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      Act as a Legal Specialist for an E-commerce Merchant.
      A chargeback has been initiated for the following order.
      Please write a formal dispute response letter to the Payment Processor (e.g., Stripe/Shopify Payments).
      
      OBJECTIVE:
      Prove that the order was legitimate, authorized by the cardholder, and delivered successfully.
      
      ORDER DETAILS:
      - Order ID: ${order.id}
      - Date: ${order.date}
      - Customer Name: ${order.customer.name}
      - Customer Email: ${order.customer.email}
      - Shipping Location: ${order.customer.location}
      - Total Amount: $${order.total}
      - Delivery Status: ${order.deliveryStatus} (Assume tracking shows Delivered)
      - Delivery Method: ${order.deliveryMethod}
      - Items Count: ${order.itemsCount}
      
      INSTRUCTIONS:
      1. Start with a formal header.
      2. State clearly that we are contesting the dispute.
      3. List the evidence:
         - AVS Match (Assume Address Verification System matched).
         - Delivery Confirmation (Mention that tracking confirms delivery to the billing address).
         - Customer History (Mention order count: ${order.customer.ordersCount}).
      4. Conclude politely requesting the funds be returned.
      5. Keep it professional, concise, and persuasive.
      6. Do NOT include placeholders like [Insert Date], use the data provided or realistic assumptions based on the order date.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Error generating response.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to generate response. Please check your API key and quota.";
  }
};