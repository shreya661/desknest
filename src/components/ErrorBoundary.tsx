import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Clipboard } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Descriptive label used in the fallback UI (e.g. "Notes Workspace") */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

/**
 * React class-based Error Boundary.
 * Catches render errors in any child subtree and renders a safe fallback
 * that uses DeskNest CSS variables for theming and exposes recovery helpers.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
  };

  handleCopy = () => {
    const { error } = this.state;
    const label = this.props.label ?? "unknown";
    const text = [
      `DeskNest Error Report — ${new Date().toISOString()}`,
      `Location: ${label}`,
      `Error: ${error?.name ?? "Unknown"}: ${error?.message ?? ""}`,
      `Stack:\n${error?.stack ?? "(no stack available)"}`,
    ].join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, copied } = this.state;
    const label = this.props.label ?? "Workspace";

    return (
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.75rem",
          color: "var(--color-foreground)",
          padding: "2rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          minHeight: "12rem",
          maxWidth: "36rem",
          margin: "auto",
          textAlign: "center",
        }}
      >
        {/* Warning Icon */}
        <div
          style={{
            width: "3rem",
            height: "3rem",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle
            style={{ width: "1.5rem", height: "1.5rem", color: "#ef4444" }}
          />
        </div>

        {/* Title */}
        <div>
          <p
            style={{
              fontWeight: 600,
              fontSize: "0.9375rem",
              marginBottom: "0.25rem",
              color: "var(--color-foreground)",
            }}
          >
            {label} encountered an error
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted-fg)",
              lineHeight: 1.5,
            }}
          >
            A render error occurred in this section. Your data is safe — DeskNest auto-saves
            to IndexedDB continuously.
          </p>
        </div>

        {/* Error detail */}
        {error && (
          <pre
            style={{
              fontSize: "0.6875rem",
              backgroundColor: "rgba(0,0,0,0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
              textAlign: "left",
              overflowX: "auto",
              maxWidth: "100%",
              color: "var(--color-muted-fg)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.name}: {error.message}
          </pre>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-foreground)",
              transition: "opacity 0.15s",
            }}
            title="Copy error info to clipboard"
          >
            <Clipboard style={{ width: "0.875rem", height: "0.875rem" }} />
            {copied ? "Copied!" : "Copy Recovery Info"}
          </button>

          <button
            onClick={this.handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-fg)",
              transition: "opacity 0.15s",
            }}
            title="Attempt to reload this workspace"
          >
            <RefreshCcw style={{ width: "0.875rem", height: "0.875rem" }} />
            Reload Workspace
          </button>
        </div>

        <p style={{ fontSize: "0.6875rem", color: "var(--color-muted-fg)", marginTop: "0.25rem" }}>
          If this persists, restart DeskNest. Your notes and drawings are stored locally.
        </p>
      </div>
    );
  }
}
