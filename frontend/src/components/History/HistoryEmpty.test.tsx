import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistoryEmpty from "./HistoryEmpty";

describe("HistoryEmpty", () => {
  it("renders the empty state message", () => {
    render(<HistoryEmpty />);

    expect(screen.getByText("No calculations yet.")).toBeInTheDocument();
  });
});
