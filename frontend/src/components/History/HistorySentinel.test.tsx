import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistorySentinel from "./HistorySentinel";

describe("HistorySentinel", () => {
  it("renders a sentinel element", () => {
    render(<HistorySentinel ref={createRef<HTMLDivElement>()} />);

    expect(screen.getByTestId("history-sentinel")).toBeInTheDocument();
  });

  it("forwards the ref to the underlying element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<HistorySentinel ref={ref} />);

    expect(ref.current).toBe(screen.getByTestId("history-sentinel"));
  });
});
