const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const MAX_ORDERS_TO_SCAN = 3000;
const PAGE_SIZE = 100;

app.get("/", async (req, res) => {
  const rawPhone = (req.query.phone || "").trim();

  // UI PAGE
  if (!rawPhone) {
    return res.send(`
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Know your order no</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
          .box { border: 1px solid #ddd; border-radius: 12px; padding: 20px; }
          input { width: 100%; padding: 12px; font-size: 16px; margin-top: 10px; margin-bottom: 10px; }
          button { padding: 12px 18px; font-size: 16px; cursor: pointer; }
          .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>Know your order no</h2>
          <p>Enter the mobile number used while placing your order.</p>
          <form method="GET" action="/">
            <input type="text" name="phone" placeholder="Enter mobile number" required />
            <button type="submit">Search</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  const phone = normalizePhone(rawPhone);

  if (!phone || phone.length !== 10) {
    return res.send(simplePage("Please enter a valid 10-digit mobile number."));
  }

  try {
    const allOrders = await fetchOrdersWithPagination(MAX_ORDERS_TO_SCAN);

    // Match phone from all possible fields
    const matchedOrders = allOrders.filter(order => {
      const orderPhone = normalizePhone(
        order.phone ||
        order.customer?.phone ||
        order.shippingAddress?.phone ||
        order.billingAddress?.phone ||
        ""
      );
      return orderPhone === phone;
    });

    // Filter active (not delivered/fulfilled) — fixed: exact match only
    const COMPLETED_STATUSES = ["fulfilled", "delivered"];
    const activeOrders = matchedOrders.filter(order => {
      const status = String(order.displayFulfillmentStatus || "").toLowerCase();
      return !COMPLETED_STATUSES.includes(status);
    });

    if (activeOrders.length === 0) {
      return res.send(simplePage("No active order found for this mobile number."));
    }

    // Single order
    if (activeOrders.length === 1) {
      const order = activeOrders[0];
      const tracking = order.fulfillments?.[0]?.trackingInfo?.[0] || {};

      return res.send(`
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Your tracking details</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
          </style>
        </head>
        <body>
          <h2>Your tracking details</h2>
          <div class="card">
            <p><strong>Order No:</strong> ${order.name}</p>
            <p><strong>Order Date:</strong> ${formatDate(order.processedAt)}</p>
            <p><strong>Status:</strong> ${order.displayFulfillmentStatus || "-"}</p>
            <p><strong>Courier:</strong> ${tracking.company || "-"}</p>
            <p><strong>Tracking Number:</strong> ${tracking.number || "-"}</p>
            <p><strong>Tracking Link:</strong> ${
              tracking.url
                ? `<a href="${tracking.url}" target="_blank">Track shipment</a>`
                : "-"
            }</p>
          </div>
        </body>
        </html>
      `);
    }

    // Multiple orders
    const items = activeOrders.map(order => `
      <div class="card">
        <p><strong>Order No:</strong> ${order.name}</p>
        <p><strong>Order Date:</strong> ${formatDate(order.processedAt)}</p>
        <p><strong>Status:</strong> ${order.displayFulfillmentStatus || "-"}</p>
      </div>
    `).join("");

    return res.send(`
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Select your order</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
          .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-top: 12px; }
        </style>
      </head>
      <body>
        <h2>Your active orders</h2>
        ${items}
      </body>
      </html>
    `);

  } catch (error) {
    console.error(error);
    return res.send(simplePage("Something went wrong while checking the order."));
  }
});

// Helpers

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function simplePage(message) {
  return `
    <html>
    <body style="font-family:Arial; max-width:700px; margin:40px auto; padding:20px;">
      <h2>Know your order no</h2>
      <p>${message}</p>
      <a href="/">← Go back</a>
    </body>
    </html>
  `;
}

// Pagination

async function fetchOrdersWithPagination(maxOrders) {
  let orders = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage && orders.length < maxOrders) {
    const data = await shopifyGraphQL(cursor);

    const newOrders = data?.data?.orders?.edges?.map(e => e.node) || [];
    orders.push(...newOrders);

    hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage;
    cursor = data?.data?.orders?.pageInfo?.endCursor;

    if (newOrders.length === 0) break;
  }

  return orders.slice(0, maxOrders);
}

// Shopify GraphQL

async function shopifyGraphQL(afterCursor) {
  const query = `
    query ($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            displayFulfillmentStatus
            phone
            customer {
              phone
            }
            shippingAddress {
              phone
            }
            billingAddress {
              phone
            }
            fulfillments(first: 10) {
              trackingInfo(first: 5) {
                company
                number
                url
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_TOKEN
      },
      body: JSON.stringify({
        query,
        variables: {
          first: PAGE_SIZE,
          after: afterCursor
        }
      })
    }
  );

  return response.json();
}

app.listen(port, () => {
  console.log("Server running on port " + port);
});
