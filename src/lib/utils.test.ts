import { describe, it, expect } from "vitest";
import { cn, formatDuration, formatTokens, formatCost } from "./utils";

describe("cn", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("should merge tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

describe("formatDuration", () => {
  it("should format milliseconds", () => {
    expect(formatDuration(50)).toBe("50ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("should format seconds", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(59999)).toBe("60.0s");
  });

  it("should format minutes", () => {
    expect(formatDuration(60000)).toBe("1.0m");
    expect(formatDuration(90000)).toBe("1.5m");
  });
});

describe("formatTokens", () => {
  it("should format small numbers", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("should format thousands", () => {
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(15500)).toBe("15.5k");
  });

  it("should format millions", () => {
    expect(formatTokens(1000000)).toBe("1.0M");
    expect(formatTokens(2500000)).toBe("2.5M");
  });
});

describe("formatCost", () => {
  it("should format small costs with 4 decimals", () => {
    expect(formatCost(0.001)).toBe("$0.0010");
    expect(formatCost(0.0099)).toBe("$0.0099");
  });

  it("should format larger costs with 2 decimals", () => {
    expect(formatCost(0.01)).toBe("$0.01");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(99.99)).toBe("$99.99");
  });
});
