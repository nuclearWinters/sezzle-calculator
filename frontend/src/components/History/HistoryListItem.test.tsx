import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistoryListItem from "./HistoryListItem";
import type { HistoryEntry } from "../../types/history";

describe("HistoryListItem", () => {
  it("renders the operations and result", () => {
    const entry: HistoryEntry = {
      id: "1",
      operations: "2 + 3",
      result: "5",
      createdAt: "2026-01-01T00:00:00Z",
    };

    render(
      <ul>
        <HistoryListItem entry={entry} />
      </ul>,
    );

    expect(screen.getByText("2 + 3 =")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows a localized timestamp as the title", () => {
    const entry: HistoryEntry = {
      id: "1",
      operations: "2 + 3",
      result: "5",
      createdAt: "2026-01-01T00:00:00Z",
    };

    render(
      <ul>
        <HistoryListItem entry={entry} />
      </ul>,
    );

    expect(screen.getByText("2 + 3 =")).toHaveAttribute(
      "title",
      new Date(entry.createdAt).toLocaleString(),
    );
  });

  it("falls back to the raw string when createdAt isn't a valid date", () => {
    const entry: HistoryEntry = {
      id: "1",
      operations: "2 + 3",
      result: "5",
      createdAt: "not-a-date",
    };

    render(
      <ul>
        <HistoryListItem entry={entry} />
      </ul>,
    );

    expect(screen.getByText("2 + 3 =")).toHaveAttribute("title", "not-a-date");
  });

  it("marks optimistic entries (mock- id prefix) distinctly from real ones", () => {
    const optimistic: HistoryEntry = {
      id: "mock-1",
      operations: "1 + 1",
      result: "2",
      createdAt: "2026-01-01T00:00:00Z",
    };

    const { container: optimisticContainer } = render(
      <ul>
        <HistoryListItem entry={optimistic} />
      </ul>,
    );
    const optimisticClass = optimisticContainer.querySelector("li")?.className;

    const real: HistoryEntry = { ...optimistic, id: "real-1" };
    const { container: realContainer } = render(
      <ul>
        <HistoryListItem entry={real} />
      </ul>,
    );
    const realClass = realContainer.querySelector("li")?.className;

    expect(optimisticClass).not.toBe(realClass);
  });
});
