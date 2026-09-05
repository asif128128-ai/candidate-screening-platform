import { describe, expect, it } from "vitest";
import { truncateIp } from "@/lib/ip";

// ARCHITECTURE.md §6: IPv4 truncated to /24, IPv6 to /48.
describe("truncateIp", () => {
  it("truncates IPv4 to /24", () => {
    expect(truncateIp("1.2.3.4")).toBe("1.2.3.0/24");
    expect(truncateIp("255.255.255.255")).toBe("255.255.255.0/24");
  });

  it("truncates IPv6 to /48", () => {
    expect(truncateIp("2001:db8:1234:5678::1")).toBe("2001:db8:1234::/48");
  });

  it("returns null for garbage input", () => {
    expect(truncateIp("not-an-ip")).toBeNull();
    expect(truncateIp("1.2.3")).toBeNull();
  });
});
