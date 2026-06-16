import { describe, it, expect } from "vitest";
import { toggleService } from "../frontend/src/lib/services-toggle";

type ServiceName = "Exchange" | "SharePoint" | "Skype";

describe("toggleService", () => {
  it("adds a service when checked=true", () => {
    const prev = new Set<ServiceName>(["Exchange"]);
    const result = toggleService(prev, "SharePoint", true);
    expect(result).toEqual(new Set(["Exchange", "SharePoint"]));
  });

  it("removes a service when checked=false and more than one remains", () => {
    const prev = new Set<ServiceName>(["Exchange", "SharePoint"]);
    const result = toggleService(prev, "SharePoint", false);
    expect(result).toEqual(new Set(["Exchange"]));
  });

  it("prevents deselecting the last remaining service", () => {
    const prev = new Set<ServiceName>(["Exchange"]);
    const result = toggleService(prev, "Exchange", false);
    expect(result).toEqual(new Set(["Exchange"]));
  });

  it("returns the same set reference when preventing deselection", () => {
    const prev = new Set<ServiceName>(["Skype"]);
    const result = toggleService(prev, "Skype", false);
    expect(result).toBe(prev); // same reference, not a new Set
  });

  it("returns a new set when a service is added", () => {
    const prev = new Set<ServiceName>(["Exchange"]);
    const result = toggleService(prev, "SharePoint", true);
    expect(result).not.toBe(prev);
  });

  it("returns a new set when a service is removed (more than one remaining)", () => {
    const prev = new Set<ServiceName>(["Exchange", "SharePoint", "Skype"]);
    const result = toggleService(prev, "Skype", false);
    expect(result).not.toBe(prev);
    expect(result).toEqual(new Set(["Exchange", "SharePoint"]));
  });

  it("handles adding a service that is already present (idempotent)", () => {
    const prev = new Set<ServiceName>(["Exchange", "SharePoint"]);
    const result = toggleService(prev, "Exchange", true);
    expect(result).toEqual(new Set(["Exchange", "SharePoint"]));
  });
});
