// src/services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
import { Order } from '../types';

// Safely access the key
const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY || '';

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateChargebackResponse = async (order: Order): Promise<string> => {
  if (!ai) {
    return "Configuration Error: API Key missing. Please check Vercel Environment Variables (API_KEY).";
  }

  try {
    const model = 'gemini-2.5-flash';
    
    // Construct a context-aware prompt
    const prompt = `
      Act as a Legal Specialist for an E-commerce Merchant.
      A chargeback has been initiated for the following order.
      Please write a formal dispute response letter to the Payment Processor (e.g., Stripe/Shopify Payments).
      
      OBJECTIVE:
      Prove that the order was legitimate, authorized by the cardholder, and delivered successfully.
      
      ORDER EVIDENCE:
      - Order ID: ${order.id}
      - Date Placed: ${order.date}
      - Customer Name: ${order.customer.name}
      - Customer Email: ${order.customer.email}
      - Shipping Location: ${order.customer.location}
      - Total Amount: ${order.total} ${order.currency || 'USD'}
      - Payment Status: ${order.paymentStatus}
      - Fulfillment Status: ${order.fulfillmentStatus}
      - Delivery Method: ${order.deliveryMethod}
      - Items Count: ${order.itemsCount}
      - Risk Level: ${order.risk_category || 'Normal'}
      
      INSTRUCTIONS:
      1. Start with a formal header.
      2. State clearly that we are contesting the dispute for Order ${order.id}.
      3. List the evidence clearly:
         - AVS Match (Assume Address Verification System matched).
         - Delivery Confirmation (Mention that tracking confirms delivery to the provided address).
         - Customer History (Mention they have ${order.customer.ordersCount} orders on file).
      4. Conclude politely requesting the funds be returned.
      5. Keep it professional, concise, and persuasive. Do NOT include placeholders like [Insert Date], use the data provided.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Error: AI returned an empty response.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes('429')) return "Error: Rate limit exceeded. Please try again in a moment.";
    if (error.message?.includes('401')) return "Error: Invalid API Key. Please check your configuration.";
    return "Unable to generate response. Please check your API key and connection.";
  }
};
