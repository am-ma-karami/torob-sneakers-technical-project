# Actual design-tool status

The current [Glass Studio tool record](glass-studio/design-system.md#applied-tools) includes a fresh authenticated 51-tool discovery, free logo searches (successful empty results), and glass-navigation component metadata. It also records the applied UI UX Pro Max glass and motion guidance. The earlier setup and segmented-tab discovery remain below.

## UI UX Pro Max

Installed locally with `npx --yes ui-ux-pro-max-cli@latest init --ai codex` into `.agents/skills/`. The installed `ui-ux-pro-max/SKILL.md` was read and applied through design-system, UX motion/focus and React query-state searches. The full CLI-generated tool bundle is ignored to keep vendor code out of the app repository. Run the same command to reproduce installation. The skill becomes discoverable on a later Codex turn/restart; its local workflow was executed directly during this implementation.

The first broad design query returned an irrelevant pharmacy palette, which was rejected. The narrower footwear query supplied relevant product hierarchy and motion/accessibility guidance. Persian typography and the final blueprint palette were deliberately adapted in `design-system.md`.

## 21st MCP

Codex CLI version observed: 0.171.0-alpha.13. Project-local `.codex/config.toml` adds only the `21st` server and preserves global configuration. `codex mcp get 21st --json` confirms it is enabled with Streamable HTTP, the official endpoint and an environment-backed x-api-key header. No secret is present in TOML, source, frontend code or documentation.

The user-supplied key is stored only in the ignored local `.env` (mode 0600). The existing running Codex process did **not** inherit `API_KEY_21ST`; writing `.env` cannot retroactively change that process. Consequently this chat does not claim to have hot-loaded native 21st tools.

A separate authenticated MCP client loaded the private local environment and successfully ran initialize, initialized notification, tools/list (51 tools) and free `search` for animated segmented tabs. Results included [Segmented Tabs by micka_design](https://21st.dev/@micka_design/components/tabs-base) and [Sliding Tabs by shadcnstore](https://21st.dev/@shadcnstore/components/motion-sliding-tabs). The segmented selected-background interaction informed the anatomy mode switcher. Implementation is original and uses semantic HTML buttons, Motion's shared layout and reduced-motion handling. Search metadata was used; paid code retrieval and AI generation were not invoked, and no subscription or credits were purchased.

The environment check and connection can be reproduced without printing the key:

```sh
.venv/bin/python scripts/launch_codex.py --check
.venv/bin/python scripts/check_21st.py --load-local-env --search
```

To run a **new** Codex CLI process with the credential inherited from `.env`:

```sh
sh scripts/codex-design.sh
```

The Python launcher parses dotenv safely and passes the environment directly to Codex. For the desktop app, set `API_KEY_21ST` privately in the environment of the process that launches the app, then fully quit and relaunch it; a shell export made after an already-running GUI app started does not change that app's environment. Depending on project trust, Codex may require the project configuration to be trusted before loading project MCP servers. Never paste the key into public configuration or prefix its name with `VITE_`.

The connection helper uses TLS certificate verification with the macOS system certificate bundle (Python's default installation lacked that CA store). It never disables certificate verification. The app itself does not use 21st or its credential at runtime.
