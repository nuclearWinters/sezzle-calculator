import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistoryHeading from "./HistoryHeading";

describe("HistoryHeading", () => {
  it("renders a heading with the text History", () => {
    render(<HistoryHeading />);

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
  });
});
