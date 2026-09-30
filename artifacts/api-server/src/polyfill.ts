const runtime = globalThis as typeof globalThis & { DOMMatrix?: unknown };
if (typeof runtime.DOMMatrix === "undefined") {
  runtime.DOMMatrix = class DOMMatrix {};
}
