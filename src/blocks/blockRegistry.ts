import React from "react";

export interface BlockPluginProps<TData = unknown> {
  blockId: string;
  data: TData;
  isFocused: boolean;
  onChange: (nextData: TData) => void;
  onSplit?: () => void;
  onDelete?: () => void;
  onFocus?: () => void;
}

export interface DeskNestBlockPlugin<TData = unknown> {
  type: string;
  label: string;
  description: string;
  shortcut?: string; // e.g. '/code', '/kanban'
  defaultData: () => TData;
  renderBlock: (props: BlockPluginProps<TData>) => React.ReactNode;
  toPlainText: (data: TData) => string; // Used by deriveNoteContent() for search/export
}

/** Internal map of registered block plugins by type string */
const registry = new Map<string, DeskNestBlockPlugin<any>>();

/**
 * Register a block plugin into DeskNest block engine.
 */
export function registerBlockPlugin<TData = unknown>(
  plugin: DeskNestBlockPlugin<TData>
): void {
  registry.set(plugin.type, plugin as DeskNestBlockPlugin<any>);
}

/**
 * Unregister a block plugin by its type identifier.
 */
export function unregisterBlockPlugin(type: string): void {
  registry.delete(type);
}

/**
 * Retrieve a registered block plugin by type.
 */
export function getBlockPlugin<TData = unknown>(
  type: string
): DeskNestBlockPlugin<TData> | undefined {
  return registry.get(type) as DeskNestBlockPlugin<TData> | undefined;
}

/**
 * Get all registered block plugins in registration order.
 */
export function getAllBlockPlugins(): DeskNestBlockPlugin[] {
  return Array.from(registry.values());
}

/**
 * Check if a plugin is registered for a given block type.
 */
export function hasBlockPlugin(type: string): boolean {
  return registry.has(type);
}

/**
 * Extracts payload data from a block.
 * Supports legacy unnested fields (e.g. { content } or { drawingId }),
 * as well as modern { data: { ... } } wrapped blocks.
 */
export function getBlockData<TData = unknown>(block: {
  id: string;
  type: string;
  [key: string]: any;
}): TData {
  if (block.data !== undefined && block.data !== null) {
    return block.data as TData;
  }
  const { id: _id, type: _type, ...rest } = block;
  return rest as unknown as TData;
}

/**
 * Immutably merges updated data into a block, respecting whether
 * the block uses an explicit `.data` container or top-level properties.
 */
export function updateBlockData<
  TBlock extends { id: string; type: string; [key: string]: any }
>(block: TBlock, nextData: any): TBlock {
  if (block.data !== undefined && block.data !== null) {
    return {
      ...block,
      data: nextData,
    };
  }
  if (typeof nextData === "object" && nextData !== null) {
    return {
      ...block,
      ...nextData,
    };
  }
  return {
    ...block,
    data: nextData,
  };
}

/**
 * Creates a new block instance using a plugin's defaultData.
 */
export function createBlockInstance(
  type: string,
  initialData?: Record<string, any>
): { id: string; type: string; [key: string]: any } {
  const plugin = getBlockPlugin(type);
  const defaults = (plugin ? plugin.defaultData() : {}) as Record<string, any>;
  const merged = {
    ...(typeof defaults === "object" && defaults !== null ? defaults : {}),
    ...initialData,
  };
  const id = `blk_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (type === "text" || type === "drawing") {
    // Preserve flat legacy structure for core blocks
    return {
      id,
      type,
      ...merged,
    };
  }

  // Modern blocks can store custom payload in .data or top-level
  return {
    id,
    type,
    ...merged,
  };
}
