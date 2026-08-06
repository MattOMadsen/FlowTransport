# Teknisk kerne – FlowTransport (2.5D)

## Visning: 2.5D (ikke fuld 3D)

- **Canvas 2D** med skrå “isometrisk-agtig” projektion:
  - Verden: flade `x, y`
  - Skærm: `sx = (x - y) * cosθ`, `sy = (x + y) * sinθ` (klassisk iso-lignende)
  - Sprites tegnes med skygge + dybdesortering efter `(x+y)`
- **Ikke** Three.js i v1 – undgår 3D-kompleksitet; ser stadig moderne ud.
- Kamera: pan + zoom i skærm-space (efter projektion).

## Data-model

```
Place  → nodeId (hub)
Road   → polyline points + edgeId(s)
Graph  → nodes[], edges[] (for pathfinding)
Vehicle → state + fixed route (edge ids + direction)
Job    → from Place → to Place
```

### Graf (hjerte)

- **Node:** `{ id, x, y, placeId? }`
- **Edge:** `{ id, a, b, roadId, length, oneWay: 0 }`  
  Geometri ligger på `Road.points`; edge forbinder ender (og knuder ved snap).
- Når en vej **committes**:
  1. Snap start/slut til nærmeste node (sted eller vej) inden for radius
  2. Ellers opret nye noder
  3. Opret edge; rebuild adjacency
- **A\*** / BFS på noder – **ikke** per-frame “find næste segment”.

### Bil-states (eksplicit)

```
park → to_pickup → loading → to_dropoff → unload → park
```

- Ved assign: beregn rute `home/hub → job.from` og `from → to` **én gang**.
- Bil følger `route: { edges: [{edgeId, reverse}], edgeIndex, t }`.
- Ved manglende sti: job afvises / bil bliver i park (toast) – **ingen** stuck-loop.
- Ved ankomst: `t` rammer 0.98 → skift state. Ingen “soft arrive efter 8s idle”.

### Hvorfor det er bedre end Flowtown

| Flowtown | FlowTransport |
|----------|---------------|
| Omvalg af vej hvert frame | Fast rute |
| stuck + penalty | Ingen stuck-straf |
| Soft-arrive hacks | Tærskel på t |
| Alt i game.js | graph / vehicle / render / input adskilt |
| For mange features | MVP først |

## Input (fra STABILISERING)

States: `idle | pending | draw | pan | pinch`  
Regler:

- Pinch **committer aldrig** vej
- 2. finger under draw → **cancel** streg
- Long-press → pan
- 1 finger træk → draw (tool=draw)

## Økonomi (MVP)

- Tegn vej koster penge (længde × rate + fast start)
- Levering giver reward
- Køb bil i by-shop (tap by)
- Undo: slet sidste vej med delvis refund
- Vejklasser: alm (1×) → 2-spor (~1,28×) → motorvej (~1,72× + bilbonus for car/van)

## Progression (MVP)

- XP + level i localStorage
- 4 baner med 3 stjerner (leverancer / forbind alle / penge)
- Map-select i startmenu
- **Lås:** intro altid åben; næste bane ved stjerner på forrige **eller** level  
  (dal: 1★ intro / L2 · kyst: 2★ dal / L3 · øer: 2★ kyst / L4)

## Senere (efter kerne er rolig)

1. Envejs + trafiklys (på edge-flags)
2. Kø / density (kapacitet pr. edge)
3. Flere baner / balance
4. Simple bots
5. PWA

## Test-checkliste

- [ ] Tegn vej mellem to byer
- [ ] Path findes; bil kører A→B og leverer
- [ ] Pinch zoomer uden spøgelses-vej
- [ ] Tap by → køb bil
- [ ] Undo fjerner vej + graf opdateres
- [ ] Ingen bil “hænger” > 2s uden rute
