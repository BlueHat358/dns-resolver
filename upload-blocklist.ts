import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const KV_NAMESPACE_BINDING = "DNS_BLOCKLIST_OISD";
const DEFAULT_BLOCKLIST_URL = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts";
const FETCH_TIMEOUT_MS = 30000;
const CONCURRENCY = 10;

async function fetchAndParseList(url: string): Promise<Set<string>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Gagal fetch: ${response.statusText}`);

    const text = await response.text();
    const domains = new Set<string>();

    for (const line of text.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && !parts[1].startsWith("#") && parts[1] !== "localhost") {
        domains.add(parts[1]);
      }
    }
    return domains;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadToKv(domains: Set<string>, binding: string) {
  const list = Array.from(domains);
  let success = 0, fail = 0;

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (d) => {
      try {
        await execPromise(`npx wrangler kv:key put --binding ${binding} "${d}" "1" --quiet`);
        success++;
      } catch { fail++; }
    }));
    console.log(`Uploaded ${i + batch.length}/${list.length}`);
  }

  console.log(`✅ Done. Success: ${success}, Fail: ${fail}`);
}

(async () => {
  const url = process.argv[2] || DEFAULT_BLOCKLIST_URL;
  const domains = await fetchAndParseList(url);
  console.log(`Parsed ${domains.size} domains. Uploading...`);
  await uploadToKv(domains, KV_NAMESPACE_BINDING);
})();
