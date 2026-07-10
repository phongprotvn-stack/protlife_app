import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('ERROR BOUNDARY CAUGHT:', error.message, error.stack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 14 }}>
          <h2 style={{ color: '#E6002D' }}>Lỗi ứng dụng</h2>
          <details>
            <summary>{this.state.error.message}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8 }}>
              {this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
