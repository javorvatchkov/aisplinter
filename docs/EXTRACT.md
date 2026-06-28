# Extract AISplinter to a separate repository

The full separation plan (architecture, versioning, Egocentric integration, checklist) lives in the Egocentric repo:

**[`docs/AISPLINTER_PLAN.md`](../../docs/AISPLINTER_PLAN.md)** (section *Extract to separate GitHub repo*).

Quick commands:

```bash
# Preserve history from Egocentric root
git subtree split --prefix=aisplinter-code -b aisplinter-export
mkdir ../aisplinter && cd ../aisplinter && git init
git pull ../egocentric-code aisplinter-export
git remote add origin git@github.com:javorvatchkov/aisplinter.git
git push -u origin main

# Publish
cd packages/server && pnpm build && npm publish --access public
```

Then point Egocentric `apps/web` at `"@aisplinter/server": "^0.1.0"` and remove `aisplinter-code/` from Egocentric.
