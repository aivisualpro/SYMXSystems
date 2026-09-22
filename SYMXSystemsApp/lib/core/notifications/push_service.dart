import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Android notification channel every safety-alert push renders into.
/// Also referenced by name in AndroidManifest.xml
/// (com.google.firebase.messaging.default_notification_channel_id) so
/// Play services uses the same channel/importance when it shows the
/// notification itself (app backgrounded/killed) as when our own code
/// shows it (app foregrounded).
const _channelId = 'safety_alerts';
const _channelName = 'Safety Alerts';
const _channelDescription =
    'Near-real-time safety event alerts from the fleet safety camera system';

/// Background/terminated-state FCM handler.
///
/// Must be a top-level (or static) function — firebase_messaging runs it
/// in a fresh, separate Dart isolate with no access to any state from the
/// running app, which is why Firebase gets re-initialized here even
/// though it's already initialized in main().
///
/// The heads-up notification (sound + vibration, shown below) is the part
/// that's guaranteed to get the driver's attention while the app is
/// backgrounded or fully killed. The spoken TTS alert is best-effort in
/// this state — some devices/OEMs suspend a headless background isolate
/// before speech synthesis finishes, so this is a bonus when the OS
/// allows it, not a guarantee. Opening the notification (handled in
/// [PushService.initialize] via onMessageOpenedApp / getInitialMessage)
/// always speaks it once the app is actually in the foreground.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await _showLocalNotification(message);
  await _speakAlert(message.data);
}

Future<void> _showLocalNotification(RemoteMessage message) async {
  final notification = message.notification;
  if (notification == null) return;

  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
  );

  await plugin.show(
    notification.hashCode,
    notification.title,
    notification.body,
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
      ),
    ),
  );
}

Future<void> _speakAlert(Map<String, dynamic> data) async {
  if (data['type'] != 'safety_alert') return;

  final typeDescription = (data['typeDescription'] ?? 'Safety event').toString();
  final subType = (data['subTypeDescription'] ?? '').toString();
  final severity = (data['severityDescription'] ?? '').toString();

  final phrase = subType.isNotEmpty
      ? 'Safety alert. $severity. $typeDescription, $subType.'
      : 'Safety alert. $severity. $typeDescription.';

  try {
    final tts = FlutterTts();
    await tts.setSpeechRate(0.45);
    await tts.setVolume(1.0);
    await tts.awaitSpeakCompletion(true);
    await tts.speak(phrase);
  } catch (e) {
    debugPrint('[PushService] TTS failed: $e');
  }
}

/// Push notification setup: Firebase init, the Android notification
/// channel, foreground message handling (local notification + spoken
/// TTS), and device-token registration with the backend.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _initialized = false;

  /// Call once at app startup, before runApp(). Safe to call more than
  /// once — only does real work the first time.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    await Firebase.initializeApp();

    final localNotifications = FlutterLocalNotificationsPlugin();
    await localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: _channelDescription,
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        ));

    // Android 13+ requires this at runtime or notifications are silently
    // suppressed even with the manifest permission declared.
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // App is open and visible right now — show + speak immediately.
    FirebaseMessaging.onMessage.listen((message) async {
      await _showLocalNotification(message);
      await _speakAlert(message.data);
    });

    // Notification tapped while app was backgrounded.
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _speakAlert(message.data);
    });

    // App was fully killed and got launched BY tapping the notification.
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _speakAlert(initialMessage.data);
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }

  /// POSTs the current FCM token to the backend so alerts can reach this
  /// device. Call right after a successful login.
  Future<void> registerToken(Dio dio) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await dio.post('/api/mobile/device-token', data: {'fcmToken': token});
    } catch (e) {
      // Never let a push-registration failure block login or app startup —
      // worst case, this device just doesn't get safety-alert pushes until
      // the next successful registration attempt.
      debugPrint('[PushService] Failed to register device token: $e');
    }
  }

  /// Re-registers automatically whenever FCM rotates the token (happens
  /// occasionally — app reinstall, token expiry, etc.). Call once, after
  /// the user is authenticated.
  void listenForTokenRefresh(Dio dio) {
    FirebaseMessaging.instance.onTokenRefresh.listen((_) => registerToken(dio));
  }
}
