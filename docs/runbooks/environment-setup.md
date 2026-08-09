# Environment setup

Use `.env.example` as the variable inventory, never as a credential store. Local values go in ignored `.env.local`; CI/staging/production use scoped secret stores. Keep separate database and provider credentials per environment. Service-role keys are server-only and must be rotated if exposed.

Validate required configuration at startup of the relevant integration. Do not invent placeholder production credentials or copy production data into development. Agent model-routing variables are development tooling and belong outside application deployment configuration.
