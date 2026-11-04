import ipaddr from "ipaddr.js";

/** Mask before hashing/persistence; IPv4-mapped IPv6 shares the IPv4 bucket. */
export function networkPrefix(value: string): string {
  try {
    const address = ipaddr.process(value);
    const bytes = address.toByteArray();
    const retained = address.kind() === "ipv4" ? 3 : 6;
    for (let index = retained; index < bytes.length; index++) bytes[index] = 0;
    return `${ipaddr.fromByteArray(bytes).toString()}/${retained * 8}`;
  } catch {
    return "unknown";
  }
}
