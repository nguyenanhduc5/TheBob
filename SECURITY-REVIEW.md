# Security review

## Scope and result

Reviewed the current project tree, configuration templates, tracked dependency/build output, and relevant Git history. No database password or third-party service credential was found in the current tracked tree. Local configuration files containing credentials are ignored and are not tracked.

## Findings

### High: static JWT signing key in Git history

A fixed JWT signing key was present in the environment template and as a fallback in the authentication service. If that value was used by a deployment, an attacker with access to it could forge signed tokens, including tokens with elevated roles.

- Fixed in the current `main` and `production` snapshot: the template now contains only a placeholder, and token generation fails when `Jwt:Key` is missing.
- The histories of both remote branches were rewritten to remove the affected commits. Existing clones, forks, cached commit URLs, or other copies may still contain the old value.
- Rotate the deployed JWT signing key and invalidate existing tokens if the old value was ever used.
- References in the earlier tree: `render-env-template.txt:8` and `THEBOB/Features/Auth/AuthService.cs:81`.

### Medium: local admin seed credentials

`THEBOB/appsettings.json` exists locally with a database credential, and `THEBOB/appsettings.Development.json` has admin seeding enabled with a non-placeholder password. Both files are ignored by Git and were not found in tracked files or the inspected Git history. Build output also contains ignored copies of these files. Keep them local, disable seeding or replace the local password, and rotate credentials if they were shared or used with an exposed database.

## Preventive changes

- The root `.gitignore` now covers local `appsettings` files, `.env` files, dependency folders, build output, and local tooling caches while retaining example configuration files.
- No `node_modules`, `bin`, `obj`, `dist`, `build`, or coverage directories are tracked in the current tree.
- Generated test/build artifacts and a historical Firebase client API key were present in earlier commits; the remote branch histories were rewritten to remove those commits. Existing clones or forks may still retain them.
- Firebase client API keys are not server-side secrets by themselves; verify provider restrictions and Firebase security rules.
