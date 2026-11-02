import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <p className="kicker">Rozana</p>
          <h1>Something broke on this page.</h1>
          <p>Your entries are still saved in this browser.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );
}
