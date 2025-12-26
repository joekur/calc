import { parseDocument } from "../lang/parse";

type CreateEditorOptions = {
  initialValue?: string;
  autofocus?: boolean;
};

function renderMirror(mirror: HTMLElement, value: string) {
  mirror.replaceChildren();

  if (value === "") {
    mirror.textContent = "\u200b";
    return;
  }

  const endsWithNewline = value.endsWith("\n");

  const fragment = document.createDocumentFragment();
  const documentAst = parseDocument(value);

  for (let index = 0; index < documentAst.lines.length; index++) {
    const line = documentAst.lines[index];

    for (const node of line.nodes) {
      const span = document.createElement("span");
      if (node.type === "comment") span.className = "tok-comment";
      span.textContent = node.text;
      fragment.append(span);
    }

    if (index < documentAst.lines.length - 1) {
      fragment.append(document.createTextNode("\n"));
    }
  }

  // Preserve final newline height / caret behavior.
  if (endsWithNewline) fragment.append(document.createTextNode("\u200b"));
  mirror.append(fragment);
}

export function createEditor(options: CreateEditorOptions = {}): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "editor";

  const mirror = document.createElement("div");
  mirror.className = "mirror";
  mirror.setAttribute("aria-hidden", "true");

  const input = document.createElement("textarea");
  input.className = "input";
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.autocomplete = "off";
  input.wrap = "off";
  input.value = options.initialValue ?? "";
  input.setAttribute("aria-label", "Editor");

  const sync = () => {
    renderMirror(mirror, input.value);
  };

  input.addEventListener("input", sync);
  input.addEventListener("scroll", () => {
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
  });

  sync();
  editor.append(mirror, input);

  if (options.autofocus) {
    queueMicrotask(() => input.focus());
  }

  return editor;
}
