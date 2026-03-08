/** Type guard: narrows `value` to `string` */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Returns true when running in a Node.js environment */
export function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}
