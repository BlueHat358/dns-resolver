import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Variabel akan diambil dari GitHub Actions
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE_ID = process.env.CF_NAMESPACE_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const PART_INDEX = process.env.PART_INDEX; // Bagian ke berapa yang akan diunggah
const INPUT_DIR = "blocklist_parts";

if (!CF_ACCOUNT_ID || !CF_NAMESPACE_ID || !CF_API_TOKEN || !PART_INDEX) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

async function uploadPart(filePath) {
  console.log(`🚀 Mengupload file ${filePath} ke Cloudflare KV...`);
  if (!fs.existsSync(filePath)) {
    console.log("✅ Semua bagian sudah diunggah. Tidak ada lagi yang perlu dilakukan.");
    return;
  }

  const domains = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  if (domains.length === 0) {
    console.log("File bagian kosong, tidak ada yang diunggah.");
    return;
  }
  
  const headers = {
    "Authorization": `Bearer ${CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  
  const kvItems = domains.map(domain => ({ key: domain, value: "1" }));
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}/bulk`;
  
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(kvItems),
  });

  const json = await res.json();
  if (!json.success) {
    console.error(`❌ Gagal mengupload ${filePath}:`, json.errors);
    throw new Error("Gagal mengupload batch ke KV.");
  } else {
    console.log(`✅ Berhasil mengupload ${domains.length} keys dari ${filePath}`);
  }
}

(async () => {
  try {
    const filePath = path.join(INPUT_DIR, `part_${PART_INDEX}.txt`);
    await uploadPart(filePath);
    console.log("🎉 Proses unggah hari ini selesai!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
