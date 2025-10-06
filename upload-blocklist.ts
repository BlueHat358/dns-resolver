import fetch from "node-fetch";

const OISD_URL = process.argv[2] || "https://big.oisd.nl/";
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_NAMESPACE_ID = process.env.CF_NAMESPACE_ID!;
const CF_API_TOKEN = process.env.CF_API_TOKEN!;

async function fetchBlocklist(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch gagal: ${res.statusText}`);
  const text = await res.text();

  // Parsing: ambil domain saja
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"))
    .map(l => {
      const parts = l.split(/\s+/);
      return parts.length > 1 ? parts[1] : parts[0];
    })
    .filter(d => d && !d.includes("localhost"));
}

async function pushToKV(domains: string[]) {
  console.log(`Mengupload ${domains.length} domain ke KV...`);

  const headers = {
    "Authorization": `Bearer ${CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  // batched upload
  const chunkSize = 5000;
  for (let i = 0; i < domains.length; i += chunkSize) {
    const batch = domains.slice(i, i + chunkSize);
    const kvItems = batch.map(domain => ({
      key: domain,
      value: "1",
    }));

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}/bulk`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(kvItems),
      }
    );

    const json = await res.json();
    if (!json.success) {
      console.error(`❌ Gagal upload batch ke-${i / chunkSize}:`, json.errors);
    } else {
      console.log(`✅ Batch ${i / chunkSize + 1} (${batch.length} keys) sukses`);
    }
  }
}

(async () => {
  try {
    const domains = await fetchBlocklist(OISD_URL);
    console.log(`Berhasil ambil ${domains.length} domain`);
    await pushToKV(domains);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
