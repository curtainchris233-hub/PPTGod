import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { scrubUpstreamError, validateByokApiBase } from "@/lib/deckValidation";

const DEFAULT_BASE = "https://api.openai.com/v1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRIVATE_IPV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) {
  PRIVATE_IPV4.addSubnet(address, prefix, "ipv4");
}

const GLOBAL_IPV6 = new BlockList();
GLOBAL_IPV6.addSubnet("2000::", 3, "ipv6");
const SPECIAL_IPV6 = new BlockList();
SPECIAL_IPV6.addSubnet("2001::", 23, "ipv6");
SPECIAL_IPV6.addSubnet("2001:db8::", 32, "ipv6");
SPECIAL_IPV6.addSubnet("2002::", 16, "ipv6");
SPECIAL_IPV6.addSubnet("3fff::", 20, "ipv6");

export type ProviderConfig = {
  apiKey: string;
  endpointRoot: string;
  model: string;
  usesSiteKey: boolean;
};

function publicProviderOnly() {
  return process.env.PPTGOD_REQUIRE_SERVICES === "true"
    || process.env.PPTGOD_PUBLIC_PREVIEW === "true"
    || process.env.STRICT_PUBLIC_BYOK_ONLY === "true";
}

function allowLocalHost(host: string) {
  return LOCAL_HOSTS.has(host) && !publicProviderOnly();
}

function isAllowedAddress(address: string, local: boolean) {
  if (local) return address === "127.0.0.1" || address === "::1";
  switch (isIP(address)) {
    case 4: return !PRIVATE_IPV4.check(address, "ipv4");
    case 6: return GLOBAL_IPV6.check(address, "ipv6") && !SPECIAL_IPV6.check(address, "ipv6");
    default: return false;
  }
}

export function resolveProvider(
  { apiKey, apiBase, model }: { apiKey: string; apiBase: string; model: string },
  kind: "text" | "image",
  missingKeyMessage: string
): { ok: true; config: ProviderConfig } | { ok: false; error: string } {
  const siteBase = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE;
  const siteKey =
    (kind === "image" ? process.env.OPENAI_IMAGE_API_KEY : "")?.trim() ||
    process.env.OPENAI_API_KEY?.trim() || "";
  const siteModel = kind === "image"
    ? process.env.OPENAI_IMAGE_MODEL?.trim() || "dall-e-3"
    : process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const usesSiteKey = !apiKey;
  const configuredKey = apiKey || siteKey;
  if (!configuredKey) return { ok: false, error: missingKeyMessage };

  const base = validateByokApiBase(usesSiteKey ? siteBase : apiBase || siteBase);
  if (!base.ok) return base;
  if (usesSiteKey && apiBase) {
    const requestedBase = validateByokApiBase(apiBase);
    if (!requestedBase.ok) return requestedBase;
    if (requestedBase.endpointRoot !== DEFAULT_BASE && requestedBase.endpointRoot !== base.endpointRoot) {
      return { ok: false, error: "使用自定义接口地址时，请输入该服务的 API Key" };
    }
  }

  const endpoint = new URL(base.endpointRoot);
  const host = endpoint.hostname.replace(/^\[|\]$/g, "");
  const local = allowLocalHost(host);
  if ((isIP(host) && !isAllowedAddress(host, local)) || (LOCAL_HOSTS.has(host) && !local)) {
    return { ok: false, error: "API Base URL 必须指向可公开访问的服务" };
  }
  if (!local && endpoint.protocol !== "https:" && (usesSiteKey || publicProviderOnly())) {
    return { ok: false, error: "API Base URL 请使用 HTTPS 地址" };
  }

  return {
    ok: true,
    config: {
      apiKey: configuredKey,
      endpointRoot: base.endpointRoot,
      model: usesSiteKey ? siteModel : model || siteModel,
      usesSiteKey,
    },
  };
}

// Resolve and check addresses in the socket's own lookup, so a second DNS resolution
// cannot bypass the check. Keep the original hostname for TLS verification.
export function createProviderTransport(endpointRoot: string) {
  const endpoint = new URL(endpointRoot);
  const host = endpoint.hostname.replace(/^\[|\]$/g, "");
  const local = allowLocalHost(host);
  const dispatcher = new Agent({
    connect: {
      lookup(hostname, options, callback) {
        lookup(hostname, { family: options.family, all: true }, (error, addresses) => {
          if (error) return callback(error, "", 0);
          const allowed = addresses.filter(({ address }) => isAllowedAddress(address, local));
          const first = allowed[0];
          if (!first) {
            return callback(new Error("Provider address is not allowed"), "", 0);
          }
          if (options.all) return callback(null, allowed);
          return callback(null, first.address, first.family);
        });
      },
    },
    maxResponseSize: 8 * 1024 * 1024,
  });

  return {
    async fetch(url: string, init?: RequestInit): Promise<Response> {
      if (new URL(url).origin !== endpoint.origin) throw new Error("Provider origin changed");
      return undiciFetch(url, {
        ...(init as Parameters<typeof undiciFetch>[1]),
        dispatcher,
        redirect: "error",
      }) as unknown as Promise<Response>;
    },
    close: () => dispatcher.destroy(),
  };
}

export async function getProviderError(response: Response, apiKey: string) {
  const reader = response.body?.getReader();
  let snippet = "";
  if (reader) {
    try {
      const { value } = await reader.read();
      if (value) snippet = new TextDecoder().decode(value.subarray(0, 2048));
    } catch {
      // A generic upstream error still includes the HTTP status.
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  const safeSnippet = scrubUpstreamError(snippet, apiKey);
  return `大模型接口返回错误（HTTP ${response.status}）${safeSnippet ? `：${safeSnippet}` : ""}`;
}
