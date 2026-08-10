---
name: Run manager process lifecycle
description: Package-manager run commands can create child servers that outlive the parent process.
---

Run-manager processes launched through pnpm/npm may create a shell and a child dev server, so lifecycle handling must account for the full process group rather than only the direct child.

**Why:** A smoke run left its Vite child alive after the package-manager parent was terminated.

**How to apply:** When adding stop/restart behavior, launch with an explicit process-group strategy and terminate the group safely; keep returned stdout, stderr, PID, and exit status tied to the managed run.