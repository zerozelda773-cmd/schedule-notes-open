# Local backup and Customer restoration

G3-BACKUP-01 is a public product defect in the local backup path. Customer Profile owns `customer-profile-v1-1-master-data`; Task owns its original stable references. The previous state-only export omitted that independent Customer store, and the previous import did not restore it.

The existing top-level state JSON remains compatible. New exports add:

```json
{"localPersistence":{"schemaVersion":1,"entries":{"customer-profile-v1-1-master-data":"{\"schemaVersion\":1,\"records\":[]}"}}}
```

`entries` contains exact raw strings for the existing `WorkDeskPersistence.keys` allowlist, excluding its primary `work-progress-desk-v1` key. It includes Customer master, Customer relationships/observations/local notes and other registered Customer stores, plus the independently persisted Activity editor drafts. The primary state still contains Tasks, Activity records, Sales/Fiscal records, Hospital overrides/identity settings and supported application settings. Browser credentials, unregistered local preferences and navigation history are not added to the backup contract.

Import validates the entire versioned extension before confirmation or mutation. After the existing replacement confirmation, independent entity stores restore before primary state references. The existing native snapshot commit is ACK-backed; Web restoration preserves the previous registered stores if a side-store write fails. Primary state uses its existing persistence path. The runtime then reloads through its normal initialization to hydrate stores, indexes, Hospital cache and UI; it does not reconcile against stale pre-import in-memory Customer data.

The restore preserves stable Customer IDs exactly, including distinct same-name Customers. It preserves inactive records, identity provenance, source timestamps, unknown record/envelope evidence, Hospital/Department relationships and product-scoped observations. Missing IDs remain missing and unresolved. Names never become authority, Tasks are not deleted to hide missing entities, and R observations are not copied between products or promoted to approved field authority. The Customer storage implementation and identity rules are unchanged.

New-format import is replacement, not a merge. Registered side-store keys absent from the snapshot are removed. Reimporting the same snapshot does not append duplicate Customers or Tasks. Unknown versions, unsupported keys, duplicated primary state, invalid JSON or malformed Customer master structure are rejected.

Legacy state-only backups retain the existing import behavior and do not rewrite side stores they never declared. This compatibility has an unavoidable limitation: missing Customer bytes cannot be recovered from an old file. Restoration must not fabricate a Customer from Task display text. The compatibility classification is **PASS_WITH_DECLARED_LIMITATION**. Both historical array-shaped Customer storage and records envelopes remain supported without raw evidence loss.

Validation uses synthetic data only: old public main fails the manual-Customer/Task round-trip; the candidate passes exact Customer restoration, Task context resolution, same-name isolation, inactive/Hospital/scoped-observation preservation, fresh storage, repeated import, two reloads and an actual browser process restart. Nearby Activity formal records, unsaved drafts, Hospital state, Fiscal zero/null values and supported settings are checked separately. Native commit ordering is covered by a bridge harness; this does not claim Android device or OEM parity.

This is a non-canonical public product fix, not a release. It requires Customer storage contract review and governance merge review. No merge, production signing, deployment or canonical cutover is authorized by these tests.
