# ADR 0003: Use npm as package manager

Status: Accepted

## Context
Multiple lockfiles and toolchains make installs non-deterministic.

## Decision
Use npm and `package-lock.json`; CI uses `npm ci`.

## Consequences
One supported workflow and fewer agent choices; npm-specific script portability must be maintained.

## Rejected Alternatives
pnpm, Yarn, Bun, and mixed package managers.
