import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;

import 'app.dart';
import 'core/notifications/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Use clean URLs on web (no # prefix).
  usePathUrlStrategy();

  // Initialize timezone database for proper date resolution.
  tzdata.initializeTimeZones();

  // Push notifications (Netradyne safety alerts). Registering the device
  // token itself happens after login (see login_screen.dart / home_shell),
  // once we know which employee this device belongs to — this just sets
  // up Firebase, the notification channel, and the message listeners.
  await PushService.instance.initialize();

  runApp(
    const ProviderScope(
      child: SymxSystemsApp(),
    ),
  );
}
