export type LineAst =
  | { type: "comment"; raw: string }
  | { type: "code"; raw: string };

export type DocumentAst = {
  lines: LineAst[];
};

