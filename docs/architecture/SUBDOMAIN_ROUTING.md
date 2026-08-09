# Subdomain Routing

Production tenant domains use exactly one label under `LELUNGO_ROOT_DOMAIN` (default `lelungo.com`): `homestaymelati.lelungo.com` resolves to `homestaymelati`. Root, `www`, reserved names, malformed names, and nested hosts do not resolve as tenants.

The hosting platform must configure wildcard DNS and TLS for `*.lelungo.com`. The proxy is not a DNS or certificate solution; it only converts the normalized hostname into server-only routing metadata.

Local wildcard hosts are disabled by default. To test `homestaymelati.localhost`, set `LELUNGO_ENABLE_LOCAL_TENANT_HOSTS=true`; no browser-selected tenant parameter is supported.
