// upload-blocklist.js
import fetch from "node-fetch";

const OISD_URL = process.argv[2] || "https://big.oisd.nl/";
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE_ID = process.env.CF_NAMESPACE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

if (!CF_ACCOUNT_ID || !CF_NAMESPACE_ID || !CF_API_TOKEN) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

async function fetchBlocklist(url) {
  console.log(`📥 Mengambil blocklist dari ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal fetch: ${res.statusText}`);

  const text = await res.text();
  const domains = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    const domain = parts.length > 1 ? parts[1] : parts[0];
    if (domain && !domain.includes("localhost")) {
      domains.push(domain);
    }
  }

  console.log(`✅ Ditemukan ${domains.length} domain`);
  return domains;
}

async function uploadToKV(domains) {
  console.log("🚀 Mengupload ke Cloudflare KV...");

  const headers = {
    "Authorization": `Bearer ${CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  const chunkSize = 5000;
  for (let i = 0; i < domains.length; i += chunkSize) {
    const batch = domains.slice(i, i + chunkSize);
    const kvItems = batch.map(domain => ({
      key: domain,
      value: "1",
    }));

    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}/bulk`;
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(kvItems),
    });

    const json = await res.json();
    if (!json.success) {
      console.error(`❌ Gagal upload batch ${i / chunkSize + 1}:`, json.errors);
    } else {
      console.log(`✅ Batch ${i / chunkSize + 1} (${batch.length} keys) sukses`);
    }
  }
}

(async () => {
  try {
    const domains = await fetchBlocklist(OISD_URL);
    await uploadToKV(domains);
    console.log("🎉 Selesai!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
