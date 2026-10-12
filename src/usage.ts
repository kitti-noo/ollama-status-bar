export interface UsagePeriod {
  label: string;
  usedPercent: number;
  resetsAt?: Date;
}

const meterPattern =
  /aria-label="([A-Za-z][\w -]*?)\s+usage:?\s+([\d.]+)%(?:\s*used)?"/gi;
const resetPattern = /data-time="([^"]+)"/i;

export function parseUsageHtml(html: string): UsagePeriod[] {
  if (/\/login|sign in/i.test(html)) {
    throw new Error("Ollama session cookie is invalid or expired.");
  }

  const matches = [...html.matchAll(meterPattern)];
  if (matches.length === 0) {
    throw new Error("Could not find usage data on ollama.com/settings.");
  }

  return matches.map((match, index) => {
    const label = match[1];
    const usedPercent = Number(match[2]);
    if (!Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100) {
      throw new Error(`Ollama returned an invalid usage percentage for ${label}.`);
    }

    const end = matches[index + 1]?.index ?? html.length;
    const followingHtml = html.slice((match.index ?? 0) + match[0].length, end);
    const resetMatch = resetPattern.exec(followingHtml);
    resetPattern.lastIndex = 0;
    const resetsAt = resetMatch ? new Date(resetMatch[1]) : undefined;

    return {
      label,
      usedPercent,
      ...(resetsAt && Number.isNaN(resetsAt.getTime()) ? {} : { resetsAt })
    };
  });
}

export function formatRemaining(usedPercent: number): string {
  return `${Math.round((100 - usedPercent) * 10) / 10}%`;
}

export function formatResetTime(resetsAt: Date, now = Date.now()): string {
  const remainingMs = resetsAt.getTime() - now;
  if (remainingMs <= 0) {
    return "now";
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return [
    days > 0 ? `${days}d` : "",
    hours > 0 ? `${hours}h` : "",
    minutes > 0 && days === 0 ? `${minutes}m` : ""
  ]
    .filter(Boolean)
    .join(" ");
}
