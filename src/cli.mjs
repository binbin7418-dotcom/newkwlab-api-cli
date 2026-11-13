#!/usr/bin/env node
// nkw — command-line client for the NewKwLab API Bundle gateway.
// Zero dependencies; talks to the same gateway as the JS SDK
// (default https://api.newkwlab.com/gateway, override with NKW_BASE_URL).
//
// Usage:
//   nkw health
//   nkw activate <license_key> <product_permalink>
//   nkw usage [--history]
//   nkw call <product> <endpoint> [--param key=value ...] [--method POST] [--body '<json>']
//   nkw emailcheck <email> | phonecheck <phone> | cardcheck <number>
//
// Auth: NKW_API_KEY env var (nkw_live_...). Base URL: NKW_BASE_URL env var.

const BASE_URL = (process.env.NKW_BASE_URL ?? "https://api.newkwlab.com/gateway").replace(/\/+$/, "");
const API_KEY = process.env.NKW_API_KEY ?? null;

function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

async function request(method, path, { body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    if (!API_KEY) fail("NKW_API_KEY is not set — export your aggregate API key first (nkw_live_...).");
    headers["authorization"] = `Bearer ${API_KEY}`;
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    fail(`request to ${BASE_URL} failed: ${e.message}`);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { res, data };
}

function printResult({ res, data }, { showCredits = false } = {}) {
  console.log(JSON.stringify(data, null, 2));
  if (showCredits) {
    const charged = res.headers.get("x-credits-charged");
    const balance = res.headers.get("x-credits-balance");
    const cache = res.headers.get("x-cache");
    if (charged !== null) console.error(`# credits charged: ${charged}, balance: ${balance}, cache: ${cache}`);
  }
  if (!res.ok) {
    // Gateway errors use { error: { code } }; upstream error bodies pass
    // through verbatim and may use the flat { code, error } shape instead.
    const code = data?.error?.code ?? data?.code ?? "UNKNOWN_ERROR";
    console.error(`# HTTP ${res.status} ${code}`);
    process.exit(2);
  }
}

function parseFlags(args) {
  const positional = [];
  const params = {};
  let method = "GET";
  let body;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--param") {
      const kv = args[++i] ?? "";
      const eq = kv.indexOf("=");
      if (eq < 1) fail(`--param expects key=value, got "${kv}"`);
      params[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (a === "--method") {
      method = (args[++i] ?? "").toUpperCase();
      if (!method) fail("--method expects a value (GET, POST, ...)");
    } else if (a === "--body") {
      try { body = JSON.parse(args[++i] ?? ""); } catch { fail("--body expects valid JSON"); }
    } else {
      positional.push(a);
    }
  }
  return { positional, params, method, body };
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "health": {
    printResult(await request("GET", "/health", { auth: false }));
    break;
  }
  case "activate": {
    const [licenseKey, permalink] = rest;
    if (!licenseKey || !permalink) fail("usage: nkw activate <license_key> <product_permalink>");
    printResult(await request("POST", "/v1/activate", {
      auth: false,
      body: { license_key: licenseKey, product_permalink: permalink },
    }));
    break;
  }
  case "usage": {
    if (rest.includes("--history")) {
      printResult(await request("GET", "/v1/usage/history?days=30&limit=50&offset=0"));
    } else {
      printResult(await request("GET", "/v1/usage"));
    }
    break;
  }
  case "call": {
    const { positional, params, method, body } = parseFlags(rest);
    const [product, endpoint] = positional;
    if (!product || !endpoint) fail("usage: nkw call <product> <endpoint> [--param key=value ...]");
    const ep = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const q = new URLSearchParams(params).toString();
    printResult(await request(method, `/v1/${product}${ep}${q ? `?${q}` : ""}`, { body }), { showCredits: true });
    break;
  }
  case "emailcheck":
  case "phonecheck":
  case "cardcheck": {
    const value = rest[0];
    if (!value) fail(`usage: nkw ${cmd} <value>`);
    const param = { emailcheck: "email", phonecheck: "phone", cardcheck: "number" }[cmd];
    const q = new URLSearchParams({ [param]: value }).toString();
    printResult(await request("GET", `/v1/${cmd}/validate?${q}`), { showCredits: true });
    break;
  }
  case undefined:
  case "help":
  case "--help":
  case "-h": {
    console.log(`nkw — NewKwLab API Bundle CLI

Commands:
  nkw health                                   Gateway health check (no key needed)
  nkw activate <license_key> <permalink>       Activate a Gumroad license -> credits + API key
  nkw usage [--history]                        Balance, credit lots and usage (or ledger history)
  nkw call <product> <endpoint> [options]      Call any connected product
      --param key=value   query parameter (repeatable)
      --method POST       HTTP method (default GET)
      --body '<json>'     JSON request body
  nkw emailcheck <email>                       EmailCheck (1 credit)
  nkw phonecheck <phone>                       PhoneCheck (1 credit)
  nkw cardcheck <number>                       CardCheck (1 credit)

Environment:
  NKW_API_KEY   your aggregate API key (nkw_live_...)
  NKW_BASE_URL  gateway base URL (default https://api.newkwlab.com/gateway)`);
    break;
  }
  default:
    fail(`unknown command "${cmd}" — run "nkw help"`);
}
