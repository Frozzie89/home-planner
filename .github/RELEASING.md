# Releasing

Only maintainers listed in [CODEOWNERS](CODEOWNERS) can cut releases and merge into `main`.
Branch protection rules on `main` enforce code owner approval before any merge.

## Branch flow

```
feature/* -> dev -> main -> (tag) -> release
```

Feature branches are merged into `dev` for integration. When a batch of changes is
ready to ship, `dev` is merged into `main` via a pull request approved by a code owner.
A release is then cut by pushing a version tag from `main`.

## Cutting a release

1. Ensure `main` is up to date and all CI checks are green.

2. Update `CHANGELOG.md`: move items from `[Unreleased]` into a new versioned section
   (e.g. `## [1.2.3] - 2026-06-15`) and commit directly to `main`.

3. Create and push a tag from `main`:

   ```bash
   git checkout main
   git pull origin main
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. The release workflow triggers automatically. It will:
   - Build `frozzie89/home-planner-frontend` and `frozzie89/home-planner-pocketbase`
     for `linux/amd64` and `linux/arm64`
   - Push both images to DockerHub with the `:v1.2.3` tag (`:latest` is promoted
     separately after both builds succeed, and only for stable tags without a
     pre-release suffix)
   - Generate a `docker-compose.prod.yml` referencing the released images
   - Create a GitHub Release with `docker-compose.prod.yml` and `.env.example` attached

5. Verify the release in the GitHub Actions tab and on DockerHub before announcing:

   ```bash
   docker buildx imagetools inspect frozzie89/home-planner-frontend:v1.2.3
   docker buildx imagetools inspect frozzie89/home-planner-pocketbase:v1.2.3
   ```

   Both should show manifests for `linux/amd64` and `linux/arm64`.

6. **Before running the production compose:** the generated `docker-compose.prod.yml`
   includes the Traefik dashboard on port 8080 with `--api.insecure=true`. This is fine
   for a home network but remove the `ports: ["8080:8080"]` entry and the
   `--api.insecure=true` command if the instance is exposed to the internet.

## Versioning

This project uses [Semantic Versioning](https://semver.org/):

- `MAJOR` - breaking changes to the deployment interface (env vars, volume paths, ports)
- `MINOR` - new features, backward-compatible
- `PATCH` - bug fixes
