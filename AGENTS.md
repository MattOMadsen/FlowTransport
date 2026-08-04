# FlowTransport – agentregler

Hyggeligt mini-transportspil, **2.5D Canvas**, dansk UI.  
Ikke en kopi af Flowtowns monolit – se `docs/ARV.md` og `docs/KERNE.md`.

## Workflow

1. Svar brugeren på **dansk**.
2. Efter batch: status + næste skridt; **commit + push** hvis brugeren vil have det på GitHub.
3. Commit **ikke** `data/`.
4. Hold filer små: kerne-logik i egne moduler (`graph`, `vehicle`, `input`, `render`).
5. **Ingen** stuck-hacks eller soft-arrive. Fix grafen i stedet.
6. 1–3 features ad gangen. Test path + tegning efter vej-ændringer.

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

## Lærte fejl (fra Flowtown – husk dem)

| Fejl | Læring |
|------|--------|
| UI dækker byer | Safe-zones; foldbare paneler |
| Pinch laver vej | State machine + cancel draw |
| Biler stuck | Eksplicit rute, ikke frame-gæt |
| Bil “tilbage med last” | cargo=0 i park; last kun efter pickup |
| Sprite sidelæns | Næse op i art; roter korrekt i 2.5D |

## Repo

- GitHub: `https://github.com/MattOMadsen/FlowTransport`
- Lokalt: denne mappe
