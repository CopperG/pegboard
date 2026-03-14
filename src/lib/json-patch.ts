import { applyPatch, type Operation } from 'fast-json-patch'

/** Paths that must never appear in patch operations (prototype pollution prevention) */
const DANGEROUS_PATHS = ['__proto__', 'constructor', 'prototype']

/**
 * Check whether a list of JSON Patch operations contains dangerous paths
 * that could lead to prototype pollution.
 * Returns true if all operations are safe, false otherwise.
 */
export function validatePatchSafety(ops: { path: string }[]): boolean {
  return ops.every(op => {
    const pathParts = op.path.split('/')
    return !pathParts.some(part => DANGEROUS_PATHS.includes(part))
  })
}

export function applyJsonPatch<T>(document: T, patch: Operation[]): T {
  // Guard against prototype pollution
  if (!validatePatchSafety(patch)) {
    console.error(
      '[json-patch] Rejected unsafe patch containing prototype pollution attempt',
    )
    return document
  }

  const result = applyPatch(document, patch, true, false) // validate, don't mutate
  return result.newDocument as T
}
