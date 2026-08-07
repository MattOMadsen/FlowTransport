# FlowTransport

**Hyggeligt mini transport-spil** i browseren (2.5D).  
Tegn veje mellem byer, send biler på opgaver, tjen penge – uden tung micro-management.

> Genstart af idéen fra *Flowtown*, med **ren graf + faste ruter** i stedet for den gamle trafik-monolit.  
> Se [docs/ARV.md](docs/ARV.md) og [docs/KERNE.md](docs/KERNE.md).

## Spil

1. Vælg bane  
2. **Tegn veje** (ét finger-træk) mellem steder  
3. Biler **henter jobs automatisk** når der er sti  
4. **Tryk på by** → køb personbil / lastbil  
5. Opnå **stjerner** (leverancer, forbind alle, penge)

**Mobil:** pan med long-press eller Pan-værktøj · pinch for zoom · Fit tilpasser kortet.

## Kør lokalt

ES-moduler kræver en lokal server:

```bash
npx --yes serve .
# eller: python3 -m http.server 8080
```

Åbn den viste URL.

## Teknik

- Vanilla JS (ES modules) + Canvas **2.5D** (isometrisk projektion)
- `RoadGraph` + A* – biler følger **faste ruter**
- Moduler: `graph`, `vehicle`, `input`, `render`, `game`, …
- Assets fra Flowtown (steder, køretøjer, tiles)

## Agenter & tokens

- [AGENTS.md](AGENTS.md) – regler + **Definition of Done**-skabelon  
- [docs/TOKEN-WORKFLOW.md](docs/TOKEN-WORKFLOW.md) – billig implement→review-loop  
- Workflow: `.grok/workflows/feature-loop.rhai` (score ≥ 8, max 1 fix-runde)

## Repo

https://github.com/MattOMadsen/FlowTransport

## Licens

Spilkode: privat/egen. Kenney-assets: se `assets/` hvis CC0-filer er inkluderet.
