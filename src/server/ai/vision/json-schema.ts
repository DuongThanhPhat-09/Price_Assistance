/**
 * The small JSON Schema subset our tasks use, written in the strict form
 * OpenAI structured outputs require (every property listed in `required`,
 * `additionalProperties: false`, nullability via `type: [x, "null"]`).
 * Gemini wants an OpenAPI-style schema instead; toGeminiSchema converts.
 */

type Primitive = "string" | "number" | "integer" | "boolean";

export type JsonSchema =
  | { type: Primitive | [Primitive, "null"]; description?: string; enum?: (string | number)[] }
  | { type: "array"; items: JsonSchema; description?: string }
  | {
      type: "object";
      properties: Record<string, JsonSchema>;
      required: string[];
      additionalProperties: false;
      description?: string;
    };

/** Gemini `responseSchema` (OpenAPI 3 subset with upper-case types). */
export interface GeminiSchema {
  type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
}

export function toGeminiSchema(schema: JsonSchema): GeminiSchema {
  const base = schema.description ? { description: schema.description } : {};

  if (schema.type === "object") {
    const keys = Object.keys(schema.properties);
    return {
      ...base,
      type: "OBJECT",
      properties: Object.fromEntries(keys.map((k) => [k, toGeminiSchema(schema.properties[k])])),
      required: schema.required,
      // Gemini otherwise orders keys alphabetically; we want e.g. "visible_text"
      // produced before the fields derived from it.
      propertyOrdering: keys,
    };
  }
  if (schema.type === "array") {
    return { ...base, type: "ARRAY", items: toGeminiSchema(schema.items) };
  }

  const [type, nullable] = Array.isArray(schema.type) ? [schema.type[0], true] : [schema.type, false];
  return {
    ...base,
    type: type.toUpperCase() as GeminiSchema["type"],
    ...(nullable ? { nullable: true } : {}),
    ...(schema.enum ? { enum: schema.enum.map(String) } : {}),
  };
}
