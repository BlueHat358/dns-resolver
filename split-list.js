import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const OISD_URL = "https://big.oisd.nl/";
const CHUNK_SIZE = 50000; // Ukuran setiap file bagian
const OUTPUT_DIR = "blocklist_parts"; // Nama folder output

async function fetchAndCleanBlocklist(url) {
  console.log(`📥 Mengambil dan membersihkan blocklist dari ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal fetch: ${res.statusText}`);

  const text = await res.text();
  const domains = new Set(); // Menggunakan Set untuk otomatis menangani duplikat

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("[")) continue;

    let domain = trimmed;
    if (domain.startsWith("||")) domain = domain.substring(2);
    if (domain.endsWith("^")) domain = domain.slice(0, -1);
    
    if (domain && !domain.includes("localhost")) {
      domains.add(domain);
    }
  }
  console.log(`✅ Ditemukan ${domains.size} domain unik.`);
  return Array.from(domains); // Ubah kembali ke array untuk dipecah
}

function splitAndSave(domains) {
  console.log(`🔪 Membagi daftar menjadi beberapa file (ukuran per file: ${CHUNK_SIZE})...`);
  
  // Buat folder output jika belum ada
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  let fileIndex = 1;
  for (let i = 0; i < domains.length; i += CHUNK_SIZE) {
    const chunk = domains.slice(i, i + CHUNK_SIZE);
    const filePath = path.join(OUTPUT_DIR, `part_${fileIndex}.txt`);
    fs.writeFileSync(filePath, chunk.join("\n"));
    console.log(`📄 Berhasil menyimpan ${filePath} dengan ${chunk.length} domain.`);
    fileIndex++;
  }
}

(async () => {
  try {
    const domains = await fetchAndCleanBlocklist(OISD_URL);
    splitAndSave(domains);
    console.log("🎉 Proses pembagian file selesai!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
