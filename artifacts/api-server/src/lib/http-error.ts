function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeApiError(payload: unknown, status = 500, fallback = "The request could not be completed.") {
  if (typeof payload === "string" && payload.trim()) {
    return { status, message: payload.trim() };
  }
  if (isRecord(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return { status, message: payload.message.trim() };
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return { status, message: payload.error.trim() };
    }
  }
  return { status, message: fallback };
}

export function errorBody(status: number, message: string) {
  return { status, message };
}
