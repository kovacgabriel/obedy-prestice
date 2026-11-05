# Obědy v Přešticích

Denní menu přeštických restaurací v jedné PWA (iPhone i Android, „Přidat na plochu“).

```
config/restaurants.json   ← seznam restaurací (jediné místo, kde se přidává)
scraper/                  ← Node skript → web/data/menus.json
web/                      ← statická PWA (bez buildu), čte jen data/menus.json
.github/workflows/        ← cron + nasazení na GitHub Pages
```

## Spuštění
```bash
cd scraper && npm ci && npm test && npm run scrape   # stáhne menu do web/data/menus.json
cd ../web && python3 -m http.server 8080             # http://localhost:8080
```

## Přidání restaurace
1. Přidej záznam do `config/restaurants.json` (`source.adapter` = název souboru v `scraper/src/adapters/`).
2. Adaptér exportuje `scrape(source) → { days: { "YYYY-MM-DD": { items:[{type:"soup|main|weekly",name,price,allergens,tags}], images?:[url] } } }`.
   - `linkonly` = jen odkaz (karta ukáže „zdroj“, bez stahování).
3. Přidej fixture + test do `scraper/test/`.

## Zdroje
| Restaurace | Zdroj | Adaptér |
|---|---|---|
| Tady je Přeškovo! (dříve U Přeška) | tadyjepreskovo.cz – HTML | `preskovo` |
| Crossroad | crossroadrestaurant.cz – menu jako obrázky | `crossroad` (obrázek v appce; s `ANTHROPIC_API_KEY` i text) |
| Cukrárna v Háječku | cukrarnavhajecku.cz/poledni-menu | `linkonly` (zatím) |

## Nasazení
GitHub → Settings → Pages → Source: GitHub Actions. Volitelně secret `ANTHROPIC_API_KEY`.
Při chybě zdroje se zachová poslední známé menu a karta ukáže „staženo / poslední úspěšně“.
