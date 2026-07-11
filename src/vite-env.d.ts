/// <reference types="vite/client" />

// Ambient declaration for MCP tool files under src/lib/mcp/, which are bundled
// at build-time into a Deno-based Supabase Edge Function by @lovable.dev/mcp-js.
declare const process: { env: Record<string, string | undefined> };
