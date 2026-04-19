import { z } from "zod";
import { NextResponse, NextRequest } from "next/server";

export function validateBody<T>(schema: z.ZodSchema<T>, body: any): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Validation failed", issues: error.flatten().fieldErrors },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid request payload" }, { status: 400 }),
    };
  }
}

export function validateSearchParams<T>(schema: z.ZodSchema<T>, request: NextRequest): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const { searchParams } = new URL(request.url);
    const obj = Object.fromEntries(searchParams.entries());
    const data = schema.parse(obj);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Invalid query parameters", issues: error.flatten().fieldErrors },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json({ error: "Invalid query parameters" }, { status: 400 }),
    };
  }
}
