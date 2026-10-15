```ts
export function parseDuration(text: string): number {
  let seconds = 0;
  for (const [, n, unit] of text.matchAll(/(\d+)([hms])/g)) {
    seconds += Number(n) * { h: 3600, m: 60, s: 1 }[unit];
  }
  return seconds;
}

parseDuration("1h30m"); // 5400
parseDuration("45s"); // 45
```
