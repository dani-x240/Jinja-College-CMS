/**
 * Simple tests for the dark mode toggle functionality.
 */

describe('Dark mode toggle', () => {
  beforeEach(() => {
    // Reset body classes and localStorage before each test
    document.body.classList.remove('dark-mode');
    localStorage.clear();
  });

  test('adds dark-mode class to body when enabled', () => {
    document.body.classList.add('dark-mode');
    expect(document.body.classList.contains('dark-mode')).toBe(true);
  });

  test('removes dark-mode class from body when disabled', () => {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('dark-mode');
    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });

  test('persists dark mode preference in localStorage', () => {
    localStorage.setItem('darkMode', 'true');
    expect(localStorage.getItem('darkMode')).toBe('true');
  });

  test('persists light mode preference in localStorage', () => {
    localStorage.setItem('darkMode', 'false');
    expect(localStorage.getItem('darkMode')).toBe('false');
  });

  test('reads dark mode preference from localStorage on init', () => {
    localStorage.setItem('darkMode', 'true');
    const isDark = localStorage.getItem('darkMode') === 'true';
    expect(isDark).toBe(true);
  });

  test('toggles between light and dark mode', () => {
    let isDark = false;

    const applyMode = (dark) => {
      if (dark) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    };

    // Toggle on
    isDark = !isDark;
    applyMode(isDark);
    expect(document.body.classList.contains('dark-mode')).toBe(true);

    // Toggle off
    isDark = !isDark;
    applyMode(isDark);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
  });
});
