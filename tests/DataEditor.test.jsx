import { render, screen } from '@testing-library/react';
import React from 'react';
import DataEditor from '../src/components/DataEditor';

describe('DataEditor', () => {
  test('loads clusters JSON into editor on initial render', () => {
    const mockData = {
      clusters: [{ id: 1, name: 'Cluster A' }],
      nodes: [],
      edges: [],
      descriptions: {}
    };

    const onDataUpdate = vi.fn();

    render(<DataEditor data={mockData} onDataUpdate={onDataUpdate} />);

    const textarea = screen.getByRole('textbox');

    expect(textarea.value).toContain('"name": "Cluster A"');
  });
});
