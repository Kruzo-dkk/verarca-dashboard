"use client";

import { Component, type ReactNode } from "react";

interface Props {
  /** Human label shown in the fallback, e.g. "Revenue". */
  section?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Isolates a render error to one section so a single broken chart/section does
 * not blank the whole dashboard. Shows a calm fallback with a retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this.props.section ? ` · ${this.props.section}` : ""}]`, error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {this.props.section ? `${this.props.section} kunne ikke vises` : "Denne sektion kunne ikke vises"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Resten af dashboardet fungerer stadig.
          </p>
          <button
            onClick={this.reset}
            className="mt-3 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors"
          >
            Prøv igen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
