# Shopify Fraud Guard & Disputes Dashboard

An AI-powered dashboard designed to help Shopify merchants monitor high-risk orders and automate the chargeback rebuttal process. This application integrates directly with the Shopify Admin API and uses **Google Gemini AI** to draft professional dispute evidence letters.

![Dashboard Preview](https://via.placeholder.com/800x450?text=Shopify+Fraud+Guard+Preview)

## 🚀 Features

*   **Real-time Fraud Monitoring:** Automatically pulls high-risk orders using Shopify's GraphQL API.
*   **AI Dispute Assistant:** Generates formal chargeback rebuttal letters using Gemini AI, leveraging order data (AVS matches, delivery tracking, customer history).
*   **CSV Import:** Support for offline analysis by importing standard Shopify Order Exports.
*   **Risk & Dispute Tracking:** Dedicated views for Open Disputes, Won/Lost cases, and High-Risk alerts.
*   **Secure & Private:** Client-side application. Data flows directly from your browser to Shopify/Google. No intermediate servers.

## 🛠️ Prerequisites

To run this app, you need:

1.  **Node.js** (v18 or higher) installed on your computer.
2.  **Google Gemini API Key:** Get it for free at [Google AI Studio](https://aistudiocdn.com/apikey).
3.  **Shopify Admin Credentials:** (See "Shopify Setup" below).

## ⚙️ Shopify Setup

To connect the dashboard to your store, you need to create a **Custom App** in Shopify:

1.  Go to your Shopify Admin > **Settings** > **Apps and sales channels**.
2.  Click **Develop apps** > **Create an app**.
3.  Name it "Fraud Guard".
4.  Click **Configuration** > **Admin API integration** > **Edit**.
5.  Search for `Orders` and check the box **`read_orders`**.
6.  Click **Save**, then click **Install app**.
7.  Go to the **API credentials** tab and copy the **Admin API access token** (starts with `shpat_...`).

## 💻 Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/shopify-fraud-guard.git
    cd shopify-fraud-guard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

4.  **Run the app:**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## ☁️ Deployment (Free)

This app is designed to be hosted on **Vercel** or **Cloudflare Pages**.

### Deploy on Vercel
1.  Push your code to a GitHub repository.
2.  Log in to [Vercel](https://vercel.com) and import the repo.
3.  In the deployment settings, add an Environment Variable:
    *   **Key:** `API_KEY`
    *   **Value:** Your Google Gemini API Key.
4.  Click **Deploy**.

## 🛡️ Privacy & Security

*   **API Keys:** Your Shopify Access Token is stored only in your browser's memory (RAM). It is never saved to a database or sent to a third-party server.
*   **CORS Proxy:** To bypass browser security restrictions when connecting to Shopify, the app uses a CORS proxy (e.g., `corsproxy.io`). For maximum security in an enterprise environment, consider deploying your own proxy.

## 📄 License

MIT License. Free to use and modify.
