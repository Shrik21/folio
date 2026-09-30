function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeApiError(payload: unknown, status = 500, fallback = "Something went wrong. Please try again.") {
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
  if (payload instanceof Error && payload.message.trim()) {
    return { status, message: payload.message.trim() };
  }
  return { status, message: fallback };
}

export function messageFromUnknown(error: unknown, fallback?: string) {
  return normalizeApiError(error, 500, fallback).message;
}
