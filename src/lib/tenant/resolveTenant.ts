export function resolveTenant(input: {
  host: string;
  embedTenantId?: string;
  rootDomain: string;
}): string | null {
  if (input.embedTenantId) {
    return input.embedTenantId;
  }

  const { host, rootDomain } = input;

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return null;
  }

  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) {
    return null;
  }

  return subdomain;
}
