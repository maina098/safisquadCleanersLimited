import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (window.Sentry) window.Sentry.captureException(error, { extra: info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h1>Something went wrong</h1>
          <p>We've been notified. Please refresh or contact support.</p>
          <button type="button" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )
    }
    return this.props.children
  }
}