/**
 * Читает rewrites.json и собирает nginx-конфиг с зашитым destination.
 * Меняйте только rewrites.json — env для API не нужны.
 */
import { readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync("rewrites.json", "utf8"));
const apiRewrite = config.rewrites?.find(
  (r) => typeof r.source === "string" && r.source.includes("/api"),
);

if (!apiRewrite?.destination) {
  throw new Error(
    'rewrites.json: нужен rewrite вида { "source": "/api/(.*)", "destination": "https://..." }',
  );
}

const backend = String(apiRewrite.destination).replace(/\/$/, "");
if (!/^https?:\/\//i.test(backend)) {
  throw new Error(`rewrites.json: destination должен быть полным URL, сейчас: ${backend}`);
}

const template = readFileSync("nginx.conf.template", "utf8");
if (!template.includes("__BACKEND_URL__")) {
  throw new Error("nginx.conf.template: нет плейсхолдера __BACKEND_URL__");
}

writeFileSync(
  "nginx.conf.generated.template",
  template.replaceAll("__BACKEND_URL__", backend),
);

console.log(`nginx: /api/* → ${backend}/api/*`);
