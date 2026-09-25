import { readFileSync } from "node:fs";

// Load the local .env into process.env (no dotenv dependency) so DB integration
// tests can connect. If .env is absent (e.g., CI), DATABASE_URL stays unset and
// the integration tests skip themselves.
try {
  const env = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env present; integration tests will skip.
}
