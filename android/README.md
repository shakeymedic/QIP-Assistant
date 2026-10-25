# QIP Assist for Android

The Android app opens the live site (https://wmebemqipassist.netlify.app) as a Trusted Web Activity: it runs in
the phone's Chrome engine, full screen, with its own icon. The site does all the work, so site changes reach the
app straight away and the app only needs a new release for changes in this folder.

A Trusted Web Activity rather than a WebView, because Google sign-in does not work inside a WebView. If the
phone has no browser that supports Trusted Web Activities, the app opens the site in a Chrome Custom Tab.

## Get a test APK

GitHub, **Actions**, **Android app**, the latest run, then the **qip-assist-android** artifact. Unzip it and
install `app-debug.apk`. A test install shows a thin address bar at the top until the site's
`/.well-known/assetlinks.json` lists the app's signing key (see step 5).

## Build locally

You need the Android SDK (platform 36) and JDK 17 or later.

```
cd android
echo "sdk.dir=/path/to/android-sdk" > local.properties
./gradlew assembleDebug bundleRelease
```

## Publishing on Google Play (Jake to do)

1. **Account.** Google Play requires health apps to come from an **organisation** account. Publish from the
   EM Evidence account once it has been converted.
2. **Repository secrets** (GitHub, Settings, Secrets and variables, Actions), with the same EM Evidence upload
   key as the other apps: `QIP_KEYSTORE_BASE64` (the output of `base64 -w0 em-evidence-upload.jks`),
   `QIP_KEYSTORE_PASSWORD`, `QIP_KEY_ALIAS` (`upload`), `QIP_KEY_PASSWORD`.
3. **Build.** Run the **Android app** action; the artifact holds the signed `app-release.aab`.
4. **Create the app in Play Console** and upload the bundle with Play App Signing (the default). Release to
   **Internal testing** first and check: Google and email sign-in, creating and editing a project, the
   supervisor and QIP lead views, an export, and the Privacy notice / Delete your account links (Settings and
   the sign-in screen).
5. **Remove the address bar.** In Play Console, App integrity, App signing, copy the **app signing key SHA-256**
   into `sha256_cert_fingerprints` in `/.well-known/assetlinks.json` and deploy the site. For sideloaded builds
   signed with the upload key, add the upload key's SHA-256 too
   (`keytool -list -v -keystore em-evidence-upload.jks`).
6. **Each new release:** raise `qipVersionCode` and `qipVersionName` in `gradle.properties`.

Package name: `org.emevidence.qipassist`. Once published on Play it cannot change.

## Play Console answers

Prepared from what the site does (checked 25 October 2026). Jake must confirm them before submitting, because
the developer is responsible for their accuracy. The app is a Trusted Web Activity, so what the site collects
counts as the app's collection.

- **Privacy policy:** https://wmebemqipassist.netlify.app/privacy.html
- **Account deletion URL:** https://wmebemqipassist.netlify.app/delete-account.html (deletion by email). In-app
  route: Settings, Privacy and your account, Delete your account.
- **Data safety** (check against the privacy notice before submitting):
  - **Personal info:** email address, name, user IDs. Account management, app functionality.
  - **Other user-generated content:** QIP projects (aims, data, PDSA cycles, team and stakeholder names and
    emails, feedback summaries, sign-offs). App functionality.
  - **App activity:** audit records of role changes and of supervisors/QIP leads opening a project. App
    functionality, security.
  - **Shared:** none. Firebase and Netlify are service providers. Optional AI features send text from the
    device to Google under the user's own API key, not to us.
  - Encrypted in transit: yes. Users can request deletion: yes.
- **App access:** "All or some functionality is restricted". Give Google a reviewer account (email and password)
  with instructions; demo mode on the sign-in screen also shows every feature without an account.
- **Ads:** none. **Target audience:** 18 and over.
- **Health apps declaration:** Medical: education and training for clinicians (quality improvement portfolio).
  Not a medical device. No patient-identifiable data should be entered (the privacy notice says so).
- **In-app products:** none. **Target API level:** 36. **16 KB page size:** not affected, no native code.
- **Play Integrity API:** not usable: the site, not the app, talks to Firebase, and a Trusted Web Activity's
  page can't call the Integrity API. The matching control is Firebase App Check for web, not set up yet.
