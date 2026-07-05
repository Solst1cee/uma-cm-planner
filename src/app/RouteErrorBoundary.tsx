/**
 * Error boundary around the lazy routes: a failed dynamic import (stale chunk
 * after a deploy, dropped connection) otherwise unmounts to a silent white
 * page. Shows a reload prompt instead.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="route-loading" role="alert">
        This page failed to load — it may have been updated since the app was
        opened.{' '}
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
