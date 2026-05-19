import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Terjadi kesalahan</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message || 'Komponen mengalami error yang tidak terduga.'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={this.handleReset}
            >
              Coba Lagi
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.location.href = '/'}
            >
              Ke Beranda
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
