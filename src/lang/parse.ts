import type { DocumentAst, LineAst } from "./ast";

export function parseLine(raw: string): LineAst {
  // For now, only support full-line comments.
  if (raw.trimStart().startsWith("#")) return { type: "comment", raw };
  return { type: "code", raw };
}

export function parseDocument(source: string): DocumentAst {
  return {
    lines: source.split("\n").map(parseLine)
  };
}

