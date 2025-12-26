# Repository Guidelines

## Project Overview

This repository is an early-stage web calculator project inspired by Numi. The current source of truth is the architecture document in `docs/architecture.md` (textarea-backed editor, mirrored highlight layer, per-line tokenize → parse → evaluate).

## Project Structure & Module Organization

- `docs/`: design/architecture notes and decisions.
- `src/`: app source.
  - `src/ui/`: editor UI (textarea + mirror rendering).
  - `src/themes/`: theme assets and theme-to-CSS-variable mapping.
  - `src/test/`: test setup.

Keep a clear separation between:

- editor/input surface (DOM/textarea)
- parsing/tokenization (pure functions)
- evaluation/runtime environment (pure + deterministic)
- rendering (projection of state)

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run build`: typecheck (`tsc -b`) and build production bundle.
- `npm test`: run unit tests once (Vitest).
- `npm run test:watch`: run tests in watch mode.

## Coding Style & Naming Conventions

- Prefer small, pure modules for tokenizer/parser/evaluator; avoid DOM access outside the editor layer.
- Use consistent naming:
  - `tokenizeLine(...)`, `parseLine(...)`, `evaluateLine(...)`
  - `*Result`/`*Error` for evaluation outputs.
- Formatting: use the repo’s formatter once introduced (commonly Prettier/ESLint). Until then, keep changes consistent within the touched files.

## Testing Guidelines

- Add tests alongside the parsing/evaluation layers first (they should be deterministic and easy to snapshot).
- Use explicit, readable cases (e.g., `supports assignments`, `ignores // comments`).
- Keep test inputs multi-line when exercising environment accumulation.

## Commit & Pull Request Guidelines

- Git history is not established yet; use a conventional, scannable format such as `feat:`, `fix:`, `docs:`, `refactor:`.
- PRs should include:
  - a short description of user-visible behavior changes
  - linked issues (if any)
  - screenshots/gifs for editor UI changes
  - notes on edge cases (IME, selection/caret behavior)

## Agent-Specific Notes

- Treat `docs/architecture.md` as a contract; if you deviate, update the doc in the same PR.
