import { fireEvent, render, screen } from '@testing-library/react';
import { PreferencesProvider } from '../../context/PreferencesContext';
import PreferencesControls from './PreferencesControls';

describe('PreferencesControls', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('changes and persists the selected language', () => {
    render(
      <PreferencesProvider>
        <PreferencesControls />
      </PreferencesProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ngôn ngữ' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '中文' }));

    expect(screen.getByText('中文')).toBeTruthy();
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(localStorage.getItem('thebob-locale')).toBe('zh');
  });
});
