# Changelog

## [3.1.0] — 2026-04-27

### Added
- **DNS Resolvers list** — new `lists/dns-resolvers/` with 72 entries (IPv4 + IPv6): Cloudflare (standard + Families), Google Public DNS, Quad9, OpenDNS (standard + FamilyShield), AdGuard DNS (standard + Family + Non-filtering), CleanBrowsing (Security / Adult / Family), Yandex DNS (Basic / Safe / Family), Level3 / Lumen Technologies

### Changed
- **Per-source JSON `name` field** — custom file sources now use the section name from the file (e.g. `"Cloudflare DNS"`, `"AdGuard DNS Family"`) instead of the generic source name (e.g. `"DNS Resolvers"`)
- **Global list deduplication** — specific IPs already covered by a CIDR range are now skipped in the global list, eliminating redundant entries (e.g. `77.88.8.7` covered by `77.88.0.0/18`)
