import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistoryLoading from "./HistoryLoading";

describe("HistoryLoading", () => {
  it("renders a loading indicator", () => {
    render(<HistoryLoading />);

    expect(screen.getByTestId("history-loading")).toHaveTextContent("Loading…");
  });
});
