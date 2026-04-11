const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// How many orders to scan at most
const MAX_ORDERS_TO_SCAN = 10000;
// Shopify allows paginated fetching; keep one page moderate
const PAGE_SIZE = 100;

app.get("/", async (req, res) => {
  const rawPhone = (req.query.phone || "").trim();

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

    const matchedOrders = allOrders.filter(order => {
      const orderPhone = normalizePhone(
        order.phone ||
        order.customer?.phone ||
        ""
      );

      return orderPhone === phone;
    });

    // Keep only not-delivered-looking orders
    // displayFulfillmentStatus usually gives useful values like unfulfilled / partial / fulfilled / shipped
    const activeOrders = matchedOrders.filter(order => {
      const status = String(order.displayFulfillmentStatus || "").toLowerCase();

      // treat fulfilled / delivered as completed
      if (status.includes("fulfilled") || status.includes("delivered")) {
        return false;
      }

      return true;
    });

    if (activeOrders.length === 0) {
      return res.send(simplePage("No active order found for this mobile number."));
    }

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
            <p><strong>Order No:</strong> ${escapeHtml(order.name || "-")}</p>
            <p><strong>Order Date:</strong> ${formatDate(order.processedAt)}</p>
            <p><strong>Status:</strong> ${escapeHtml(order.displayFulfillmentStatus || "-")}</p>
            <p><strong>Courier:</strong> ${escapeHtml(tracking.company || "-")}</p>
            <p><strong>Tracking Number:</strong> ${escapeHtml(tracking.number || "-")}</p>
            <p><strong>Tracking Link:</strong> ${
              tracking.url
                ? `<a href="${escapeAttribute(tracking.url)}" target="_blank" rel="noopener noreferrer">Track shipment</a>`
                : "-"
            }</p>
          </div>
        </body>
        </html>
      `);
    }

    const items = activeOrders.map(order => `
      <div class="card">
        <p><strong>Order No:</strong> ${escapeHtml(order.name || "-")}</p>
        <p><strong>Order Date:</strong> ${formatDate(order.processedAt)}</p>
        <p><strong>Status:</strong> ${escapeHtml(order.displayFulfillmentStatus || "-")}</p>
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
        <h2>Select your order</h2>
        ${items}
      </body>
      </html>
    `);

  } catch (error) {
    console.error("Order lookup error:", error);
    return res.send(simplePage("Something went wrong while checking the order."));
  }
});

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function simplePage(message) {
  return `
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
      </style>
    </head>
    <body>
      <h2>Know your order no</h2>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">Go back</a></p>
    </body>
    </html>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function fetchOrdersWithPagination(maxOrders) {
  let orders = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage && orders.length < maxOrders) {
    const pageData = await shopifyGraphQL(cursor);
    const connection = pageData?.data?.orders;

    if (!connection) {
      throw new Error("Invalid Shopify response: orders connection missing");
    }

    const pageOrders = (connection.edges || []).map(edge => edge.node);
    orders.push(...pageOrders);

    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor || null;

    // stop if Shopify returned nothing
    if (pageOrders.length === 0) {
      break;
    }
  }

  return orders.slice(0, maxOrders);
}

async function shopifyGraphQL(afterCursor) {
  const query = `
    query GetOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          cursor
          node {
            id
            name
            processedAt
            displayFulfillmentStatus
            phone
            customer {
              phone
            }
            fulfillments(first: 10) {
              trackingInfo {
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify HTTP ${response.status}: ${text}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
