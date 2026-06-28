# AISplinter — visual identity

## Core metaphor

**AISplinter** = AI infrastructure that breaks monolithic provider access into **scoped, controllable shards** — like diamonds splintering on a crystal world.

The user stands on the **surface of a crystal moon**: faceted ground, refracted light, occasional **diamond bursts** that fracture into smaller gems and **fall with gravity**, settling on the surface.

## Mood

| Element | Direction |
|---------|-----------|
| Setting | Moon-like crystal planet, low horizon, deep space |
| Materials | Glass, quartz, diamond facets — not metal/sci-fi chrome |
| Motion | Slow ambient drift; periodic shatter → splinter → fall → settle |
| Light | Internal glow (cyan, ice blue, soft violet), sharp specular highlights |
| UI | Dark, minimal, hero animation behind content; readable type on top |

## Hero load sequence

1. **Void** — dark space, faint stars  
2. **Planet rises** — curved crystal horizon fades in from below  
3. **Surface awakens** — facet lines and ground shimmer  
4. **First splinter** — one diamond burst, shards rain down  
5. **Content** — logo, tagline, links fade in  

Respect `prefers-reduced-motion`: static crystal horizon, no particle sim.

## Wordmark

- **AI** + **Splinter** — the break/facet idea is literal in the animation  
- Optional mark: fractured diamond / three shard triangles  

## Do not

- Generic “AI brain” or circuit-board clipart  
- Neon cyberpunk without crystal materiality  
- Busy UI competing with the hero sim  

## Implementation

Static site: [`website/index.html`](../website/index.html) — canvas hero, editable links in `website/config.js`.
