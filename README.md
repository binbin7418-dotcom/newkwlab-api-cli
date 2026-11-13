# nkw — NewKwLab API Bundle CLI

Command-line client for the NewKwLab API Bundle gateway: one API key, one
credit balance, many tools (email / phone / card validation, VAT, LEI,
sanctions screening, nonprofit and recall checks, airport data, …).

- Not-found results cost **0 credits**; repeat calls within 24h hit the cache
  and cost **0 credits**; upstream errors cost **0 credits**.

## Install

```bash
npm install -g @newkwlab/api-bundle-cli
```

(Requires Node.js 18+. Zero dependencies.)

> Status: pre-release. Until the npm package is published, run it from this
> folder: `node src/cli.mjs <command>` (or `npm link` to get the `nkw` command).

## Setup

```bash
export NKW_API_KEY="nkw_live_..."   # your aggregate API key
# export NKW_BASE_URL="https://api.newkwlab.com/gateway"  # default, usually unset
```

Don't have a key yet? Activate a Gumroad license:

```bash
nkw activate XXXX-XXXX-XXXX-XXXX newkwlab-credits-30000
# -> { "activated": true, "granted_credits": 30000, "api_key": "nkw_live_...", ... }
# The api_key is shown once — save it immediately.
```

## Commands

```bash
nkw health                                   # gateway health (no key needed)
nkw usage                                    # balance, credit lots, per-product usage
nkw usage --history                          # recent ledger entries
nkw emailcheck alice@gmail.com               # EmailCheck — 1 credit
nkw phonecheck +14155552671                  # PhoneCheck — 1 credit
nkw cardcheck 4242424242424242               # CardCheck — 1 credit
nkw call airportbase /airport --param code=LAX          # any product — 2 credits
nkw call leilookup /lei/5493006MFDD84DZ89524            # 0 credits if no record
nkw call vatscope /vat --param country=DE --param vat=123456789
nkw call emailcheck /validate/batch --method POST --body '{"emails":["a@b.com","c@d.com"]}'
```

Product results are printed as JSON on stdout. For product calls, a summary
line goes to stderr: `# credits charged: 1, balance: 29999, cache: MISS`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (HTTP 2xx) |
| 1 | Local error (missing key, bad arguments, network failure) |
| 2 | Gateway returned an error (HTTP status and error code printed to stderr) |

Gateway error codes include `UNAUTHORIZED` (401), `INSUFFICIENT_CREDITS`
(402), `CAPABILITY_DENIED` (403), `PRODUCT_NOT_CONNECTED` (503),
`RATE_LIMITED` (429). See the JS SDK README for the full table.

## License

MIT
