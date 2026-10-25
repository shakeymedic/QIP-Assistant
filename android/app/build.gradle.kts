// QIP Assist for Android: a Trusted Web Activity that opens https://wmebemqipassist.netlify.app in the phone's Chrome (or
// another browser that supports TWAs), full screen, with no browser bar once the site's
// /.well-known/assetlinks.json lists this app's signing key (see android/README.md). The site does all the
// work, so the app only needs a new release for changes to this folder.
plugins { id("com.android.application") }

android {
    namespace = "org.emevidence.qipassist"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.emevidence.qipassist"
        minSdk = 24
        targetSdk = 36
        versionCode = (findProperty("qipVersionCode") as String).toInt()
        versionName = findProperty("qipVersionName") as String
        manifestPlaceholders["hostName"] = "wmebemqipassist.netlify.app"
        manifestPlaceholders["defaultUrl"] = "https://wmebemqipassist.netlify.app/"
    }

    signingConfigs {
        // Release signing comes from environment variables (GitHub Actions secrets), never from the repository.
        create("release") {
            val ks = System.getenv("QIP_KEYSTORE_FILE")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("QIP_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("QIP_KEY_ALIAS")
                keyPassword = System.getenv("QIP_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (System.getenv("QIP_KEYSTORE_FILE") != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.0") // 2.7.4 builds would not open on a Samsung S25+ (Oct 2026); 2.6.0, as in the major incident app, does
}
