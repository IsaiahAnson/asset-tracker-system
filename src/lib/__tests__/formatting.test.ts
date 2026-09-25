import { describe, it, expect } from "vitest";
import { statusLabel, statusTone } from "@/lib/assets";
import { formatEastern } from "@/lib/audit";
import {
  groupBySection,
  distinctSections,
  formatCustomValue,
  DEFAULT_SECTION_LABEL,
  type CustomFieldDefinition
} from "@/lib/custom-field-types";

function def(partial: Partial<CustomFieldDefinition> & { id: string }): CustomFieldDefinition {
  return {
    entity: "asset",
    fieldKey: partial.id,
    label: partial.id,
    fieldType: "text",
    options: [],
    helpText: null,
    defaultValue: null,
    required: false,
    displayOrder: 0,
    active: true,
    section: null,
    ...partial
  };
}

describe("custom field section grouping", () => {
  it("groups fields by section, preserving order and pushing the default group last", () => {
    const items = [
      { definition: def({ id: "a", section: "Compliance" }), value: "1" },
      { definition: def({ id: "b", section: null }), value: "2" },
      { definition: def({ id: "c", section: "Compliance" }), value: "3" }
    ];
    const groups = groupBySection(items);
    expect(groups.map((g) => g.section)).toEqual(["Compliance", DEFAULT_SECTION_LABEL]);
    expect(groups[0].items.map((i) => i.definition.id)).toEqual(["a", "c"]);
    expect(groups[1].items.map((i) => i.definition.id)).toEqual(["b"]);
  });

  it("lists distinct named sections, ignoring blanks", () => {
    expect(
      distinctSections([def({ id: "a", section: "X" }), def({ id: "b", section: null }), def({ id: "c", section: "X" })])
    ).toEqual(["X"]);
  });

  it("formats checkbox values as Yes/No and blanks as a dash", () => {
    expect(formatCustomValue(def({ id: "f", fieldType: "checkbox" }), "true")).toBe("Yes");
    expect(formatCustomValue(def({ id: "f", fieldType: "checkbox" }), null)).toBe("No");
    expect(formatCustomValue(def({ id: "t", fieldType: "text" }), null)).toBe("—");
    expect(formatCustomValue(def({ id: "t", fieldType: "text" }), "hi")).toBe("hi");
  });
});

describe("asset status helpers", () => {
  it("maps known statuses to display labels", () => {
    expect(statusLabel("available")).toBe("Available");
    expect(statusLabel("in_transfer")).toBe("In transfer");
    expect(statusLabel("pending_approval")).toBe("Needs approval");
  });

  it("falls back to the raw status when unknown", () => {
    expect(statusLabel("mystery")).toBe("mystery");
  });

  it("assigns the expected tone per status", () => {
    expect(statusTone("available")).toBe("green");
    expect(statusTone("assigned")).toBe("blue");
    expect(statusTone("pending_approval")).toBe("yellow");
    expect(statusTone("in_transfer")).toBe("cyan");
    expect(statusTone("disposed")).toBe("red");
  });
});

describe("formatEastern", () => {
  it("renders a UTC instant in Eastern time with the ET suffix", () => {
    // 2026-05-21 14:30 UTC is EDT (UTC-4) -> 10:30 AM ET
    expect(formatEastern("2026-05-21T14:30:00Z")).toBe("2026-05-21 10:30 AM ET");
  });

  it("handles winter (EST, UTC-5)", () => {
    // 2026-01-15 14:30 UTC is EST (UTC-5) -> 9:30 AM ET
    expect(formatEastern("2026-01-15T14:30:00Z")).toBe("2026-01-15 9:30 AM ET");
  });

  it("renders afternoon times as PM", () => {
    // 2026-05-21 20:30 UTC is EDT (UTC-4) -> 4:30 PM ET
    expect(formatEastern("2026-05-21T20:30:00Z")).toBe("2026-05-21 4:30 PM ET");
  });
});

