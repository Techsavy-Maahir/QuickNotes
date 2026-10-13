import { render, screen } from '@testing-library/react';
import App from './App';

test('renders QuickNotes application brand without crashing', () => {
  render(<App />);
  const brandElements = screen.getAllByText(/Secure Notes|QuickNotes/i);
  expect(brandElements.length).toBeGreaterThan(0);
});
