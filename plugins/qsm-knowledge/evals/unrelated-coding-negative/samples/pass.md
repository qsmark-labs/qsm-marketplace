```ts
function parseDuration(text: string): number {
  const units: Record<string, number> = { h: 3600, m: 60, s: 1 };
  let seconds = 0;
  for (const [, n, u] of text.matchAll(/(\d+)([hms])/g)) seconds += Number(n) * units[u];
  return seconds;
}
```
