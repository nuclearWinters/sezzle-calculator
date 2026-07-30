import { Component, cloneElement, type ErrorInfo, type ReactElement } from "react";
import * as stylex from "@stylexjs/stylex";

const colors = {
  errorBg: "rgb(252, 232, 230)",
  errorText: "rgb(197, 34, 31)",
  retryBg: "rgb(66, 133, 244)",
};

const styles = stylex.create({
  box: {
    boxSizing: "border-box",
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: colors.errorBg,
    color: colors.errorText,
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
  message: {
    margin: 0,
    fontSize: "0.9rem",
  },
  retryButton: {
    appearance: "none",
    border: "none",
    borderRadius: "100px",
    padding: "8px 16px",
    backgroundColor: colors.retryBg,
    color: "#ffffff",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  },
});

interface Props {
  // A single element, not arbitrary ReactNode — retrying clones it with a
  // new `key` to force React to fully unmount + remount it (re-running its
  // state initializers, effects, and any in-flight requests) rather than
  // just re-rendering the same instance.
  children: ReactElement;
  // Shown in the fallback message and console log, e.g. "History".
  label: string;
}

interface State {
  error: Error | null;
  resetKey: number;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary (${this.props.label}) caught an error:`, error, info);
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div {...stylex.props(styles.box)} role="alert" data-testid="error-boundary-fallback">
          <p {...stylex.props(styles.message)}>
            {this.props.label} crashed: {error.message}
          </p>
          <button type="button" onClick={this.handleRetry} {...stylex.props(styles.retryButton)}>
            Try again
          </button>
        </div>
      );
    }

    return cloneElement(this.props.children, { key: this.state.resetKey });
  }
}
