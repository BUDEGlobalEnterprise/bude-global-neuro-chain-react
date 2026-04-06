import { render, screen } from '@testing-library/react';
import React from 'react';
import Tooltip from '../src/components/Tooltip';

const clusters = { energy: { label: 'Energy', color: '#f59e0b' } };
const edges = [
  { source: 'fire', target: 'wheel' },
  { source: 'fire', target: 'steam' },
];

const node = { id: 'fire', label: 'Fire', cluster: 'energy' };
const mousePos = { x: 100, y: 200 };

describe('Tooltip', () => {
  test('renders nothing when no node is hovered', () => {
    const { container } = render(
      <Tooltip hoveredNode={null} mousePos={mousePos} clusters={clusters} edges={edges} descriptions={{}} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('appears with node label when a node is hovered', () => {
    render(
      <Tooltip hoveredNode={node} mousePos={mousePos} clusters={clusters} edges={edges} descriptions={{}} />
    );
    expect(screen.getByText('Fire')).toBeInTheDocument();
  });

  test('shows correct connection count', () => {
    render(
      <Tooltip hoveredNode={node} mousePos={mousePos} clusters={clusters} edges={edges} descriptions={{}} />
    );
    expect(screen.getByText(/2 connections/)).toBeInTheDocument();
  });

  test('shows cluster label', () => {
    render(
      <Tooltip hoveredNode={node} mousePos={mousePos} clusters={clusters} edges={edges} descriptions={{}} />
    );
    expect(screen.getByText(/Energy/)).toBeInTheDocument();
  });

  test('positions tooltip at mouse coordinates', () => {
    const { container } = render(
      <Tooltip hoveredNode={node} mousePos={{ x: 50, y: 75 }} clusters={clusters} edges={edges} descriptions={{}} />
    );
    const tooltip = container.firstChild;
    expect(tooltip.style.left).toBe('62px');
    expect(tooltip.style.top).toBe('87px');
  });
});
