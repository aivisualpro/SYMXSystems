/// Global application constants.
///
/// Centralises magic strings and configuration values so they are
/// easy to change across the entire app.
library;

/// Base URL for all API calls to the SYMX Systems backend.
/// Empty string = relative URLs, so the app calls whatever host serves it
/// (works for both local dev at localhost:9568 and production on Vercel).
const String kApiBaseUrl = '';

/// Human-readable application name used in titles and branding.
const String kAppName = 'SYMX Systems';

/// Key under which the JWT badge token is persisted in secure storage.
const String kBadgeTokenKey = 'badge_token';

/// Key under which the serialised employee JSON is persisted.
const String kEmployeeKey = 'employee';
