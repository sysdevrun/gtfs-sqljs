# gtfs-sqljs

TypeScript library for loading GTFS data into sql.js SQLite databases.

## Development

```bash
npm run build      # Build with tsup (ESM-only)
npm test           # Run tests with vitest
npm run lint       # Lint with eslint
npm run typecheck  # Type-check with tsc
```

## Publishing a new version

1. Update `CHANGELOG.md`: move items from "Upcoming release" into a new version section (e.g., `## 0.2.0`). Keep the "Upcoming release" section with an empty list.
2. Update the `version` field in `package.json` to match.
3. Commit and push to `main`.
4. Create a GitHub release using `gh`:
   ```bash
   gh release create v0.2.0 --title "v0.2.0" --notes "$(cat <<'EOF'
   - Item from changelog
   - Another item
   EOF
   )"
   ```
   The `publish.yml` workflow will automatically publish to npm on release creation.
