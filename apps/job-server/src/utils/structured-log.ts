type LogValue = string | number | boolean | null | undefined;

export function structuredLog(
  prefix: string,
  data: Record<string, LogValue>
): void {
  const parts = [new Date().toISOString(), `[${prefix}]`];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${value}`);
    }
  }
  console.log(parts.join(" "));
}
