# Third-Party Notices

This project is licensed under the MIT License. The following third-party
components are referenced by the app or development tooling and remain under
their own licenses.

## Runtime

- EffeTune DSP (`@effetune/dsp@0.10.0`)
  - Source: https://github.com/Frieve-A/effetune/tree/main/dsp
  - Package: https://registry.npmjs.org/@effetune/dsp/-/dsp-0.10.0.tgz
  - License: MIT License
  - Usage: vendored under `vendor/effetune` for monophonic Pitch Meter and Multi F0 analysis, including the JavaScript runtime and baseline/SIMD WASM artifacts.
  - Published tarball SHA-512 (base64): `QllpGfObhZlm1WKmhPU9dNeb45rqssPmyFBQGbGZE+GmFJvDPTM9KFfeCJB36WS8WAz/Fpty0Lk2XoCkbxaf+w==`
  - The package's license, `THIRD_PARTY_NOTICES.txt`, and `dist/assets/NOTICE.txt` are retained with the vendored runtime.

## Development Tooling

- Playwright
  - Source: https://github.com/microsoft/playwright
  - License: Apache License 2.0
  - Usage: optional browser verification script under `tools/`.

When bundling, vendoring, or redistributing any third-party component instead
of loading it remotely, include that component's license text and required
notices with the distributed artifact.
