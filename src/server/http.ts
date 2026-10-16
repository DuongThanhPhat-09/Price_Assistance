import "server-only";
import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/types";

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json<ApiError>({ error, ...(details === undefined ? {} : { details }) }, { status });
}

/** Parses a positive integer route param, or returns null. */
export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

/** Wraps a handler so unexpected errors become a clean 500 instead of a stack trace. */
export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error("[api]", e);
      return jsonError(500, "Something went wrong. Please try again.");
    }
  };
}
