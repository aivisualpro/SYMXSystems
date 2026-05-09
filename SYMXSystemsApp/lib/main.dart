import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Use clean URLs on web (no # prefix).
  usePathUrlStrategy();

  runApp(
    const ProviderScope(
      child: SymxSystemsApp(),
    ),
  );
}
