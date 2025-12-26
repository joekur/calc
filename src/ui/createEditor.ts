type CreateEditorOptions = {
  initialValue?: string;
  autofocus?: boolean;
};

function toMirrorText(value: string): string {
  if (value === "") return "\u200b";
  if (value.endsWith("\n")) return `${value}\u200b`;
  return value;
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
    mirror.textContent = toMirrorText(input.value);
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
