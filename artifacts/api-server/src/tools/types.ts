// ── Tool Registry — Core Types ────────────────────────────────────────────────
//
// A ToolDefinition describes one callable tool: its name, human-readable
// description, a JSON Schema for its input, and an execute function.
//
// ToolRegistry holds a named map of definitions and is the single place other
// modules go to look up or enumerate available tools.

// ── JSON Schema subset used for tool input descriptions ───────────────────────

export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// ── Tool definition ────────────────────────────────────────────────────────────

export interface ToolDefinition<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  /** Unique, snake_case tool name (e.g. "read_file"). */
  readonly name: string;
  /** Short description of what the tool does. */
  readonly description: string;
  /** JSON Schema describing the expected input object. */
  readonly inputSchema: JsonSchema;
  /** Execute the tool with a validated input and return a result. */
  execute(input: TInput): Promise<TOutput> | TOutput;
}

// ── Tool registry ──────────────────────────────────────────────────────────────

export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _tools = new Map<string, ToolDefinition<any, any>>();

  /** Register a tool. Throws if a tool with the same name is already registered. */
  register<TInput extends Record<string, unknown>, TOutput>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void {
    if (this._tools.has(tool.name)) {
      throw new Error(
        `ToolRegistry: a tool named "${tool.name}" is already registered`,
      );
    }
    this._tools.set(tool.name, tool);
  }

  /** Look up a tool by name. Returns undefined if not found. */
  get<TInput extends Record<string, unknown> = Record<string, unknown>, TOutput = unknown>(
    name: string,
  ): ToolDefinition<TInput, TOutput> | undefined {
    return this._tools.get(name) as ToolDefinition<TInput, TOutput> | undefined;
  }

  /** Return all registered tools in registration order. */
  list(): ReadonlyArray<ToolDefinition> {
    return Array.from(this._tools.values());
  }

  /** Returns true if a tool with this name has been registered. */
  has(name: string): boolean {
    return this._tools.has(name);
  }
}
