(function () {
  'use strict';
  // A native cursor stays visible over dialogs and form fields.
  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.remove('kursor-vklyuchen');
    document.querySelectorAll('[data-component="kursor"]').forEach(function (node) { node.remove(); });
  });
})();
