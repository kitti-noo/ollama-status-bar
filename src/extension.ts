import * as https from "node:https";
import * as vscode from "vscode";
import { formatRemaining, formatResetTime, parseUsageHtml, UsagePeriod } from "./usage";

const COOKIE_SECRET_KEY = "ollamaStatus.sessionCookie";
const SETTINGS_URL = "https://ollama.com/settings";
const REFRESH_INTERVAL_MINUTES = 5;

function fetchSettings(cookie: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      SETTINGS_URL,
      {
        headers: {
          Cookie: `__Secure-session=${cookie}`,
          "User-Agent": "Mozilla/5.0 (compatible; OllamaUsageStatus/0.1.0)",
          Accept: "text/html"
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`Ollama settings request failed (HTTP ${status}).`));
            return;
          }
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      }
    );
    request.setTimeout(15_000, () => {
      request.destroy(new Error("Ollama settings request timed out."));
    });
    request.on("error", reject);
  });
}

function usageTooltip(periods: UsagePeriod[], refreshedAt: Date): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown("**Ollama Cloud usage remaining**\n\n");
  for (const period of periods) {
    tooltip.appendMarkdown(`- **${period.label}:** ${formatRemaining(period.usedPercent)} left`);
    if (period.resetsAt) {
      tooltip.appendMarkdown(` (refills in ${formatResetTime(period.resetsAt)})`);
    }
    tooltip.appendMarkdown("\n");
  }
  tooltip.appendMarkdown(`\n_Last checked ${refreshedAt.toLocaleTimeString()} · click to refresh_`);
  return tooltip;
}

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  statusBar.name = "Ollama Usage Remaining";
  statusBar.command = "ollamaStatus.refresh";
  statusBar.text = "$(sync~spin) Ollama";
  statusBar.tooltip = "Loading Ollama Cloud usage...";
  statusBar.show();
  context.subscriptions.push(statusBar);

  let refreshing = false;
  const refresh = async (showErrors = false): Promise<void> => {
    if (refreshing) {
      return;
    }

    const cookie = await context.secrets.get(COOKIE_SECRET_KEY);
    if (!cookie) {
      statusBar.text = "$(cloud) Ollama: set cookie";
      statusBar.tooltip = "Run “Ollama Usage: Set Session Cookie” to check your remaining usage.";
      if (showErrors) {
        await vscode.commands.executeCommand("ollamaStatus.setCookie");
      }
      return;
    }

    refreshing = true;
    statusBar.text = "$(sync~spin) Ollama";
    try {
      const html = await fetchSettings(cookie);
      const periods = parseUsageHtml(html);
      const remaining = Math.min(...periods.map((period) => 100 - period.usedPercent));
      statusBar.text = `$(cloud) Ollama ${Math.round(remaining * 10) / 10}% left`;
      statusBar.tooltip = usageTooltip(periods, new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statusBar.text = "$(warning) Ollama usage unavailable";
      statusBar.tooltip = `${message} Click to retry.`;
      if (showErrors) {
        const action = await vscode.window.showErrorMessage(`Ollama Usage: ${message}`, "Set Session Cookie");
        if (action) {
          await vscode.commands.executeCommand("ollamaStatus.setCookie");
        }
      }
    } finally {
      refreshing = false;
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("ollamaStatus.refresh", () => refresh(true)),
    vscode.commands.registerCommand("ollamaStatus.setCookie", async () => {
      const cookie = await vscode.window.showInputBox({
        title: "Ollama Session Cookie",
        prompt: "Paste the __Secure-session cookie value from ollama.com. It is stored securely in VS Code.",
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => (value.trim() ? undefined : "Enter a session cookie.")
      });
      if (cookie === undefined) {
        return;
      }
      await context.secrets.store(COOKIE_SECRET_KEY, cookie.trim());
      await refresh(true);
    }),
    vscode.commands.registerCommand("ollamaStatus.clearCookie", async () => {
      await context.secrets.delete(COOKIE_SECRET_KEY);
      statusBar.text = "$(cloud) Ollama: set cookie";
      statusBar.tooltip = "Run “Ollama Usage: Set Session Cookie” to check your remaining usage.";
      void vscode.window.showInformationMessage("Ollama session cookie cleared.");
    })
  );

  const configuredInterval = vscode.workspace
    .getConfiguration("ollamaStatus")
    .get<number>("refreshIntervalMinutes", REFRESH_INTERVAL_MINUTES);
  if (configuredInterval > 0) {
    const timer = setInterval(() => void refresh(), configuredInterval * 60_000);
    context.subscriptions.push({ dispose: () => clearInterval(timer) });
  }

  void refresh();
}

export function deactivate(): void {}
