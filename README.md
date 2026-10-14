# Schedule Notes / 日程速记

Schedule Notes is a local-first workspace for tasks, activities and structured data. This source tree provides a Web application and an Android development shell with invented demonstration data.

## Product structure

- **待办项 / Tasks**: track actions and progress; Task and Activity identities and completion states remain separate.
- **活动区 / Activities**: plan activities, recover editing drafts, save records and generate generic documents.
- **数据库 / Data**: maintain hospital and customer identities, import structured data, and inspect sales/reporting and fiscal-period facts.

## Local-first data

Demo hospitals, customers, personnel, products and business facts are synthetic. They are not anonymized real records. Real user data stays in the user's browser or local Android storage; no production cloud account or credential is supplied. Remote integrations are disabled in this configuration. Never submit real records, screenshots, logs containing personal data or credentials in issues or contributions.

Missing values remain unknown rather than zero. Name matches produce candidates rather than confirmed identities. Ambiguous customer identity remains unresolved until explicit confirmation. Keep external backups: browser storage can be cleared, quotas and I/O can fail, and automated tests cannot guarantee device durability.

## Web development

Requirements: Node.js 24+ and npm. Dependency installation downloads locked public packages, including SheetJS from its public distribution endpoint. Runtime demo use does not require a private repository or production service.

```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/generate-documents.cjs
npm run build
npm start
```

Open the loopback URL printed by the server. The server serves only audited build assets. Office templates and dependency bundles are generated from public inputs; historical vendor bundles are not needed.

## Tests and local checks

```sh
npm run ci:static
npm test
npm run ci:readiness
npx playwright install chromium
node scripts/browser-capabilities.cjs
node scripts/browser-equivalence.cjs
node scripts/browser-draft-recovery.cjs
```

The local reference suite covers 78 Web tests (including 20 identity tests), 24 baseline browser checks, 24 Activity checks and 25 editing-draft recovery checks. These counts describe the prepared tree; actual hosted CI must report its own results.

## Android development

Use JDK 17, Android SDK 35 and Gradle 8.9. Install public Android tooling separately; no SDK, signing key or prebuilt APK is shipped here. Run the Web build first, then:

```sh
node scripts/native-test-fixtures.cjs
node scripts/android-assets.cjs
gradle --no-daemon --console=plain -p android-app :app:assemblePublicValidation :app:testPublicValidationUnitTest
```

The publicValidation variant is unsigned and intended for development. The reference JVM suite has 44 tests. This is not a signed production installer or proof of installation, upgrade, OEM storage permissions or real-device document saving.

## Editing drafts and reliability

CREATE working copies have draft identity and no formal Activity ID. EDIT working copies reference an existing Activity. Restart offers explicit restore/discard choices. Business state is published after durable acknowledgment; failed saves retain the working copy. Cleanup failures reconcile without duplicate creates. Corrupt or unsupported draft versions report recovery unavailable rather than silently resetting data. Unacknowledged writes and old-client downgrade compatibility are not guaranteed.

## Public variants

OCR recognition is unavailable: an adapter remains, without models or a recognition service. Office exports use generic Activity tables. Real-data mappings, production signing, auto-updater and deployment integration are excluded. See [DECLARED-PUBLIC-VARIANTS.md](DECLARED-PUBLIC-VARIANTS.md) for behavior, responsibilities and coverage. Automated browser/JVM validation does not replace real-device validation. An unrelated historical browser failure remains unreproduced with unknown root cause.

## Public CI

The workflow runs safety and license/manifest checks, Web and product contracts, Chromium lifecycle/draft recovery, an equivalence declaration gate, and an unsigned Android build/JVM suite. All jobs use standard GitHub-hosted Ubuntu runners and need no private data or production secret. Successful jobs upload no artifacts. Hosted execution has not yet occurred for this prepared tree.

## Relationship to Schedule Notes Core

[schedule-notes-core](https://github.com/zerozelda773-cmd/schedule-notes-core) is an independent generic public core. This tree is a product application, not a replacement package or a promise to promote experimental Core APIs. It does not import private Git history or require that repository to build.

## License and contributions

First-party source is licensed under [Apache-2.0](LICENSE); see [NOTICE](NOTICE). Third-party components retain their own terms, supplied in [THIRD-PARTY-NOTICES-DRAFT.md](THIRD-PARTY-NOTICES-DRAFT.md) and third-party/. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before sharing changes or reports. This is the public source bootstrap; no signed release or npm publication is provided.

## Public product candidate

This non-canonical product candidate restores stable identity, scoped R observations, Hospital cache/navigation, Task source context, current-route restoration and Fiscal boundaries using synthetic data only. It is not a release. See [product contracts](docs/public-product-contracts.md) and [declared public variants](docs/public-product-variants.md). No merge, release, npm publication or canonical cutover is implied.
