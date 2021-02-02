# Brightspace/codeartifact-actions/nuget

## Actions

### add-source

Adds the `d2l/private` repository to `./nuget.config` by default:

```yaml
  - name: Add CodeArtifact NuGet source
    uses: Brightspace/codeartifact-actions/nuget/add-source@v1.0.0
```

### remove-source

Removes the `d2l/private` repository from `./nuget.config` by default:

```yaml
  - name: Remove CodeArtifact NuGet source
    uses: Brightspace/codeartifact-actions/nuget/remove-source@v1.0.0
```
