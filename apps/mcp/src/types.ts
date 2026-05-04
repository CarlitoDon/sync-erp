/**
 * MCP Tool Type Definitions
 *
 * Defines the ToolSpec interface used by all domain tool modules.
 */

/** JSON Schema subset for MCP tool input definitions */
export interface JsonSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly default?: string | number | boolean;
  readonly format?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}

export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}

/** A single MCP tool specification */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
  readonly handler: (args: Record<string, unknown>) => Promise<string>;
}

/** MCP content block for tool responses */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}
