import { registerBlockPlugin } from "./blockRegistry";
import { textBlockPlugin } from "./plugins/textPlugin";
import { drawingBlockPlugin } from "./plugins/drawingPlugin";
import { codeBlockPlugin } from "./plugins/codePlugin";
import { calloutBlockPlugin } from "./plugins/calloutPlugin";

// Export core registry contracts and helpers
export * from "./blockRegistry";
export * from "./BlockEngineContext";
export * from "./BlockRenderer";

// Export built-in plugins
export { textBlockPlugin } from "./plugins/textPlugin";
export { drawingBlockPlugin } from "./plugins/drawingPlugin";
export { codeBlockPlugin } from "./plugins/codePlugin";
export { calloutBlockPlugin } from "./plugins/calloutPlugin";

// Automatically register default plugins on module initialization
registerBlockPlugin(textBlockPlugin);
registerBlockPlugin(drawingBlockPlugin);
registerBlockPlugin(codeBlockPlugin);
registerBlockPlugin(calloutBlockPlugin);
