# Token-sparende workflow (FlowTransport)

Inspireret af [master-workflow](https://github.com/luckeyfaraday/master-workflow), men **billigere**:

| master-workflow | FlowTransport feature-loop |
|-----------------|----------------------------|
| Multi-CLI, score ≥ 9, mange runder | Samme Grok-stack, score ≥ **8**, **max 1** fix-runde |
| Kan blive dyr | Max ca. **4** agent-kald pr. feature |

## Sådan kører du

I Grok Build / chat med workflow-værktøj:

**Args (JSON):**
```json
{
  "goal": "Tilføj slet-værktøj der fjerner ét vejsegment med 85% refund",
  "criteria": "Undo-stack opdateres. Graf rebuildes. Biler repath eller aborter job rent. Pinch uændret.",
  "base": "HEAD"
}
```

- `goal` (påkrævet): **én** feature  
- `criteria` (valgfri): DoD – ellers bruges standard fra workflow  
- `base` (valgfri): git-ref til diff (default `HEAD` = uncommitted + siden sidste commit-ish afhængigt af host)

Kør workflow-navn: **`feature-loop`**

Fil: `.grok/workflows/feature-loop.rhai`

## Når du chatter uden workflow

Brug skabelonen i `AGENTS.md` → **Definition of Done**.  
Én besked = ét mål. Sig eksplicit: *“Stop når DoD er opfyldt. Ingen ekstra features.”*

## Hvornår du **ikke** skal køre feature-loop

- Ren copy/farve/toast-tekst → almindelig chat  
- “Gør spillet bedre” uden mål → for dyrt og vagt  
- Store arkitektur-omskrivninger → split i 2–3 goals

## Score

- **≥ 8** → passed (godt nok til cozy MVP)  
- **&lt; 8 efter fix** → `needs_human` (ingen flere auto-loops)
