// Development: the Angular dev server proxies /api and /socket.io to the API (see proxy.conf.json),
// so the client and API share an origin and cookies work without cross-site settings.
export const environment = {
  production: false,
  apiUrl: '/api',
  socketUrl: '',
};
