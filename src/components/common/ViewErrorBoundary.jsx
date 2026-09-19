import { Component } from 'react'
import { Sparkles } from 'lucide-react'

export default class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('DIY Travel view recovered from a render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <section className="page-section">
          <div className="card view-error-card">
            <Sparkles size={22} />
            <div className="view-error-copy">
              <strong>This section ran into a display problem.</strong>
              <span>Your trip data is still saved. You can retry this section or return to your trip list without losing your plan.</span>
              <div className="view-error-actions">
                <button type="button" className="primary-button" onClick={() => this.setState({ error: null })}>Try again</button>
                {this.props.onBack && <button type="button" className="ghost-button" onClick={this.props.onBack}>Back to trips</button>}
              </div>
            </div>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

