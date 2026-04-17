const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const PAGE_SIZE = 100;

const COURIER_LINKS = {
  "delhivery":        "https://www.delhivery.com/tracking",
  "dtdc":             "https://www.dtdc.in/trace.asp",
  "mark":             "https://markexpress.co.in/",
  "tirupati courier": "https://shorturl.at/jHTW3",
  "trackon":          "https://trackon.in/",
  "bluedart":         "https://www.bluedart.com/tracking",
  "xpressbees":       "https://www.xpressbees.com/track/",
  "nandan courier":   "https://www.shreenandan.com/",
  "franch express":   "https://www.franchexpress.com/",
  "mahavir":          "https://shorturl.at/zBLKr",
  "ecom express":     "https://ecomexpress.in/tracking/",
  "shree maruti":     "https://shorturl.at/zBLKr",
  "ekart":            "https://ekartlogistics.com/",
  "anjani":           "http://www.shreeanjanicourier.com/",
  "shadowfax":        "https://www.shadowfax.in/track-order",
  "amazon shipping":  "https://track.amazon.in/",
  "india post":       "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx",
  "st courier":       "https://stcourier.com/"
};

function getTrackingLink(company, shopifyUrl) {
  if (!company) return "-";
  const key = company.trim().toLowerCase();
  if (key === "amazon" && shopifyUrl) {
    return `<a href="${shopifyUrl}" target="_blank" class="track-btn">Track Shipment</a>`;
  }
  const mapped = COURIER_LINKS[key];
  if (mapped) {
    return `<a href="${mapped}" target="_blank" class="track-btn">Track Shipment</a>`;
  }
  if (shopifyUrl) {
    return `<a href="${shopifyUrl}" target="_blank" class="track-btn">Track Shipment</a>`;
  }
  return "-";
}

// Shared HTML shell
function pageShell(title, bodyContent) {
  return `
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet" />
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Roboto', sans-serif;
          background: #f9f5f0;
          color: #333;
          min-height: 100vh;
        }

        /* Header */
        .header {
          background: #fff;
          border-bottom: 3px solid #FFAB41;
          padding: 14px 20px;
          text-align: center;
        }
        .header img {
          max-width: 160px;
          height: auto;
        }

        /* Page wrapper */
        .wrapper {
          max-width: 680px;
          margin: 36px auto;
          padding: 0 16px 40px;
        }

        h2 {
          font-family: 'Lora', serif;
          color: #222;
          font-size: 22px;
          margin-bottom: 6px;
        }

        p.subtitle {
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }

        /* Search box */
        .search-box {
          background: #fff;
          border: 1px solid #e0d6c8;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        input[type="text"] {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'Roboto', sans-serif;
          border: 1.5px solid #ddd;
          border-radius: 8px;
          margin-top: 12px;
          margin-bottom: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        input[type="text"]:focus {
          border-color: #FFAB41;
        }

        button[type="submit"] {
          background: #FFAB41;
          color: #fff;
          border: none;
          padding: 12px 28px;
          font-size: 15px;
          font-family: 'Roboto', sans-serif;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        }
        button[type="submit"]:hover {
          background: #e8962e;
        }

        /* Order card */
        .card {
          background: #fff;
          border: 1px solid #e0d6c8;
          border-radius: 12px;
          padding: 20px;
          margin-top: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .card-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid #f0ebe3;
          font-size: 14px;
        }
        .card-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .card-label {
          color: #888;
          font-weight: 500;
          min-width: 130px;
        }

        .card-value {
          color: #222;
          text-align: right;
          flex: 1;
        }

        /* Status badge */
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          background: #fff3e0;
          color: #e07b00;
        }
        .badge.fulfilled {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .badge.unfulfilled {
          background: #fff3e0;
          color: #e07b00;
        }

        /* Track button */
        .track-btn {
          display: inline-block;
          background: #E32C2B;
          color: #fff !important;
          text-decoration: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s;
        }
        .track-btn:hover {
          background: #c0201f;
        }

        /* Back link */
        .back-link {
          display: inline-block;
          margin-top: 20px;
          color: #FFAB41;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }
        .back-link:hover {
          text-decoration: underline;
        }

        /* Message box */
        .message-box {
          background: #fff;
          border: 1px solid #e0d6c8;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: #555;
          margin-top: 16px;
          font-size: 15px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://cdn.shopify.com/s/files/1/0281/0327/8691/files/satyam-face-logo.jpg?v=1715321606" alt="Satyam Kraft" />
      </div>
      <div class="wrapper">
        ${bodyContent}
      </div>
    </body>
    </html>
  `;
}

function statusBadge(status) {
  if (!status) return "-";
  const cls = status.toLowerCase().includes("fulfill") ? "fulfilled" : "unfulfilled";
  return `<span class="badge ${cls}">${status}</span>`;
}

function orderCard(order) {
  const tracking = order.fulfillments?.[0]?.trackingInfo?.[0] || {};
  const trackingLink = getTrackingLink(tracking.company, tracking.url);
  return `
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order No</span>
        <span class="card-value">${order.name}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Order Date</span>
        <span class="card-value">${formatDate(order.processedAt)}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${statusBadge(order.displayFulfillmentStatus)}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Courier</span>
        <span class="card-value">${tracking.company || "-"}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Tracking No</span>
        <span class="card-value">${tracking.number || "-"}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Tracking Link</span>
        <span class="card-value">${trackingLink}</span>
      </div>
    </div>
  `;
}

app.get("/", async (req, res) => {
  const rawPhone = (req.query.phone || "").trim();

  if (!rawPhone) {
    return res.send(pageShell("Know Your Order", `
      <h2>Know Your Order</h2>
      <p class="subtitle">Enter the mobile number used while placing your order.</p>
      <div class="search-box">
        <form method="GET" action="/">
          <input type="text" name="phone" placeholder="Enter 10-digit mobile number" required />
          <button type="submit">Search Order</button>
        </form>
      </div>
    `));
  }

  const phone = normalizePhone(rawPhone);

  if (!phone || phone.length !== 10) {
    return res.send(pageShell("Invalid Number", `
      <div class="message-box">Please enter a valid 10-digit mobile number.</div>
      <a href="/" class="back-link">← Go back</a>
    `));
  }

  try {
    const allOrders = await fetchOrdersLast60Days();

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

    if (matchedOrders.length === 0) {
      return res.send(pageShell("No Orders Found", `
        <div class="message-box">No order found for this mobile number in the last 60 days.</div>
        <a href="/" class="back-link">← Go back</a>
      `));
    }

    if (matchedOrders.length === 1) {
      return res.send(pageShell("Your Order Details", `
        <h2>Your Order Details</h2>
        <p class="subtitle">Here are the details for your recent order.</p>
        ${orderCard(matchedOrders[0])}
        <a href="/" class="back-link">← Search another order</a>
      `));
    }

    const cards = matchedOrders.map(orderCard).join("");
    return res.send(pageShell("Your Orders", `
      <h2>Your Orders</h2>
      <p class="subtitle">Showing all orders from the last 60 days.</p>
      ${cards}
      <a href="/" class="back-link">← Search another order</a>
    `));

  } catch (error) {
    console.error(error);
    return res.send(pageShell("Error", `
      <div class="message-box">Something went wrong while checking the order. Please try again.</div>
      <a href="/" class="back-link">← Go back</a>
    `));
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

// Fetch orders from last 60 days

async function fetchOrdersLast60Days() {
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceISO = since.toISOString();

  let orders = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const data = await shopifyGraphQL(cursor, sinceISO);
    const newOrders = data?.data?.orders?.edges?.map(e => e.node) || [];
    orders.push(...newOrders);
    hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage;
    cursor = data?.data?.orders?.pageInfo?.endCursor;
    if (newOrders.length === 0) break;
  }

  return orders;
}

// Shopify GraphQL

async function shopifyGraphQL(afterCursor, sinceISO) {
  const query = `
    query ($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
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
          after: afterCursor,
          query: `processed_at:>='${sinceISO}'`
        }
      })
    }
  );

  return response.json();
}

app.listen(port, () => {
  console.log("Server running on port " + port);
});
