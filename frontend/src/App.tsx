import * as stylex from "@stylexjs/stylex";
import Calculator from "./components/Calculator/Calculator";
import History from "./components/History/History";
import HistoryProvider from "./components/History/HistoryContext";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";

const styles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
});

function App() {
  return (
    <div {...stylex.props(styles.stack)}>
      <HistoryProvider>
        <ErrorBoundary label="Calculator">
          <Calculator />
        </ErrorBoundary>
        <ErrorBoundary label="History">
          <History />
        </ErrorBoundary>
      </HistoryProvider>
    </div>
  );
}

export default App;
