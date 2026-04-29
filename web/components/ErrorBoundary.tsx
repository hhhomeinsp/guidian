"use client";

import React from "react";

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <div className="max-w-lg rounded-xl border border-error/30 bg-error-bg p-6">
            <h2 className="font-display text-lg font-semibold text-error mb-2">Something went wrong</h2>
            <p className="font-mono text-xs text-slate break-all">{this.state.error.mesnova}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-lg bg-navy px-4 py-2 text-sm text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
