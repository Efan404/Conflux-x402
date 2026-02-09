# Hackathon Web Demo

React + Vite frontend demo for Conflux x402.

## Run

```bash
pnpm install
pnpm --filter @conflux-x402/facilitator dev
pnpm --filter @conflux-x402/sandbox dev
pnpm --filter @conflux-x402/hackathon-web dev
```

Open: `http://localhost:3000`

Key pages:

- `/` overview
- `/quickstart` developer scaffolding guide (`create-x402-conflux-app`)
- `/demo` paywall/auth/refund flow demos
- `/playground` discovery + chart agent demo
- `/ai-pay` ops cockpit

## Build

```bash
pnpm --filter @conflux-x402/hackathon-web build
pnpm --filter @conflux-x402/hackathon-web preview
```

## Environment

Create env file from template:

```bash
cp examples/hackathon-web/.env.example examples/hackathon-web/.env
```

Gateway variables:

- `VITE_API_SANDBOX_BASE`
- `VITE_API_FACILITATOR_BASE`
- `VITE_API_ATTESTOR_BASE`
- `VITE_ZK_VERIFIER_ADDRESS` (required for on-chain `verifyAndRegister` in Client Auth)

## API Routing

By default, frontend requests `/api/sandbox/*`, `/api/facilitator/*`, `/api/attestor/*`.

In development (`pnpm ... dev`), frontend keeps `/api/*` same-origin and Vite proxy forwards to targets.

In production build, if `VITE_API_*` variables are set, frontend can call those URLs directly.

In local development (without `VITE_API_*`), Vite proxies requests:

- `/api/sandbox/*` -> `http://localhost:4021/*`
- `/api/facilitator/*` -> `http://localhost:4022/*`
- `/api/attestor/*` -> `http://localhost:3003/*`

With Railway targets in `.env`, proxy targets become:

- `/api/sandbox/*` -> `${VITE_API_SANDBOX_BASE}/*`
- `/api/facilitator/*` -> `${VITE_API_FACILITATOR_BASE}/*`
- `/api/attestor/*` -> `${VITE_API_ATTESTOR_BASE}/*`
