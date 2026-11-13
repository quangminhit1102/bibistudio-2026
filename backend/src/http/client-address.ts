import ipaddr from "ipaddr.js";

/** Express resolves req.ip; this boundary never selects an arbitrary X-Forwarded-For entry. */
export function resolveClientAddress(input: {
  peer?: string;
  ip?: string;
  sourceVerified: boolean;
  trustedCidrs: readonly string[];
}): { address: string | null; status: "verified" | "unavailable" } {
  const unavailable = { address: null, status: "unavailable" } as const;
  if (!input.sourceVerified || !input.peer || !input.ip || /[%\s,]/.test(input.ip))
    return unavailable;
  try {
    const peer = ipaddr.process(input.peer);
    const trusted = input.trustedCidrs.some((cidr) => {
      const [network, bits] = ipaddr.parseCIDR(cidr);
      return peer.kind() === network.kind() && peer.match(network, bits);
    });
    if (!trusted) return unavailable;
    const address = ipaddr.process(input.ip);
    if (address.range() !== "unicast") return unavailable;
    return { address: address.toString(), status: "verified" };
  } catch {
    return unavailable;
  }
}
