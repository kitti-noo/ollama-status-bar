const test = require("node:test");
const assert = require("node:assert/strict");
const { formatRemaining, formatResetTime, parseUsageHtml } = require("../out/usage");

test("parses free usage and its refill date", () => {
  const periods = parseUsageHtml(
    '<div aria-label="Free usage 7.5%"><time data-time="2026-10-20T12:00:00Z"></time></div>'
  );

  assert.equal(periods.length, 1);
  assert.equal(periods[0].label, "Free");
  assert.equal(periods[0].usedPercent, 7.5);
  assert.equal(periods[0].resetsAt.toISOString(), "2026-10-20T12:00:00.000Z");
  assert.equal(formatRemaining(periods[0].usedPercent), "92.5%");
});

test("parses multiple quota meters", () => {
  const periods = parseUsageHtml(
    '<div aria-label="Session usage: 40% used"><time data-time="2026-10-13T08:00:00Z"></time></div>' +
      '<div aria-label="Weekly usage 12.5%"><time data-time="2026-10-20T08:00:00Z"></time></div>'
  );

  assert.deepEqual(
    periods.map(({ label, usedPercent }) => [label, usedPercent]),
    [
      ["Session", 40],
      ["Weekly", 12.5]
    ]
  );
});

test("fails clearly for expired sessions and missing usage meters", () => {
  assert.throws(() => parseUsageHtml("<html>Sign in to Ollama</html>"), /invalid or expired/);
  assert.throws(() => parseUsageHtml("<html>Account settings</html>"), /Could not find usage data/);
});

test("formats refill countdowns", () => {
  const now = Date.UTC(2026, 9, 13);
  assert.equal(formatResetTime(new Date(now + 2 * 24 * 60 * 60_000), now), "2d");
  assert.equal(formatResetTime(new Date(now + 90 * 60_000), now), "1h 30m");
  assert.equal(formatResetTime(new Date(now - 1), now), "now");
});
