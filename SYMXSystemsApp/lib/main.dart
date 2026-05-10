import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Use clean URLs on web (no # prefix).
  usePathUrlStrategy();

  // Initialize timezone database for proper date resolution.
  tzdata.initializeTimeZones();

  runApp(
    const ProviderScope(
      child: SymxSystemsApp(),
    ),
  );
}
