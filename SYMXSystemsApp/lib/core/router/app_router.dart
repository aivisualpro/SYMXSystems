import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/coming_soon/presentation/coming_soon_screen.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/inspections/presentation/inspections_screen.dart';
import '../../features/notices/presentation/notices_screen.dart';

/// Custom fade + scale page transition used across all routes.
CustomTransitionPage<void> _fadeScalePage({
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 220),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.98, end: 1.0).animate(curved),
          child: child,
        ),
      );
    },
  );
}

// ─── Router Provider ───────────────────────────────────────────────
/// Exposes the [GoRouter] instance via Riverpod so it can be accessed
/// from [MaterialApp.router] and anywhere navigation is needed.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: true,
    routes: [
      // ── Splash ──
      GoRoute(
        path: '/',
        pageBuilder: (context, state) => _fadeScalePage(
          state: state,
          child: const SplashScreen(),
        ),
      ),

      // ── Login ──
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => _fadeScalePage(
          state: state,
          child: const LoginScreen(),
        ),
      ),

      // ── Home Shell (bottom-nav tabs) ──
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return HomeShell(navigationShell: navigationShell);
        },
        branches: [
          // Tab 0 — Daily Inspections
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/inspections',
                pageBuilder: (context, state) => _fadeScalePage(
                  state: state,
                  child: const InspectionsScreen(),
                ),
              ),
            ],
          ),

          // Tab 1 — Notices
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notices',
                pageBuilder: (context, state) => _fadeScalePage(
                  state: state,
                  child: const NoticesScreen(),
                ),
              ),
            ],
          ),

          // Tab 2 — Coming Soon
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/coming-soon',
                pageBuilder: (context, state) => _fadeScalePage(
                  state: state,
                  child: const ComingSoonScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
    ],

    // Redirect `/home` → `/inspections` (first tab).
    redirect: (context, state) {
      if (state.matchedLocation == '/home') {
        return '/inspections';
      }
      return null;
    },
  );
});
