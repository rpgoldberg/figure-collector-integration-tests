# Docker Image CI/CD Workflow Guide

## Complete Flow

### 1. Development Phase
```
feature/branch → PR → develop
```
- **On PR**: Builds image tagged as `pr-123` (optional, for testing)
- **On merge to develop**: Builds image tagged as `develop`
- **Integration tests**: Pull `develop` images

### 2. Release Phase
```
develop → PR → main → tag v1.0.0
```
- **On merge to main**: Builds image tagged as `main` and `latest`
- **On tag v1.0.0**: Builds images tagged as:
  - `1.0.0` (exact version)
  - `1.0` (minor version)
  - `1` (major version)
  - `latest` (if on main)

### 3. Manual Triggers

#### From GitHub Actions UI:
1. Go to Actions tab → "Build and Push Docker Image"
2. Click "Run workflow"
3. Select branch (develop/main)
4. Enter custom tag (optional)
5. Check "Force rebuild" if needed

#### Common Scenarios:

**After merging to develop but image wasn't built:**
```bash
# Option 1: Manual trigger from UI
# Select: branch=develop, tag=develop

# Option 2: Dummy commit
git checkout develop
git commit --allow-empty -m "Trigger Docker build"
git push
```

**After creating a release tag:**
```bash
# Tag automatically triggers build
git tag v1.0.0
git push origin v1.0.0

# Images created: 1.0.0, 1.0, 1, latest
```

**Rebuild existing image:**
```bash
# Use workflow_dispatch with:
# - branch: main or develop
# - tag: same as existing (e.g., "develop")
# - rebuild: true
```

## Image Availability Matrix

| Event | Branch | Images Created |
|-------|--------|----------------|
| Push | develop | `develop`, `develop-sha123abc` |
| Push | main | `main`, `latest`, `main-sha456def` |
| Tag v1.0.0 | any | `1.0.0`, `1.0`, `1`, `latest` |
| Manual | develop | `develop`, `manual`, or custom tag |
| Manual | main | `main`, `manual`, or custom tag |

## Integration Test Usage

```yaml
# In docker-compose.prebuilt.yml or CI

# For latest stable
image: ghcr.io/rpgoldberg/service-name:latest

# For develop branch
image: ghcr.io/rpgoldberg/service-name:develop

# For specific version
image: ghcr.io/rpgoldberg/service-name:1.0.0

# For PR testing
image: ghcr.io/rpgoldberg/service-name:pr-123
```

## Troubleshooting

### Images not available after merge
1. Check Actions tab for failed workflows
2. Manually trigger with workflow_dispatch
3. Check permissions: Settings → Actions → General → Workflow permissions

### Wrong image version in tests
1. Check docker-compose uses correct tag
2. Pull latest: `docker pull ghcr.io/rpgoldberg/service:develop`
3. Check available tags: https://github.com/rpgoldberg/[repo]/pkgs/container/[repo]

### Manual rebuild needed
Use workflow_dispatch with:
- Select the branch containing the code you want
- Enter the tag you want to create/update
- Check "Force rebuild" to bypass cache