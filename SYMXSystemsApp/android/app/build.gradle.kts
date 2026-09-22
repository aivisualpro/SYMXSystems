import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services") apply false
}

// Only actually apply the Google Services plugin once google-services.json
// exists — applying it without the file present fails the build outright,
// and this file doesn't exist until Rohan downloads it from the Firebase
// console and drops it in (see android/app/google-services.json.example
// for where it goes). Everything else in the app builds fine without it;
// only push notifications won't work until it's added.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// ── Release signing ──
// Reads from android/key.properties, which is gitignored and never
// committed — the actual keystore file and its passwords live only on
// whichever machine builds the release, generated once and kept safe
// forever after (losing it means losing the ability to ever publish an
// update to this app under its existing Play Store listing). See
// android/key.properties.example for the file this expects.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.symxsystems.symx_systems_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.symxsystems.symx_systems_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Real release signing once android/key.properties exists (see
            // android/key.properties.example) — falls back to the debug key
            // so `flutter run --release` still works before that's set up.
            // A debug-signed build cannot be uploaded to Play Console, so
            // this fallback is for local testing only, not for publishing.
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}
