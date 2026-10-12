$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$originalLocation = Get-Location

try {
    Set-Location $repositoryRoot

    $markdownRoots = @(
        "docs/architecture/phase-0",
        "docs/adr",
        "docs/diagrams",
        "openspec/changes/complete-phase-0-architecture-package"
    )

    $markdownFiles = foreach ($root in $markdownRoots) {
        Get-ChildItem -LiteralPath $root -Recurse -File -Filter "*.md"
    }

    $markdownFiles += Get-Item @(
        "docs/architecture/risk-register.md",
        "docs/architecture/TENANT_ISOLATION.md",
        "docs/current-system/current-data-model.md",
        "docs/current-system/integrations-inventory.md",
        "docs/runbooks/session-handoff.md"
    )

    $brokenLinks = [System.Collections.Generic.List[string]]::new()

    foreach ($file in ($markdownFiles | Sort-Object FullName -Unique)) {
        $content = Get-Content -Raw -Encoding utf8 $file.FullName
        $matches = [regex]::Matches(
            $content,
            '(?<!\!)\[[^\]]+\]\((?<target>[^)]+)\)'
        )

        foreach ($match in $matches) {
            $target = $match.Groups["target"].Value.Trim()

            if ($target.StartsWith("<") -and $target.EndsWith(">")) {
                $target = $target.Substring(1, $target.Length - 2)
            }

            if ($target -match '^(https?://|mailto:|#)') {
                continue
            }

            $pathPart = ($target -split "#", 2)[0]

            if ([string]::IsNullOrWhiteSpace($pathPart)) {
                continue
            }

            try {
                $resolvedTarget = [IO.Path]::GetFullPath(
                    (Join-Path $file.DirectoryName $pathPart)
                )
            }
            catch {
                $brokenLinks.Add("$($file.FullName): invalid target $target")
                continue
            }

            if (-not (Test-Path -LiteralPath $resolvedTarget)) {
                $brokenLinks.Add("$($file.FullName): missing target $target")
            }
        }
    }

    if ($brokenLinks.Count -gt 0) {
        $brokenLinks | ForEach-Object { Write-Output "BROKEN $_" }
        throw "Markdown link validation failed: $($brokenLinks.Count)"
    }

    $expectedPhaseFiles = @(
        "README.md",
        "00-current-system-audit.md",
        "01-target-product-architecture.md",
        "02-domain-model.md",
        "03-bounded-contexts.md",
        "04-data-architecture.md",
        "05-reservation-engine.md",
        "06-pricing-inventory.md",
        "07-microservice-evolution.md",
        "08-rpc-event-strategy.md",
        "09-security-multitenancy.md",
        "10-observability.md",
        "11-migration-strategy.md",
        "12-phase-roadmap.md",
        "LELUNGO-ARCHITECTURE-READINESS-REPORT.md"
    )

    $phaseFiles = Get-ChildItem "docs/architecture/phase-0" -File -Filter "*.md"
    $inventoryDiff = Compare-Object `
        ($expectedPhaseFiles | Sort-Object) `
        ($phaseFiles.Name | Sort-Object)

    if ($inventoryDiff.Count -ne 0) {
        throw "Phase 0 file inventory mismatch"
    }

    foreach ($file in $phaseFiles) {
        $content = Get-Content -Raw -Encoding utf8 $file.FullName

        foreach ($label in @(
            "Current implementation",
            "Target state",
            "Decision status",
            "Last verified"
        )) {
            if ($content -notmatch [regex]::Escape($label)) {
                throw "$($file.Name) is missing status label: $label"
            }
        }
    }

    foreach ($file in $phaseFiles | Where-Object {
        $_.Name -match '^0[1-9]-|^1[0-2]-'
    }) {
        $content = Get-Content -Raw -Encoding utf8 $file.FullName

        if ($content -notmatch '(?i)target-only') {
            throw "$($file.Name) is missing a target-only boundary"
        }
    }

    $contextText = Get-Content -Raw -Encoding utf8 `
        "docs/architecture/phase-0/03-bounded-contexts.md"
    $contextSections = [regex]::Matches(
        $contextText,
        '(?ms)^## \d+\. .+?(?=^## \d+\.|^## Cross-context)'
    )

    if ($contextSections.Count -ne 18) {
        throw "Expected 18 bounded contexts, found $($contextSections.Count)"
    }

    $expectedContextNames = @(
        "Identity & Access",
        "Organization & Tenancy",
        "Property",
        "Inventory",
        "Pricing",
        "Reservation",
        "Guest",
        "Payment",
        "Finance",
        "Operations",
        "Notification",
        "Search",
        "Review",
        "Promotion",
        "Distribution / Channel Manager",
        "Analytics",
        "Audit",
        "Platform Billing"
    )

    $contextNames = foreach ($section in $contextSections) {
        [regex]::Match(
            $section.Value,
            '(?m)^## \d+\. (?<name>.+)$'
        ).Groups["name"].Value.Trim()
    }

    if ((Compare-Object $expectedContextNames $contextNames).Count -ne 0) {
        throw "Bounded-context names do not match the canonical 18-context taxonomy"
    }

    $contextFields = @(
        "Responsibility",
        "Owned entities/tables",
        "Public commands",
        "Public queries",
        "Events emitted",
        "Events consumed",
        "Dependencies",
        "Transaction boundary",
        "Consistency",
        "Extraction trigger/rank"
    )

    foreach ($section in $contextSections) {
        foreach ($field in $contextFields) {
            if ($section.Value -notmatch "\| $([regex]::Escape($field)) +\|") {
                throw "A bounded-context section is missing field: $field"
            }
        }
    }

    $domainModel = Get-Content -Raw -Encoding utf8 `
        "docs/architecture/phase-0/02-domain-model.md"
    $domainCatalog = [regex]::Match(
        $domainModel,
        '(?ms)^## Bounded-context and entity catalog.+?(?=^## Relationship model)'
    ).Value
    $domainContextNames = @(
        [regex]::Matches(
            $domainCatalog,
            '(?m)^\| (?!Bounded context|---)(?<name>[^|]+) \|'
        ) | ForEach-Object { $_.Groups["name"].Value.Trim() }
    )

    if (
        $domainContextNames.Count -ne 18 -or
        (Compare-Object $expectedContextNames $domainContextNames).Count -ne 0
    ) {
        throw "Domain-model catalog does not match the canonical 18-context taxonomy"
    }

    $adrFiles = @(
        "docs/adr/0007-observability-and-structured-logging.md"
    ) + @(
        Get-ChildItem "docs/adr" -File -Filter "001*.md" |
            ForEach-Object FullName
    )

    foreach ($adr in $adrFiles) {
        $content = Get-Content -Raw -Encoding utf8 $adr

        foreach ($field in @(
            "Status:",
            "## Context",
            "## Decision",
            "## Alternatives",
            "## Consequences",
            "## Migration Impact"
        )) {
            if ($content -notmatch [regex]::Escape($field)) {
                throw "$adr is missing ADR field: $field"
            }
        }
    }

    $diagramFiles = Get-ChildItem "docs/diagrams" -File -Filter "*.md" |
        Where-Object Name -ne "README.md"

    if ($diagramFiles.Count -ne 7) {
        throw "Expected 7 Mermaid diagrams, found $($diagramFiles.Count)"
    }

    foreach ($file in $diagramFiles) {
        $lines = Get-Content -Encoding utf8 $file.FullName
        $openingFences = @($lines | Where-Object { $_ -eq '```mermaid' }).Count
        $allFences = @(
            $lines | Where-Object { $_ -eq '```' -or $_ -eq '```mermaid' }
        ).Count

        if ($openingFences -ne 1 -or $allFences -ne 2) {
            throw "$($file.Name) Mermaid fence mismatch"
        }
    }

    $riskText = Get-Content -Raw -Encoding utf8 `
        "docs/architecture/risk-register.md"
    $riskRows = [regex]::Matches(
        $riskText,
        '(?m)^\| (?<id>R-\d{3}) \|(?<cells>.+)\|$'
    )

    if ($riskRows.Count -lt 20) {
        throw "Expected at least 20 architecture risks, found $($riskRows.Count)"
    }

    $riskIds = [System.Collections.Generic.HashSet[string]]::new()

    foreach ($riskRow in $riskRows) {
        if (-not $riskIds.Add($riskRow.Groups["id"].Value)) {
            throw "Duplicate risk ID: $($riskRow.Groups['id'].Value)"
        }

        $cells = @($riskRow.Value.Trim('|').Split('|') | ForEach-Object Trim)

        if ($cells.Count -ne 9) {
            throw "$($riskRow.Groups['id'].Value) does not have 9 fields"
        }

        if ($cells[2] -notin @("Low", "Medium", "High")) {
            throw "$($cells[0]) has invalid likelihood"
        }

        if ($cells[3] -notin @("Low", "Medium", "High")) {
            throw "$($cells[0]) has invalid impact"
        }

        if ($cells[4] -notin @("Medium", "High", "Critical")) {
            throw "$($cells[0]) has invalid severity"
        }
    }

    $roadmap = Get-Content -Raw -Encoding utf8 `
        "docs/architecture/phase-0/12-phase-roadmap.md"
    $phaseSections = [regex]::Matches(
        $roadmap,
        '(?ms)^## Phase \d+ - .+?(?=^## Phase \d+ - |^## Phase transition checklist)'
    )

    if ($phaseSections.Count -ne 13) {
        throw "Expected 13 roadmap phases, found $($phaseSections.Count)"
    }

    $roadmapFields = @(
        "Goal",
        "Scope",
        "Dependencies",
        "Domain changes",
        "Database changes",
        "API changes",
        "UI changes",
        "Infrastructure changes",
        "Security considerations",
        "Tests",
        "Acceptance criteria",
        "Rollback strategy"
    )

    foreach ($phaseSection in $phaseSections) {
        foreach ($field in $roadmapFields) {
            if ($phaseSection.Value -notmatch "\| $([regex]::Escape($field)) +\|") {
                throw "A roadmap phase is missing field: $field"
            }
        }
    }

    $readiness = Get-Content -Raw -Encoding utf8 `
        "docs/architecture/phase-0/LELUNGO-ARCHITECTURE-READINESS-REPORT.md"

    foreach ($requiredText in @(
        "READY FOR PHASE 1",
        "## Verdict",
        "## Repository-backed findings",
        "## Accepted architecture decisions",
        "## Critical debt and risks",
        "## Unresolved decisions and deadlines",
        "## Verification outcome",
        "## Required Phase 1 scope",
        "## Stop boundary"
    )) {
        if ($readiness -notmatch [regex]::Escape($requiredText)) {
            throw "Readiness report is missing: $requiredText"
        }
    }

    $summary = (
        "PASS markdown-links={0} phase0-status={1}/15 target-boundaries=12/12 " +
        "contexts={2}/18 adr={3} diagrams={4} risks={5} roadmap={6}/13 " +
        "readiness-headings"
    ) -f @(
        $markdownFiles.Count,
        $phaseFiles.Count,
        $contextSections.Count,
        $adrFiles.Count,
        $diagramFiles.Count,
        $riskRows.Count,
        $phaseSections.Count
    )

    Write-Output $summary
}
finally {
    Set-Location $originalLocation
}
