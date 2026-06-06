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

## Development Tooling

- Playwright
  - Source: https://github.com/microsoft/playwright
  - License: Apache License 2.0
  - Usage: optional browser verification script under `tools/`.

When bundling, vendoring, or redistributing any third-party component instead
of loading it remotely, include that component's license text and required
notices with the distributed artifact.
