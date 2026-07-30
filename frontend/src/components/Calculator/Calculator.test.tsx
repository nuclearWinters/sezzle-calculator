import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calculator from "./Calculator";
import History from "../History/History";
import HistoryProvider from "../History/HistoryProvider";
import HistoryLoading from "../History/HistoryLoading";
import { fetchHistory } from "../../api/historyApi";
import { mockFetchRoutes } from "../../test/mockFetch";

function mockFetchOnce(status: number, body: unknown) {
  return mockFetchRoutes({
    calculate: { status, body },
    fallback: { status: 200, body: { items: [], nextCursor: null } },
  });
}

function renderCalculator() {
  return render(
    <HistoryProvider historyPromise={fetchHistory(null, 20)}>
      <Calculator />
    </HistoryProvider>,
  );
}

async function renderCalculatorWithHistory() {
  await act(async () => {
    render(
      <HistoryProvider historyPromise={fetchHistory(null, 20)}>
        <Calculator />
        <Suspense fallback={<HistoryLoading />}>
          <History />
        </Suspense>
      </HistoryProvider>,
    );
  });
}

describe("Calculator", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "0" }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders with an initial display of 0", () => {
    renderCalculator();
    expect(screen.getByTestId("display")).toHaveTextContent("0");
  });

  it("performs addition by calling the backend and displaying the result", async () => {
    const fetchMock = mockFetchOnce(200, { result: "5" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("5"));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/add"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ a: "2", b: "3" }),
      }),
    );
  });

  it("shows a backend error message instead of crashing on divide by zero", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(400, { error: "division by zero is not allowed" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "÷" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("division by zero is not allowed"),
    );
  });

  it("prevents entering more than one decimal point", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "." }));
    await user.click(screen.getByRole("button", { name: "." }));
    await user.click(screen.getByRole("button", { name: "5" }));

    expect(screen.getByTestId("display")).toHaveTextContent("5.5");
  });

  it("resets to 0 when clear is pressed", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "7" }));
    expect(screen.getByTestId("display")).toHaveTextContent("7");

    await user.click(screen.getByRole("button", { name: "C" }));
    expect(screen.getByTestId("display")).toHaveTextContent("0");
  });

  it("keeps the operator visible with backspace once a multi-digit second operand is emptied out, then removes it on the next press", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 × 25");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 × 2");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 ×");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByTestId("display")).toHaveTextContent("23");
  });

  it("keeps the operator visible after backspacing away a single-digit second operand", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    expect(screen.getByTestId("display")).toHaveTextContent("5 + 1");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("5 +");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("5");
  });

  it("replaces the operator (keeping the first operand) when a new one is clicked after backspacing away the second", async () => {
    const fetchMock = mockFetchOnce(200, { result: "23" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByTestId("display")).toHaveTextContent("20 × 3");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("20 ×");

    await user.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByTestId("display")).toHaveTextContent("20 +");

    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("23"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/add"),
      expect.objectContaining({ body: JSON.stringify({ a: "20", b: "3" }) }),
    );
  });

  it("cancels the operator immediately with backspace if pressed before typing the second operand", async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 ×");

    await user.click(screen.getByRole("button", { name: "⌫" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2");
  });

  it("replaces the pending operator when a different one is clicked before typing the second operand", async () => {
    const fetchMock = mockFetchOnce(200, { result: "5" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 ×");

    await user.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 +");

    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("5"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/add"),
      expect.objectContaining({ body: JSON.stringify({ a: "2", b: "3" }) }),
    );
  });

  it("shows the operation in progress in the value display, and 'Ans = 0' at the top before any computation has happened", async () => {
    const user = userEvent.setup();
    renderCalculator();

    expect(screen.queryByTestId("history")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "×" }));

    expect(screen.getByTestId("display")).toHaveTextContent("20 ×");
    expect(screen.getByTestId("history")).toHaveTextContent("Ans = 0");

    await user.click(screen.getByRole("button", { name: "5" }));

    expect(screen.getByTestId("display")).toHaveTextContent("20 × 5");
    expect(screen.getByTestId("history")).toHaveTextContent("Ans = 0");
  });

  it("shows the completed equation with a trailing = above the result", async () => {
    const fetchMock = mockFetchOnce(200, { result: "400" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("400"));
    expect(screen.getByTestId("history")).toHaveTextContent("20 × 20 =");
  });

  it('shows "Ans = <result>" once a new calculation is started after a result exists', async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "400" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("400"));

    await user.click(screen.getByRole("button", { name: "5" }));

    expect(screen.getByTestId("display")).toHaveTextContent("5");
    expect(screen.getByTestId("history")).toHaveTextContent("Ans = 400");
  });

  it("computes an unary square root immediately without requiring equals", async () => {
    const fetchMock = mockFetchOnce(200, { result: "4" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "√" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("4"));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/sqrt"),
      expect.objectContaining({ body: JSON.stringify({ a: "16" }) }),
    );
  });

  it("continues a chain off a result of exactly 0", async () => {
    const fetchMock = mockFetchOnce(200, { result: "0" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "−" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("0"));

    await user.click(screen.getByRole("button", { name: "+" }));

    expect(screen.getByTestId("display")).toHaveTextContent("0 +");
  });

  it("does nothing when square root is pressed while a second operand is being entered", async () => {
    const fetchMock = mockFetchOnce(200, { result: "0" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByTestId("display")).toHaveTextContent("2 × 3");

    await user.click(screen.getByRole("button", { name: "√" }));

    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/calculate"), expect.anything());
    expect(screen.getByTestId("display")).toHaveTextContent("2 × 3");
  });

  it("collapses a pending operator into a standalone square root when no second operand was typed yet", async () => {
    const fetchMock = mockFetchOnce(200, { result: "3" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "9" }));
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(screen.getByTestId("display")).toHaveTextContent("9 ×");

    await user.click(screen.getByRole("button", { name: "√" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("3"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/sqrt"),
      expect.objectContaining({ body: JSON.stringify({ a: "9" }) }),
    );
    expect(screen.getByTestId("history")).toHaveTextContent("√9 =");
  });

  it("computes the square root of 0 when pressed on a fresh, untouched calculator", async () => {
    const fetchMock = mockFetchOnce(200, { result: "0" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "√" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/sqrt"),
        expect.objectContaining({ body: JSON.stringify({ a: "0" }) }),
      ),
    );
    expect(screen.getByTestId("history")).toHaveTextContent("√0 =");
  });

  it("keeps exact precision at magnitudes where float64 would round (1e30 - 1e20)", async () => {
    const fetchMock = mockFetchOnce(200, { result: "999999999900000000000000000000" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "EXP" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "−" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "EXP" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/calculate/subtract"),
      expect.objectContaining({ body: JSON.stringify({ a: "1e+30", b: "100000000000000000000" }) }),
    );
  });

  it("keeps exact precision at magnitudes where float64 would round (1e21 - 1)", async () => {
    const fetchMock = mockFetchOnce(200, { result: "999999999999999999999" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "EXP" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "−" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/subtract"),
        expect.objectContaining({ body: JSON.stringify({ a: "1e+21", b: "1" }) }),
      ),
    );
  });

  it("never rounds a result into looking like a different, 'cleaner' number", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "99999999999999999998.9" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(screen.getByTestId("display")).toHaveTextContent("99999999999999999998.9"),
    );
  });

  it("chains off a result without losing precision", async () => {
    const divideMock = mockFetchOnce(200, {
      result: "0.33333333333333333333333333333333333333333333333333",
    });
    vi.stubGlobal("fetch", divideMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "÷" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(screen.getByTestId("display")).toHaveTextContent(
        "0.33333333333333333333333333333333333333333333333333",
      ),
    );

    const multiplyMock = mockFetchOnce(200, { result: "1" });
    vi.stubGlobal("fetch", multiplyMock);

    await user.click(screen.getByRole("button", { name: "×" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(multiplyMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/multiply"),
        expect.objectContaining({
          body: JSON.stringify({
            a: "0.33333333333333333333333333333333333333333333333333",
            b: "3",
          }),
        }),
      ),
    );
  });

  it("disables equals on a fresh calculator and enables it once a calculation has completed", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "8" }));

    const user = userEvent.setup();
    renderCalculator();

    expect(screen.getByRole("button", { name: "=" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("8"));
    expect(screen.getByRole("button", { name: "=" })).not.toBeDisabled();
  });

  it("repeats the last operation against the previous result when = is pressed again", async () => {
    const fetchMock = mockFetchOnce(200, { result: "8" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("8"));

    const repeatMock = mockFetchOnce(200, { result: "11" });
    vi.stubGlobal("fetch", repeatMock);

    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(repeatMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/add"),
        expect.objectContaining({ body: JSON.stringify({ a: "8", b: "3" }) }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("11"));
  });

  it("repeats the last operation against a freshly typed number when = is pressed again", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "8" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("8"));

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "0" }));

    const repeatMock = mockFetchOnce(200, { result: "13" });
    vi.stubGlobal("fetch", repeatMock);

    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(repeatMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/add"),
        expect.objectContaining({ body: JSON.stringify({ a: "10", b: "3" }) }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("13"));
  });

  it("clearing forgets the repeatable last operation", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "8" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("8"));

    await user.click(screen.getByRole("button", { name: "C" }));

    expect(screen.getByRole("button", { name: "=" })).toBeDisabled();
  });

  it("uses the first operand as the second when = is pressed with no second operand typed", async () => {
    const fetchMock = mockFetchOnce(200, { result: "10" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/add"),
        expect.objectContaining({ body: JSON.stringify({ a: "5", b: "5" }) }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("display")).toHaveTextContent("10"));
  });

  it("normalizes a bare typed number through the backend when = is pressed with no operator", async () => {
    const fetchMock = mockFetchOnce(200, { result: "100" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "EXP" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/identity"),
        expect.objectContaining({ body: JSON.stringify({ a: "100" }) }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("100"));
  });

  it("normalizes a plain typed number (no-op value) the same way", async () => {
    const fetchMock = mockFetchOnce(200, { result: "80" });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "8" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/identity"),
        expect.objectContaining({ body: JSON.stringify({ a: "80" }) }),
      ),
    );
  });

  it("enables equals as soon as a bare number is typed, with nothing else pending", async () => {
    const user = userEvent.setup();
    renderCalculator();

    expect(screen.getByRole("button", { name: "=" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "5" }));

    expect(screen.getByRole("button", { name: "=" })).not.toBeDisabled();
  });

  it("prefers repeating the last binary operation over normalizing a freshly typed number", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "8" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("8"));

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "0" }));

    const repeatMock = mockFetchOnce(200, { result: "13" });
    vi.stubGlobal("fetch", repeatMock);

    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(repeatMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/calculate/add"),
        expect.objectContaining({ body: JSON.stringify({ a: "10", b: "3" }) }),
      ),
    );
  });

  it("shows the exact, non-exponential value as a title tooltip on the result", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { result: "1.0000000000000000000000000000004e+32" }));

    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("1.0000000000000000000000000000004e+32"),
    );
    expect(screen.getByTestId("value")).toHaveAttribute(
      "title",
      "100000000000000000000000000000040",
    );

    await user.click(screen.getByRole("button", { name: "+" }));

    expect(screen.getByTestId("history")).toHaveAttribute(
      "title",
      "Ans = 100000000000000000000000000000040",
    );
    expect(screen.getByTestId("value")).not.toHaveAttribute("title");
  });

  it("shrinks the display font as the shown text gets longer", async () => {
    const user = userEvent.setup();
    renderCalculator();

    const shortSize = screen.getByTestId("value").style.fontSize;

    for (const digit of "123456789012345") {
      await user.click(screen.getByRole("button", { name: digit }));
    }

    const longSize = screen.getByTestId("value").style.fontSize;
    expect(longSize).not.toBe(shortSize);
  });

  it("shows a calculation optimistically in the shared history list before the backend confirms it", async () => {
    let resolveCalculate!: (body: unknown) => void;
    const calculateResponse = new Promise((resolve) => {
      resolveCalculate = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/v1/history")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) });
      }
      return calculateResponse.then((body) => ({ ok: true, status: 200, json: async () => body }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    await renderCalculatorWithHistory();

    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() => expect(screen.getByTestId("history-list")).toHaveTextContent("2 + 3"));

    resolveCalculate({
      result: "5",
      history: { id: "real-id", operations: "2 + 3", result: "5", createdAt: "2026-01-01T00:00:00Z" },
    });

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("5"));
    expect(screen.getByTestId("history-list")).toHaveTextContent("2 + 3");
  });

  it("removes the optimistic history entry if the calculation fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchRoutes({
        calculate: { status: 400, body: { error: "division by zero is not allowed" } },
        fallback: { status: 200, body: { items: [], nextCursor: null } },
      }),
    );

    const user = userEvent.setup();
    await renderCalculatorWithHistory();

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "÷" }));
    await user.click(screen.getByRole("button", { name: "0" }));
    await user.click(screen.getByRole("button", { name: "=" }));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("division by zero is not allowed"),
    );
    expect(screen.getByText("No calculations yet.")).toBeInTheDocument();
  });
});
