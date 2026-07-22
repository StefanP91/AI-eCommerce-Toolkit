import fs from "node:fs";
import path from "node:path";

const products = [
  ["wireless-bluetooth-earbuds", "Wireless Bluetooth Earbuds", "Basic earbuds for music.", "Electronics", 29.99],
  ["usb-c-charging-cable", "USB-C Charging Cable", "Charging cable 1m.", "Electronics", 12.99],
  ["stainless-steel-water-bottle", "Stainless Steel Water Bottle", "Bottle for drinks.", "Home", 24.99],
  ["yoga-mat-non-slip", "Non-Slip Yoga Mat", "Mat for yoga.", "Fitness", 34.99],
  ["ceramic-coffee-mug", "Ceramic Coffee Mug", "Mug for coffee.", "Home", 14.99],
  ["led-desk-lamp", "LED Desk Lamp", "Lamp for desk.", "Home", 39.99],
  ["running-shoes-men", "Men Running Shoes", "Shoes for running.", "Footwear", 79.99],
  ["cotton-t-shirt-women", "Women Cotton T-Shirt", "Soft t-shirt.", "Apparel", 19.99],
  ["leather-wallet", "Leather Wallet", "Wallet for cards.", "Accessories", 27.99],
  ["portable-phone-stand", "Portable Phone Stand", "Stand for phone.", "Electronics", 15.99],
  ["kitchen-knife-set", "Kitchen Knife Set", "Set of knives.", "Kitchen", 49.99],
  ["bamboo-cutting-board", "Bamboo Cutting Board", "Board for cutting.", "Kitchen", 22.99],
  ["memory-foam-pillow", "Memory Foam Pillow", "Pillow for sleep.", "Home", 44.99],
  ["travel-backpack-40l", "Travel Backpack 40L", "Backpack for travel.", "Bags", 59.99],
  ["fitness-resistance-bands", "Fitness Resistance Bands", "Bands for workout.", "Fitness", 18.99],
  ["smart-watch-fitness", "Smart Fitness Watch", "Watch with fitness tracking.", "Electronics", 89.99],
  ["organic-green-tea", "Organic Green Tea 50 Bags", "Green tea bags.", "Grocery", 11.99],
  ["scented-candle-lavender", "Lavender Scented Candle", "Candle with scent.", "Home", 16.99],
  ["wireless-mouse-ergonomic", "Ergonomic Wireless Mouse", "Mouse for computer.", "Electronics", 25.99],
  ["bluetooth-speaker-mini", "Mini Bluetooth Speaker", "Small speaker.", "Electronics", 32.99],
];

const adjectives = ["Premium", "Classic", "Essential", "Everyday", "Compact", "Pro", "Ultra", "Smart", "Eco", "Deluxe"];
const nouns = ["Bottle", "Bag", "Kit", "Set", "Tool", "Device", "Accessory", "Organizer", "Holder", "Bundle"];
const types = ["Electronics", "Home", "Kitchen", "Fitness", "Apparel", "Beauty", "Outdoor", "Office", "Pet", "Baby"];

const headers = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Grams",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Compare-at Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Gift Card",
  "SEO Title",
  "SEO Description",
  "Status",
];

function esc(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const rows = [headers.join(",")];

for (let i = 1; i <= 100; i += 1) {
  let handle;
  let title;
  let body;
  let type;
  let price;

  if (i <= products.length) {
    [handle, title, body, type, price] = products[i - 1];
  } else {
    const adj = adjectives[(i + 3) % adjectives.length];
    const noun = nouns[(i * 2) % nouns.length];
    type = types[i % types.length];
    title = `${adj} ${type} ${noun} ${i}`;
    handle = slug(title);
    body = `Simple ${title.toLowerCase()} for daily use.`;
    price = (9.99 + (i % 40) * 2.5).toFixed(2);
  }

  const sku = `TEST-${String(i).padStart(3, "0")}`;
  const row = [
    handle,
    title,
    body,
    "AI Commerce Test",
    type,
    "test-import,ai-suite",
    "TRUE",
    "Title",
    "Default Title",
    sku,
    "200",
    "shopify",
    "25",
    "deny",
    "manual",
    Number(price).toFixed(2),
    "",
    "TRUE",
    "TRUE",
    "FALSE",
    "",
    "",
    "active",
  ];

  rows.push(row.map(esc).join(","));
}

const outDir = path.join(process.cwd(), "fixtures");
const outFile = path.join(outDir, "shopify-products-100.csv");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, rows.join("\n"), "utf8");
console.log(`Wrote ${outFile} (${rows.length - 1} products)`);
