/// Global application constants.
///
/// Centralises magic strings and configuration values so they are
/// easy to change across the entire app.
library;

/// Base URL for all API calls to the SYMX Systems backend.
///
/// Defaults to the production Vercel deployment — required for a native
/// Android/iOS build, which has no "current page" to resolve a relative
/// URL against the way a browser does. An empty default here would make
/// every API call silently fail once the app is installed from Google
/// Play (a real bug this default replaces — it worked only for the
/// Flutter-web build served from the same origin as the API, and was
/// never actually exercised as an installed APK).
///
/// Override for local development:
///   flutter run --dart-define=API_BASE_URL=http://localhost:3000
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://symx-systems.vercel.app',
);

/// Human-readable application name used in titles and branding.
const String kAppName = 'SYMX Systems';

/// Key under which the JWT badge token is persisted in secure storage.
const String kBadgeTokenKey = 'badge_token';

/// Key under which the serialised employee JSON is persisted.
const String kEmployeeKey = 'employee';
