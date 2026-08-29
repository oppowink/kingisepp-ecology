// Заглушка: Яндекс ID подключим после Client ID / Redirect URI
module.exports = async function handler(req, res) {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '') || '';
  const target = appUrl
    ? appUrl + '/account.html?auth=yandex_not_configured'
    : '/account.html?auth=yandex_not_configured';
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.end();
};
