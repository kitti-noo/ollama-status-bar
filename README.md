# Ollama Usage Status

A VS Code extension that shows your remaining Ollama Cloud usage in the status bar.
Hover over the status item to see each usage meter and its refill time. Click it
to refresh immediately.

> Ollama's usage percentages are read from the signed-in account settings page.
> The API-key usage endpoint may not include quota percentages.

## Setup

1. Sign in to [ollama.com](https://ollama.com) in your browser.
2. Open browser developer tools, find the `__Secure-session` cookie for
   `ollama.com`, and copy its value.
3. In VS Code, open the Command Palette and run **Ollama Usage: Set Session Cookie**.
4. Paste the cookie. The extension stores it using VS Code SecretStorage.

The extension does not send the cookie anywhere except `https://ollama.com/settings`.
Treat the cookie like a password: anyone who has it may be able to access your
Ollama account. Clear it with **Ollama Usage: Clear Session Cookie** if needed.

## Commands

- **Ollama Usage: Refresh** — fetch usage now.
- **Ollama Usage: Set Session Cookie** — save or replace the secure session cookie.
- **Ollama Usage: Clear Session Cookie** — remove the saved cookie.

## Settings

`ollamaStatus.refreshIntervalMinutes` controls automatic refreshes. It defaults
to 5 minutes; set it to `0` to refresh only when you click the status item.

## Development

```sh
npm install
npm test
```

Open this folder in VS Code and press `F5` to launch an Extension Development Host.
To build an installable VSIX, install `@vscode/vsce` and run `vsce package`.

Ollama's settings page is not a documented usage API. If its HTML structure
changes, usage parsing may need to be updated.
