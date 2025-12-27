# Numi-Style Calculator Architecture Decisions

## Overview

We are building a web-based calculator similar to Numi, supporting multiple lines, variables, line comments, and inline results. The architecture prioritizes maintainability, correctness, and a clear separation between input, parsing, and rendering.

---

## 1. Editing Surface Choice

### Decision: Use **textarea-backed editor with highlighted mirror**

- Textarea captures all input, selection, and IME handling.
- Highlight layer (div) renders syntax-highlighted tokens and inline results.

**Rationale:**

- Native multiline editing, undo/redo, and IME support.
- Easier to manage than contenteditable for code-like input.
- Matches Numi behavior.

**Rejected alternatives:**

- **Canvas:** too low-level; would require manual text rendering and selection management.
- **ContentEditable:** higher complexity and quirks; better suited for rich text rather than structured expressions.
- **Document frameworks (ProseMirror, Slate):** overkill, designed for document structures, not expression-based editors.
- **Lexical:** possible future upgrade, but node-based document model complicates expression-first editing.

---

## 2. Core Editor Architecture

```
┌──────────────────────────┐
│ Highlight Layer (div)    │  ← rendered tokens, inline results
└────────────▲─────────────┘
             │
┌────────────┴─────────────┐
│ Transparent Textarea      │  ← real input, caret, selection, IME
└──────────────────────────┘
             │
┌──────────────────────────┐
│ Text Buffer (string)      │  ← canonical source of truth
└────────────┬─────────────┘
             │
        Tokenize per line
             │
┌────────────┴─────────────┐
│ AST per line              │  ← parse expressions, assignments, comments
│ Variables environment     │
└────────────┬─────────────┘
             │
         Evaluate
             │
┌────────────┴─────────────┐
│ Inline Results / Gutter   │
└──────────────────────────┘
```

### Key Principles

- **Text buffer is canonical**: DOM is projection only.
- **Tokenizer/parser**: handles numbers, operators, variables, assignments, and comments.
- **Evaluation environment**: cumulative per line for variables.
- **Inline results**: rendered beside each line, not inserted into input.
- **Selection handling**: delegated to native textarea.
- **Rendering is incremental**: mirror/gutter keep stable per-line nodes and patch only changed lines; focus/blur only updates decorations (e.g. error underlines).

---

## 3. Tokenization and Syntax Highlighting

- Split input by lines.
- Tokenize each line for numbers, operators, variables, assignments, and comments.
- Render highlighted spans in the mirror div.
- Comments start with `#` or `//` and are ignored in evaluation.

---

## 4. Features Supported

- Multiline expressions
- Assignments and variables
- Line comments
- Inline results
- Syntax highlighting
- Fast evaluation feedback

---

## 5. Libraries Considered

| Library/Framework | Fit for Numi-style | Notes                                                                                      |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Lexical           | Medium             | Node-based document model complicates expression-first editing; could be a future upgrade. |
| Slate             | Low                | Overkill for linear expressions; best for rich documents.                                  |
| ProseMirror       | Low                | Designed for structured documents, not expressions.                                        |
| Monaco/CodeMirror | Medium/High        | Could replace mirror for more editor-like behavior; heavier bundle.                        |
| ContentEditable   | Low/Medium         | Harder to manage selection/IME for code-like input; unnecessary.                           |
| Textarea + Mirror | High               | Native editing behavior, simplest path, scales well for calculator expressions.            |

---

## 6. Long-Term Growth Path

- Start with **textarea + mirror** for simplicity and correctness.
- Keep **text buffer and parser independent** from DOM layer.
- Potential future upgrades:
  - Swap mirror for Monaco for advanced features (autocomplete, multiple cursors)
  - Support more advanced math expressions (fractions, matrices)
  - Add persistent variables, history, and units
  - Add collaboration or cloud sync

---

## 7. Summary

- **Editing layer:** Transparent textarea captures input and selection.
- **Rendering layer:** Highlight div mirrors text buffer and shows inline results.
- **Core model:** Text buffer is canonical; tokenization → AST → evaluation.
- **Inline results:** Rendered separately, preserving input.
- **Comments:** Simple line-based syntax.
- **Libraries:** Minimal use; building our own provides correct, maintainable behavior.

This architecture balances correctness, performance, and future flexibility, closely matching Numi's behavior while avoiding unnecessary complexity.
