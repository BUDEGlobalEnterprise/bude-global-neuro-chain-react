import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Controls from '../src/components/Controls';

const noop = () => {};
const defaultProps = {
  animating: false,
  onResetView: noop,
  onToggleAnimation: noop,
  onExportData: noop,
  onToggleSettings: noop,
  onZoomIn: noop,
  onZoomOut: noop,
  canvasRef: { current: null },
  nodes: [],
  edges: [],
  clusters: {},
  camera: { x: 0, y: 0 },
  zoom: 1,
};

describe('Controls zoom buttons', () => {
  test('renders zoom in button', () => {
    render(<Controls {...defaultProps} />);
    expect(screen.getByTitle('Zoom In (+)')).toBeInTheDocument();
  });

  test('renders zoom out button', () => {
    render(<Controls {...defaultProps} />);
    expect(screen.getByTitle('Zoom Out (-)')).toBeInTheDocument();
  });

  test('calls onZoomIn when zoom in button is clicked', () => {
    const onZoomIn = vi.fn();
    render(<Controls {...defaultProps} onZoomIn={onZoomIn} />);
    fireEvent.click(screen.getByTitle('Zoom In (+)'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  test('calls onZoomOut when zoom out button is clicked', () => {
    const onZoomOut = vi.fn();
    render(<Controls {...defaultProps} onZoomOut={onZoomOut} />);
    fireEvent.click(screen.getByTitle('Zoom Out (-)'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });
});
