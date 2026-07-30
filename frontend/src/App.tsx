import * as stylex from "@stylexjs/stylex";
import Calculator from "./components/Calculator/Calculator";
import History from "./components/History/History";
import HistoryProvider from "./components/History/HistoryContext";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import { fetchHistory } from "./api/historyApi";
import { Suspense } from "react";
import HistoryLoading from "./components/History/HistoryLoading";

const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  historyPanel: {
    display: {
      default: "contents",
      "@media (max-width: 600px)": "none",
    },
  },
});

function App() {
  const historyPromise = fetchHistory(null, 20)
  return (
    <div {...stylex.props(styles.stack)}>
      <HistoryProvider historyPromise={historyPromise}>
        <div {...stylex.props(styles.historyPanel)}>
          <ErrorBoundary label="History">
            <Suspense fallback={<HistoryLoading />}>
              <History />
            </Suspense>
          </ErrorBoundary>
        </div>
        <ErrorBoundary label="Calculator">
          <Calculator />
        </ErrorBoundary>
      </HistoryProvider>
    </div>
  );
}

export default App;
