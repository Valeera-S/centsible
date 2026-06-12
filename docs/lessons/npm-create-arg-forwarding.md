# npm does not forward --flags after -- on this setup; call tools via npx instead

Date: 2026-06-11 (phase 0, confirmed twice)

## Mistake

On npm 11.4.2 / Windows PowerShell, flags after `--` are NOT forwarded to the target;
npm eats them as its own unknown config and the tool sees only bare words:

- `npm create vite@latest dir -- --template react-ts` ran `create-vite dir react-ts`
  and silently fell back to the vanilla-ts template.
- `npm run dev -- --port 5199 --strictPort` ran `vite 5199` (port flag lost, "5199"
  misread as root dir) and the server came up on the default port 5173.

Both failures were silent except for an easy-to-miss
`npm warn Unknown cli config "--port"` line.

## Correct approach

Bypass npm arg forwarding and invoke the tool directly:

    npx -y create-vite@latest dir --template react-ts
    npx vite --port 5199 --strictPort

## Why

The mangling is silent, so anything scripted through `npm run <script> -- --flag` here
is unreliable. Watch for `npm warn Unknown cli config` in output, and verify the tool
actually received the flags (check the printed command line / resulting behavior).
