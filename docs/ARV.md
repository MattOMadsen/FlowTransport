# Arv-liste: Flowtown → FlowTransport

**Princip:** Genbrug *indhold og design*. Genbyg *motor* (graf, trafik, input).  
Kilde: `../Flowtown/`

## Kopieret som-is (assets)

| Fra Flowtown | Til FlowTransport | Note |
|--------------|-------------------|------|
| `assets/places/*.png` | `assets/places/` | capital, town, farm, factory, harbor |
| `assets/vehicles/*.png` | `assets/vehicles/` | car, truck, bus, van, … |
| `assets/tiles/*.png` | `assets/tiles/` | græs, vand, skov, asfalt |
| `assets/icons/tools/*.png` | `assets/icons/tools/` | UI-ikoner |
| Kenney license | `assets/` | CC0 road-tekstur (hvis brugt) |

**Ikke** kopieret: `_backup_*` mapper.

## Design / data (oversat, renset)

| Idé | Flowtown-kilde | FlowTransport |
|-----|----------------|---------------|
| Jobtyper 👤📦 | `js/jobs.js` | `js/jobs.js` (kun passengers + cargo i MVP) |
| Stedtyper + DK-navne | `js/places.js` | `js/places.js` |
| Scenarier / 3 stjerner | `js/scenarios.js` | `js/scenarios.js` (intro + kyst) |
| XP / stjerner | `js/meta.js` | `js/meta.js` (minimal) |
| Flåde-klasser (forenklet) | `js/fleet.js` | `js/fleet.js` (car + truck) |
| UI safe-zones | `AGENTS.md` | `AGENTS.md` |
| Input-kontrakt | `STABILISERING.md` | `docs/KERNE.md` + `js/input.js` |
| Lærte fejl | `AGENTS.md` tabel | `AGENTS.md` (udvalgte) |

## Bevidst **ikke** arvet (kode)

| Modul | Hvorfor |
|-------|---------|
| `game.js` (~4800 linjer) | Monolit – kilde til småfejl |
| `vehicle.js` stuck/soft-arrive | Ny rute-model i stedet |
| Pathfinding “gæt segment” | Erstattes af eksplicit graf + A* |
| Bots, rush hour, vejr, cloud | Senere – efter stabil kerne |
| Canvas-draw monolit | Ny 2.5D render-modul |
| Service worker / cache-bøvl | MVP uden PWA først |

## Balance-startpunkt (fra Flowtown, justeret)

- Startpenge intro: **1600**
- Vejpris: ~**0.45 kr/px** (billigere end gammel irriterende pris)
- Levering: base + pr. enhed + distance
- Ingen stuck-bøde i MVP (biler skal ikke “straffes for bugs”)

## Navn

- **FlowTransport** (repo + produkt)  
- Flowtown = tidligere prototype (reference only)
