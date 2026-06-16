#!/usr/bin/env node

/**
 * Setup script for split-tunnel-automation.
 *
 * 1. Creates a KV namespace called "STATE" via wrangler (if not already set up)
 * 2. Patches wrangler.jsonc with the real namespace ID (regex-based, preserves comments)
 * 3. Regenerates TypeScript types via cf-typegen
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const WRANGLER_PATH = resolve(PROJECT_ROOT, "wrangler.jsonc");

// A valid KV namespace ID is a 32-character hex string
const KV_ID_REGEX = /^[0-9a-f]{32}$/;

function log(msg) {
  console.log(`[setup] ${msg}`);
}

function fail(msg) {
  console.error(`[setup] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Read wrangler.jsonc as plain text and extract the current KV namespace ID
 * from the kv_namespaces section using regex (preserves comments).
 */
function getCurrentKvId(content) {
  // Match the "id" field inside kv_namespaces array
  const match = content.match(
    /"kv_namespaces"\s*:\s*\[[\s\S]*?"id"\s*:\s*"([^"]+)"/
  );
  return match ? match[1] : null;
}

/**
 * Replace the KV namespace ID in wrangler.jsonc text using regex.
 * Targets the "id": "..." line within the kv_namespaces section.
 */
function replaceKvId(content, newId) {
  // Replace the "id" value inside kv_namespaces
  // We look for the first "id": "..." after "kv_namespaces"
  let replaced = false;
  const result = content.replace(
    /("kv_namespaces"\s*:\s*\[[\s\S]*?"id"\s*:\s*")([^"]+)(")/,
    (match, prefix, oldId, suffix) => {
      replaced = true;
      return `${prefix}${newId}${suffix}`;
    }
  );
  if (!replaced) {
    fail("Could not find KV namespace ID to replace in wrangler.jsonc");
  }
  return result;
}

/**
 * Run a command and return its stdout.
 */
function run(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    fail(`Command failed: ${cmd}\n${err.stderr || err.message}`);
  }
}

// --- Main ---

log(`Reading wrangler.jsonc from ${WRANGLER_PATH}`);

let wranglerContent;
try {
  wranglerContent = readFileSync(WRANGLER_PATH, "utf-8");
} catch (err) {
  fail(`Could not read wrangler.jsonc: ${err.message}`);
}

const currentId = getCurrentKvId(wranglerContent);
log(`Current KV namespace ID: ${currentId || "(not found)"}`);

if (currentId && KV_ID_REGEX.test(currentId)) {
  log(`KV namespace ID "${currentId}" already looks valid (32 hex chars). Skipping creation.`);
} else {
  log("Creating KV namespace 'STATE' via wrangler...");
  const output = run("npx wrangler kv namespace create STATE");
  log("Wrangler output:\n" + output.trim());

  // Extract the namespace ID from wrangler output
  // wrangler outputs something like: { id: "abc123..." } or id: "abc123..."
  const idMatch = output.match(/\b id:\s*"([0-9a-f]{32})"/);
  if (!idMatch) {
    fail(
      `Could not extract KV namespace ID from wrangler output.\n` +
      `Looked for pattern: id: "<32-hex-chars>"\n` +
      `Full output:\n${output}`
    );
  }

  const newId = idMatch[1];
  log(`Extracted namespace ID: ${newId}`);

  // Patch wrangler.jsonc
  log("Patching wrangler.jsonc with new namespace ID...");
  wranglerContent = replaceKvId(wranglerContent, newId);
  try {
    writeFileSync(WRANGLER_PATH, wranglerContent, "utf-8");
  } catch (err) {
    fail(`Could not write wrangler.jsonc: ${err.message}`);
  }
  log("wrangler.jsonc updated successfully.");
}

// Regenerate TypeScript types
log("Running cf-typegen to regenerate TypeScript types...");
run("npm run cf-typegen");
log("Type generation complete.");

log("Setup finished successfully.");
