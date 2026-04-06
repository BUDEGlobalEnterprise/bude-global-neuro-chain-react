import { render, screen } from '@testing-library/react';
import React from 'react';
import Footer from '../src/components/Footer';

describe('Footer', () => {
  test('contains the current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  test('shows Bude Global brand name', () => {
    render(<Footer />);
    expect(screen.getByText('Bude Global')).toBeInTheDocument();
  });
});
