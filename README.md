# 🤖 Known Bots IP Whitelist
This repository contains up-to-date lists of IP addresses of known bots and crawlers, useful for whitelisting or filtering network traffic. They can also be used as blacklists.

Do you have any questions or want to receive notifications about important changes or new features in my repositories?
Join my [Discord server](https://discord.gg/S7NDzCzQTg)! If you don't use Discord, you can also open an issue on GitHub.

The project is released under the [MIT license](LICENSE) — you can do whatever you want with it.  
If you like this repository, leave a star ⭐. Thank you!


## ⚠️ Breaking Changes

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
- `IP` → `ip` (lowercase, consistent across all files)
- `Name` + `Names` → `name` (single string, no duplication)
- `Sources` + `SourcesList` → `sources` (array of source URLs only)
- Per-service files (`lists/<name>/ips.json`): `name` is now the display name (e.g. `"Censys"`) instead of the directory slug (e.g. `"censys"`)


## ⏱️ Update Schedule
Lists are updated every `6 hours`.


## 🌍 Supported Services

| Service                        | Sources                                                                                                                                                                                                | Downloads                                                                                                                                                                                                                                                                                                                                                                              |
|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GoogleBot                      | [developers.google.com](https://developers.google.com/static/crawling/ipranges/common-crawlers.json)                                                                                                   | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/googlebot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/googlebot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/googlebot/ips.json)                                                                |
| Google Special Crawlers        | [developers.google.com](https://developers.google.com/static/crawling/ipranges/special-crawlers.json)                                                                                                  | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-special-crawlers/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-special-crawlers/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-special-crawlers/ips.json)                      |
| Google User-Triggered Fetchers | [Fetchers](https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers.json) & [Google](https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json) | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-user-triggered-fetchers/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-user-triggered-fetchers/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/google-user-triggered-fetchers/ips.json) |
| BingBot                        | [www.bing.com](https://www.bing.com/toolbox/bingbot.json)                                                                                                                                              | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bingbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bingbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bingbot/ips.json)                                                                      |
| DuckDuckBot                    | [duckduckgo.com](https://duckduckgo.com/duckduckbot.json)                                                                                                                                              | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/duckduckbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/duckduckbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/duckduckbot/ips.json)                                                          |
| YandexBot                      | [yandex.com](https://yandex.com/ips)                                                                                                                                                                   | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/yandexbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/yandexbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/yandexbot/ips.json)                                                                |
| Kagi                           | [Custom lists](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/custom/kagi.txt)                                                                                                 | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/kagi/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/kagi/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/kagi/ips.json)                                                                               |
| AhrefsBot                      | [api.ahrefs.com](https://api.ahrefs.com/v3/public/crawler-ips)                                                                                                                                         | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/ahrefsbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/ahrefsbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/ahrefsbot/ips.json)                                                                |
| Semrush                        | RIPEstat & RADB                                                                                                                                                                                        | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/semrush/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/semrush/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/semrush/ips.json)                                                                      |
| OpenAI                         | [GitHub](https://raw.githubusercontent.com/FabrizioCafolla/openai-crawlers-ip-ranges/main/openai/openai-ip-ranges-all.txt)                                                                             | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/openai/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/openai/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/openai/ips.json)                                                                         |
| Censys                         | RIPEstat & RADB & ARIN                                                                                                                                                                                 | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/censys/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/censys/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/censys/ips.json)                                                                         |
| Modat Scanner                  | [scanner.modat.io](https://scanner.modat.io/ipv4.txt)                                                                                                                                                  | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/modat/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/modat/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/modat/ips.json)                                                                            |
| NASK PL                        | RIPEstat & RADB                                                                                                                                                                                        | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/nask/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/nask/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/nask/ips.json)                                                                               |
| Palo Alto Networks             | RADB & ARIN                                                                                                                                                                                            | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/paloaltonetworks/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/paloaltonetworks/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/paloaltonetworks/ips.json)                                           |
| Shodan                         | [Custom lists](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/custom/shodan.txt)                                                                                               | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/shodan/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/shodan/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/shodan/ips.json)                                                                         |
| Bunny CDN                      | [IPv4](https://api.bunny.net/system/edgeserverlist/plain) & [IPv6](https://api.bunny.net/system/edgeserverlist/ipv6)                                                                                   | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bunnycdn/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bunnycdn/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/bunnycdn/ips.json)                                                                   |
| Cloudflare                     | [IPv4](https://www.cloudflare.com/ips-v4) & [IPv6](https://www.cloudflare.com/ips-v6)                                                                                                                  | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/cloudflare/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/cloudflare/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/cloudflare/ips.json)                                                             |
| BetterStack                    | [uptime.betterstack.com](https://uptime.betterstack.com/ips.txt)                                                                                                                                       | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/betterstack/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/betterstack/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/betterstack/ips.json)                                                          |
| PingdomBot                     | [IPv4](https://my.pingdom.com/probes/ipv4) & [IPv6](https://my.pingdom.com/probes/ipv6)                                                                                                                | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pingdombot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pingdombot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pingdombot/ips.json)                                                             |
| Pulsetic                       | [IPv4](https://api.pulsetic.com/ip-ranges.txt) & [IPv6](https://api.pulsetic.com/ipv6-ranges.txt)                                                                                                      | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pulsetic/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pulsetic/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/pulsetic/ips.json)                                                                   |
| UptimeRobot                    | [uptimerobot.com](https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt)                                                                                                                               | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/uptimerobot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/uptimerobot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/uptimerobot/ips.json)                                                          |
| WebPageTest Bot                | [www.webpagetest.org](https://www.webpagetest.org/addresses.php?f=json)                                                                                                                                | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/webpagetestbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/webpagetestbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/webpagetestbot/ips.json)                                                 |
| FacebookBot                    | RIPEstat & RADB & ARIN                                                                                                                                                                                 | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/facebookbot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/facebookbot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/facebookbot/ips.json)                                                          |
| TelegramBot                    | [core.telegram.org](https://core.telegram.org/resources/cidr.txt)                                                                                                                                      | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/telegrambot/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/telegrambot/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/telegrambot/ips.json)                                                          |
| RSS API                        | [rssapi.net](https://rssapi.net/ips.txt)                                                                                                                                                               | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/rssapi/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/rssapi/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/rssapi/ips.json)                                                                         |
| Stripe                         | [stripe.com](https://stripe.com/files/ips/ips_webhooks.txt)                                                                                                                                            | [TXT](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/stripewebhook/ips.txt) • [CSV](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/stripewebhook/ips.csv) • [JSON](https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/stripewebhook/ips.json)                                                    |


## 📘 List of All IP Addresses

### 📄 TXT
```text
https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.txt
```
#### Curl
```bash
curl -fsSLO https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.txt
```
#### Wget
```bash
wget -q https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.txt
```

### 📑 CSV
```text
https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.csv
```
#### Curl
```bash
curl -fsSLO https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.csv
```
#### Wget
```bash
wget -q https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.csv
```

### 🔤 JSON
```text
https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.json
```
#### Curl
```bash
curl -fsSLO https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.json
```
#### Wget
```bash
wget -q https://raw.githubusercontent.com/sefinek/known-bots-ip-whitelist/main/lists/all-safe-ips.json
```
