(function () {
  'use strict';

  var STORAGE_KEY = 'eco-theme';
  var root = document.documentElement;

  function getPreferredTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    var dark = theme === 'dark';
    root.classList.toggle('dark', dark);
    root.dataset.theme = dark ? 'dark' : 'light';
    if (persist) localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');

    var lightButton = document.getElementById('temaSvetlaya');
    var darkButton = document.getElementById('temaTemnaya');
    if (lightButton && darkButton) {
      lightButton.classList.toggle('aktivna', !dark);
      darkButton.classList.toggle('aktivna', dark);
      lightButton.setAttribute('aria-pressed', String(!dark));
      darkButton.setAttribute('aria-pressed', String(dark));
    }
  }

  applyTheme(getPreferredTheme(), false);

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(root.classList.contains('dark') ? 'dark' : 'light', false);
    document.getElementById('temaSvetlaya')?.addEventListener('click', function () { applyTheme('light', true); });
    document.getElementById('temaTemnaya')?.addEventListener('click', function () { applyTheme('dark', true); });
  });

  window.EcoTheme = { applyTheme: applyTheme };
})();