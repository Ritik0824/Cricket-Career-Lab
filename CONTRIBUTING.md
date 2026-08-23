# Contributing

## Private-first provenance

Every contribution must be original work created for Cricket Career Lab or a
clearly identified third-party dependency used under its license. Do not import
application source, tests, assets, datasets, or Git history from public projects.

Keep the GitHub repository private. Do not publish packages, preview deployments,
source archives, screenshots containing source, or mirrors without the owner's
explicit approval.

## Commit discipline

Commit a coherent unit of completed work when it is ready. Use a message that
describes the product change. Do not split one mechanical change into artificial
commits, backdate commits, or generate placeholder files to satisfy repository
metrics.

Each product change should normally include its relevant tests and documentation
in the same commit. Push work as development happens so the remote history is an
accurate record of the project.

## Quality gate

Before committing, run:

```bash
npm run check
```

Do not commit generated `dist` output, credentials, private player information,
or local environment files.
