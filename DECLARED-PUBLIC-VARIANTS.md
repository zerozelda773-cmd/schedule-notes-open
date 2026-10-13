# Declared public variants

These differences are intentional and visible. They do not claim private production equivalence.

## OCR adapter/interface

- PUBLIC BEHAVIOR: Recognition unavailable; adapter retained, no OCR models/WASM/service
- PRIVATE/LOCAL RESPONSIBILITY: Users must supply a separately reviewed recognition implementation if required; none enabled by default
- USER IMPACT: No image-to-text recognition in this build
- TEST COVERAGE: Baseline browser offline/adapter checks; no OCR accuracy claim

## Private business forms

- PUBLIC BEHAVIOR: Independently generated generic DOCX/XLSX Activity tables
- PRIVATE/LOCAL RESPONSIBILITY: Organizations own custom form design and licensing outside this source
- USER IMPACT: Exports do not reproduce organization-specific layouts
- TEST COVERAGE: Office structure/document tests and Activity export browser checks

## Real-data adapters

- PUBLIC BEHAVIOR: Invented catalogues, examples and generic imports; no real mappings or pretrained business relationship graph
- PRIVATE/LOCAL RESPONSIBILITY: Users verify provenance, identity confirmation and consent for their own local imports
- USER IMPACT: Demo is synthetic; local inputs require confirmation, not name inference
- TEST COVERAGE: Synthetic, hospital universe, identity and focused product contracts

## Production signing

- PUBLIC BEHAVIOR: Unsigned publicValidation Android build
- PRIVATE/LOCAL RESPONSIBILITY: Any future installer requires separately authorized keys, signing and distribution review
- USER IMPACT: No production install/upgrade continuity claim
- TEST COVERAGE: 44 JVM tests and unsigned APK verification; no production signer

## Updater/deploy integration

- PUBLIC BEHAVIOR: No production updater/deployment bridge or default cloud endpoints
- PRIVATE/LOCAL RESPONSIBILITY: Future deployments need separate configuration, permission and security review
- USER IMPACT: Local development, no managed service or automatic update promise
- TEST COVERAGE: Static endpoint/secret checks and offline browser checks

## Local device-reality validation

- PUBLIC BEHAVIOR: Automated Chromium and JVM checks; durable-ACK and explicit recovery boundaries
- PRIVATE/LOCAL RESPONSIBILITY: Device owner validates OEM/SAF save, install/upgrade, quota and backup behavior on actual devices
- USER IMPACT: Automated PASS is not real-device durability or native filesystem compatibility proof
- TEST COVERAGE: 25 draft including real browser-process restart, 24 baseline, 24 Activity and 44 Java; OEM/device gate NOT_RUN
