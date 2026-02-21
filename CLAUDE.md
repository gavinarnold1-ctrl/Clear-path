# CLAUDE.md — AI Assistant Guide for Clear-path

This file provides context, conventions, and workflows for AI assistants (Claude and others) working in this repository.

---

## Project Overview

**Clear-path** is a new project currently in its initial setup phase. The repository was created on 2026-02-17 and contains only foundational scaffolding at this time. As the project takes shape, this file should be updated to reflect the technology stack, architecture decisions, and development conventions that are adopted.

---

## Current Repository State

```
Clear-path/
├── .git/           # Git version control data
├── README.md       # Minimal project title placeholder
└── CLAUDE.md       # This file
```

No source code, dependencies, build tooling, or test infrastructure has been added yet. All decisions about the tech stack, directory layout, and tooling should be documented here as they are made.

---

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `master` | Legacy default branch (use `main` going forward) |
| `claude/<description>-<id>` | AI-driven feature/fix branches |

- Feature branches must be prefixed with `claude/` when created by AI assistants.
- Branch names should be lowercase, hyphen-separated, and end with the session ID suffix supplied by the task context (e.g., `claude/add-claude-documentation-yq7Nj`).

### Commits

- Write concise, imperative commit messages: `Add user auth endpoint`, not `Added user auth endpoint`.
- Commit only related changes together; avoid mixing unrelated concerns in a single commit.
- Never commit secrets, credentials, `.env` files, or large binary assets.

### Push Rules

```bash
# Always set tracking branch on first push
git push -u origin <branch-name>
```

- Do not force-push to `main` or `master`.
- If a push fails due to a network error, retry with exponential backoff (2 s → 4 s → 8 s → 16 s, max 4 retries).

### Pull Requests

- Keep PRs focused: one logical change per PR.
- Include a short summary of what changed and why.
- Reference any relevant issue numbers in the PR description.

---

## Development Conventions (to be adopted when tech stack is chosen)

The following sections are placeholders. Fill them in once the tech stack is decided.

### Language & Runtime

> **TODO:** Document the chosen language, runtime version (e.g., Node.js 22, Python 3.12), and any version management tooling (nvm, pyenv, etc.).

### Dependency Management

> **TODO:** Document the package manager (npm, pnpm, yarn, pip, poetry, etc.) and how to install dependencies.

```bash
# Example (update when stack is chosen)
# npm install        # Node.js projects
# pip install -r requirements.txt  # Python projects
```

### Building the Project

> **TODO:** Document build commands once a build system is in place.

```bash
# Example
# npm run build
```

### Running the Project Locally

> **TODO:** Document how to start a development server or run the application locally.

```bash
# Example
# npm run dev
```

### Linting & Formatting

> **TODO:** Document linter and formatter tooling (ESLint, Prettier, Ruff, Black, etc.) and how to run them.

```bash
# Example
# npm run lint
# npm run format
```

### Testing

> **TODO:** Document the test framework (Jest, Vitest, pytest, etc.) and how to run tests.

```bash
# Example
# npm test
# npm run test:watch
```

---

## AI Assistant Guidelines

### Before Making Changes

1. **Read files before editing.** Never modify a file without reading its current contents first.
2. **Understand the task scope.** Avoid over-engineering; implement only what is requested.
3. **Check for existing patterns.** Follow conventions already present in the codebase rather than introducing new ones.

### Code Quality

- Do not introduce security vulnerabilities (SQL injection, XSS, command injection, etc.).
- Remove dead code and unused imports; do not leave `// removed` comments as placeholders.
- Only add comments where the logic is non-obvious.
- Do not add docstrings, type annotations, or error handling to code you did not change.

### File Operations

- Prefer editing existing files over creating new ones.
- Never create documentation files (README, CLAUDE.md, etc.) unless explicitly requested.
- Do not commit generated files or build artifacts unless they are required by the project.

### Git Operations

- Always work on the branch specified in the task context.
- Never push to a branch other than the one designated for the current task.
- Write descriptive, imperative commit messages.

### When the Stack Is Undefined

If the project has no tech stack yet and a task requires writing code:

1. Ask the user which language/framework to use before proceeding.
2. If autonomy is granted, pick a simple, widely-supported stack appropriate for the task and document it here.
3. Scaffold the project conventionally (e.g., standard directory layout for the chosen framework).

---

## Updating This File

This CLAUDE.md should be kept current. When any of the following change, update the relevant section:

- Technology stack or runtime version
- Build, test, or lint commands
- Directory structure
- Git branching strategy
- Environment variable requirements
- Deployment process

The goal is that any AI assistant (or new human contributor) can read this file and immediately understand how to work effectively in the repository.
