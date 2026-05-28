import { describe, it, expect } from "vitest";
import { extractJsonObject } from "../jsonParse";

describe("extractJsonObject", () => {
  it("should parse raw JSON string", () => {
    const result = extractJsonObject('{"score": 85, "summary": "Good match"}');
    expect(result).toEqual({ score: 85, summary: "Good match" });
  });

  it("should parse JSON wrapped in markdown fences", () => {
    const result = extractJsonObject('```json\n{"score": 72}\n```');
    expect(result).toEqual({ score: 72 });
  });

  it("should parse JSON in bare fences without language tag", () => {
    const result = extractJsonObject('```\n{"score": 90}\n```');
    expect(result).toEqual({ score: 90 });
  });

  it("should extract JSON object with surrounding text", () => {
    const result = extractJsonObject('Here is the result: {"score": 60} End.');
    expect(result).toEqual({ score: 60 });
  });

  it("should throw on invalid JSON", () => {
    expect(() => extractJsonObject("not json at all")).toThrow("Could not parse JSON");
  });

  it("should throw on empty string", () => {
    expect(() => extractJsonObject("")).toThrow("Could not parse JSON");
  });
});
