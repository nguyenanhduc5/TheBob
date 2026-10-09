import { useEffect, useRef, useState } from 'react';
import { Icons } from '../icons';
import { usePreferences } from '../../context/PreferencesContext';

const ChevronDownIcon = Icons.chevronDown;

function LocaleFlag({ code }) {
  if (code === 'vi') {
    return (
      <svg className="preference-language-flag" viewBox="0 0 24 16" aria-hidden="true">
        <rect width="24" height="16" fill="#da251d" />
        <path d="M12 3.1l1.12 3.45h3.63l-2.94 2.13 1.12 3.45L12 10l-2.93 2.13 1.12-3.45-2.94-2.13h3.63z" fill="#ff0" />
      </svg>
    );
  }

  if (code === 'zh') {
    return (
      <svg className="preference-language-flag" viewBox="0 0 24 16" aria-hidden="true">
        <rect width="24" height="16" fill="#ee1c25" />
        <path d="M5 2l.67 2.05h2.16L6.08 5.32l.67 2.05L5 6.1 3.25 7.37l.67-2.05-1.75-1.27h2.16z" fill="#ff0" />
        <circle cx="9" cy="2.5" r=".65" fill="#ff0" />
        <circle cx="10.5" cy="4.2" r=".65" fill="#ff0" />
        <circle cx="10.3" cy="6.5" r=".65" fill="#ff0" />
        <circle cx="8.6" cy="8" r=".65" fill="#ff0" />
      </svg>
    );
  }

  return (
    <svg className="preference-language-flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.8" />
    </svg>
  );
}

const localeOptions = [
  {
    code: 'vi',
    shortLabel: 'VI',
    label: 'Tiếng Việt',
  },
  {
    code: 'zh',
    shortLabel: '中文',
    label: '中文',
  },
  {
    code: 'en',
    shortLabel: 'EN',
    label: 'English',
  },
];

export default function PreferencesControls() {
  const { locale, setLocale, t } = usePreferences();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);
  const activeLocale = localeOptions.find((option) => option.code === locale) || localeOptions[0];

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [languageMenuOpen]);

  return (
    <div className="preference-controls">
      <div className="preference-language" ref={languageMenuRef}>
        <button
          type="button"
          className="preference-button preference-language-button"
          aria-label={t('preferences.language')}
          aria-haspopup="true"
          aria-expanded={languageMenuOpen}
          aria-controls="preference-language-menu"
          onClick={() => setLanguageMenuOpen((open) => !open)}
        >
          <LocaleFlag code={activeLocale.code} />
          <span className="preference-language-label">{activeLocale.shortLabel}</span>
          <ChevronDownIcon size={14} />
        </button>
        {languageMenuOpen && (
          <div
            id="preference-language-menu"
            className="preference-language-menu"
            role="menu"
            aria-label={t('preferences.language')}
          >
            {localeOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === option.code}
                className={`preference-language-option${locale === option.code ? ' active' : ''}`}
                onClick={() => {
                  setLocale(option.code);
                  setLanguageMenuOpen(false);
                }}
              >
                <LocaleFlag code={option.code} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
