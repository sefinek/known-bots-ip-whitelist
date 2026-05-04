# Changelog

## [3.2.1] — 2026-05-04

### Added
- **GPTBot** — official OpenAI crawler for AI model training (`lists/gptbot/`)
- **OpenAI SearchBot** — crawler for ChatGPT Search results (`lists/oai-searchbot/`)
- **ChatGPT User** — user-initiated browser agent for ChatGPT (`lists/chatgpt-user/`)

### Changed
- **OpenAI source** — replaced unofficial GitHub mirror with official `openai.com` endpoints; source split into three separate per-bot lists
- **Global list deduplication fix** — individual IPs from one source are no longer suppressed by a CIDR range from a different source (e.g. Cloudflare DNS resolver IPs such as `2606:4700:4700::1113` now correctly appear in `all-safe-ips` and `all-infrastructure-ips`)


## [3.2.0] — 2026-05-03

### Added
- **Canonical (AS41231)** — new `lists/canonical/` with IP ranges for Canonical Ltd. (Ubuntu infrastructure)
- **Category-based combined lists** — three new aggregate files generated alongside `all-safe-ips`:
  - `lists/all-crawlers-ips` — search engines, SEO tools, AI crawlers and web testing bots
  - `lists/all-monitoring-ips` — uptime monitoring services and internet scanners
  - `lists/all-infrastructure-ips` — CDN providers, hosting networks, DNS resolvers and web services


## [3.1.0] — 2026-04-27

### Added
- **DNS Resolvers list** — new `lists/dns-resolvers/` with 72 entries (IPv4 + IPv6): Cloudflare (standard + Families), Google Public DNS, Quad9, OpenDNS (standard + FamilyShield), AdGuard DNS (standard + Family + Non-filtering), CleanBrowsing (Security / Adult / Family), Yandex DNS (Basic / Safe / Family), Level3 / Lumen Technologies

### Changed
- **Per-source JSON `name` field** — custom file sources now use the section name from the file (e.g. `"Cloudflare DNS"`, `"AdGuard DNS Family"`) instead of the generic source name (e.g. `"DNS Resolvers"`)
- **Global list deduplication** — specific IPs already covered by a CIDR range are now skipped in the global list, eliminating redundant entries (e.g. `77.88.8.7` covered by `77.88.0.0/18`)


## [3.0.0] - 2026-04-24

### JSON format update (April 2026)

The structure of all JSON files has changed. If you consume any `ips.json` file, update your code accordingly.

**Old format (`all-safe-ips.json`):**
```json
{"IP":"1.2.3.4","Name":"Censys","Names":["Censys"],"Sources":"https://...","SourcesList":["https://..."]}
```

**New format (all JSON files):**
```json
{"ip":"1.2.3.4","name":"Censys","sources":["https://..."]}
```

Changes:
1. `IP` → `ip` (lowercase, consistent across all files)
2. `Name` + `Names` → `name` (single string, no duplication)
3. `Sources` + `SourcesList` → `sources` (array of source URLs only)
4. Per-service files (`lists/<name>/ips.json`): `name` is now the display name (e.g. `"Censys"`) instead of the directory slug (e.g. `"censys"`)