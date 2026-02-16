import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white px-6 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">오류가 발생했습니다</h1>
        <p className="text-slate-400 mb-8">
          예기치 않은 문제가 발생했습니다. 새로고침하여 다시 시도해주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors cursor-pointer"
        >
          새로고침
        </button>
      </div>
    );
  }
}
