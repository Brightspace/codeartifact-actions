# codeartifact-actions

Collection of AWS CodeArtifact actions.

## NuGet Actions

### add-nuget-source

Default inputs add the `d2l/private` repository to `./nuget.config`:

```yaml
  - name: Add CodeArtifact NuGet source
    uses: Brightspace/codeartifact-actions/add-nuget-source@master
```

### remove-nuget-source

Default inputs remove the `d2l/private` repository from `./nuget.config`:

```yaml
  - name: Remove CodeArtifact NuGet source
    uses: Brightspace/codeartifact-actions/remove-nuget-source@master
```
