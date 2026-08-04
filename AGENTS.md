# FlowTransport – agentregler

Hyggeligt mini-transportspil, **2.5D Canvas**, dansk UI.  
Ikke en kopi af Flowtowns monolit – se `docs/ARV.md` og `docs/KERNE.md`.

Token-sparende loop: `docs/TOKEN-WORKFLOW.md` + `.grok/workflows/feature-loop.rhai`.

---

## Token-disciplin (obligatorisk)

1. **Én opgave pr. tur** (eller max 1–3 tæt forbundne fixes).  
2. **Stop når DoD er opfyldt** – ingen “mens vi alligevel er her”.  
3. **Ingen** bots, rush hour, vejr, PWA, cloud, monolit-refactors medmindre det *er* målet.  
4. Efter implementering: `node --check` på berørte `js/*`.  
5. Ved tvivl: spørg eller vælg det **mindste** sikre fix.  
6. Store features → foreslå split før du koder alt.

### Definition of Done (skabelon)

Kopiér ind i opgaven / workflow `args.criteria`:

```
Mål: <én sætning>

Skal virke:
- [ ] <bruger-synligt resultat>
- [ ] <teknisk invariant, fx graf/rute/input>

Må ikke:
- [ ] Nye features uden for mål
- [ ] Stuck/soft-arrive-hacks
- [ ] Pinch der bygger vej
- [ ] UI der permanent dækker by-hubs

Verificér:
- [ ] node --check på ændrede js-filer
- [ ] Manuel: <1–3 trin, fx tegn vej A→B, bil leverer>
```

### Eksempel på god bruger-besked

> Feature: slet ét vejstykke med 85 % refund.  
> DoD: graf opdateres, biler repath/abort rent, undo-stack OK.  
> Stop når DoD er opfyldt. Ingen ekstra features.

### Eksempel på dårlig (dyr) besked

> Gør spillet meget bedre og fix alt der er galt.

---

## Workflow (daglig)

1. Svar brugeren på **dansk**.  
2. Efter batch: status + **næste 1–3 skridt**; commit/push kun hvis bedt / aftalt.  
3. Commit **ikke** `data/`.  
4. Hold filer små: `graph`, `vehicle`, `input`, `render`, `game` (tynd orkestrator).  
5. **Ingen** stuck-hacks eller soft-arrive – fix grafen.  
6. Feature-loop (valgfrit): `/workflow feature-loop` med `goal` + `criteria` – max 1 fix-runde, score ≥ 8.

---

## UI

- HUD top; værktøjer nederst midt; undgå permanente paneler over byer.  
- Touch-targets ≥ 44px.  
- `preventDefault` kun på canvas, ikke hele body.

## Kamera / input

- Se `docs/KERNE.md`.  
- States: idle | pending | draw | pan | pinch.  
- Pinch bygger **aldrig** vej.

## Trafik

- Ruter er faste lister af edges.  
- A* på `RoadGraph`.  
- Bil-states: park → to_pickup → loading → to_dropoff → unload → park.  
- T-kryds: split vej + junction-node (ikke kun visuelt snap).

## Lærte fejl (fra Flowtown – husk dem)

| Fejl | Læring |
|------|--------|
| UI dækker byer | Safe-zones; foldbare paneler |
| Pinch laver vej | State machine + cancel draw |
| Biler stuck | Eksplicit rute, ikke frame-gæt |
| Bil “tilbage med last” | cargo=0 i park; last kun efter pickup |
| Sprite sidelæns | Næse op i art; roter korrekt i 2.5D |
| Multi-tur home→from fra destination | Efter unload: path to→from |
| claimedBy hænger | Ryd claimedBy ved abort/finish |

## Repo

- GitHub: `https://github.com/MattOMadsen/FlowTransport`  
- Lokalt: denne mappe  
- Feature-loop: `.grok/workflows/feature-loop.rhai`
