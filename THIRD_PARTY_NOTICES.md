# Third-Party Notices

This project is licensed under the MIT License. The following third-party
components are referenced by the app or development tooling and remain under
their own licenses.

## Runtime

- TensorFlow.js (`@tensorflow/tfjs@4.22.0`)
  - Source: https://github.com/tensorflow/tfjs
  - License: Apache License 2.0
  - Usage: loaded from jsDelivr at runtime for browser inference.

- CREPE model assets from `ml5js/ml5-data-and-models`
  - Source: https://github.com/ml5js/ml5-data-and-models
  - License: MIT License
  - Usage: loaded from jsDelivr at runtime as the pitch-detection model.

- CREPE pitch estimation project
  - Source: https://github.com/marl/crepe
  - License: MIT License
  - Usage: model architecture/specification reference.

- EffeTune DSP (`@effetune/dsp@0.9.0`)
  - Source: https://github.com/Frieve-A/effetune/tree/main/dsp
  - Package: https://registry.npmjs.org/@effetune/dsp/-/dsp-0.9.0.tgz
  - License: MIT License
  - Usage: vendored under `vendor/effetune` for Multi F0 analysis, including the JavaScript runtime and baseline/SIMD WASM artifacts.
  - Published tarball SHA-512 (base64): `f5nM0/oFk1FRCbeTfDt5twzFKbdC77Xu7C/sol+Yq9joINvirSPpQdAH2QVmYTbFxizGU+p6jZ2SEdohxfxm/g==`
  - The package's license, `THIRD_PARTY_NOTICES.txt`, and `dist/assets/NOTICE.txt` are retained with the vendored runtime.

## Development Tooling

- Playwright
  - Source: https://github.com/microsoft/playwright
  - License: Apache License 2.0
  - Usage: optional browser verification script under `tools/`.

When bundling, vendoring, or redistributing any third-party component instead
of loading it remotely, include that component's license text and required
notices with the distributed artifact.
