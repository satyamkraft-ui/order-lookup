const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

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

  if (!phone) {
    return res.send(simplePage("Please enter a valid mobile number."));
  }

  try {
    const possibleQueries = [
      `phone:${phone}`,
      `phone:+91${phone}`,
      `phone:91${phone}`
    ];

    let foundOrders = [];

    for (const q of possibleQueries) {
      const data = await shopifyGraphQL(q);
      const orders = data?.data?.orders?.edges?.map(e => e.node) || [];
      if (orders.length > 0) {
        foundOrders = orders;
        break;
      }
    }

    const activeOrders = foundOrders.filter(order => {
      const status = (order.displayFulfillmentStatus || "").toLowerCase();
      return !status.includes("delivered");
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
            <p><strong>Order No:</strong> ${order.name}</p>
            <p><strong>Order Date:</strong> ${formatDate(order.processedAt)}</p>
            <p><strong>Status:</strong> ${order.displayFulfillmentStatus || "-"}</p>
            <p><strong>Courier:</strong> ${tracking.company || "-"}</p>
            <p><strong>Tracking Number:</strong> ${tracking.number || "-"}</p>
            <p><strong>Tracking Link:</strong> ${tracking.url ? `<a href="${tracking.url}" target="_blank">Track shipment</a>` : "-"}</p>
          </div>
        </body>
        </html>
      `);
    }

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
        <h2>Select your order</h2>
        ${items}
      </body>
      </html>
    `);

  } catch (error) {
    return res.send(simplePage("Something went wrong while checking the order."));
  }
});

function normalizePhone(phone) {
  return phone.replace(/\D/g, "").slice(-10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
      <p>${message}</p>
      <p><a href="/">Go back</a></p>
    </body>
    </html>
  `;
}

async function shopifyGraphQL(orderQuery) {
  const query = `
    query GetOrders($query: String!) {
      orders(first: 20, query: $query, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            displayFulfillmentStatus
            phone
            fulfillments(first: 10) {
              trackingInfo {
                company
                number
                url
              }
            }
          }
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
        variables: { query: orderQuery }
      })
    }
  );

  return response.json();
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
