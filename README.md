# Frieve F0 Estimator

(Japanese below)

A browser-only web app for real-time F0 display, pitch graphing, and compact tuner-style cent tracking.

## Current Status

- Default `Graph` mode shows a piano-roll pitch history for voice and monophonic instruments.
- `Tuner` mode is available from the `Mode` button. It centers the display on the detected note, shows a +/-50 cent window with 10-cent guide lines, draws raw detections as points, and overlays a smoothed average trace.
- The tuner center follows high-confidence detections. Before a usable detection is available, it defaults to A4.
- Pitch zoom, vertical pan, and the pitch scrollbar are disabled in `Tuner` mode because the vertical range is fixed to the current +/-50 cent view. Time zoom and horizontal navigation remain available.
- Inference starts at a 10 ms hop and adapts up to 250 ms when the device cannot keep up. The status bar reports `max res`, `adapting`, `catch-up`, `limited`, or `stable`.
- Rendering uses an OffscreenCanvas Web Worker when supported, with a main-thread canvas fallback.
- The app includes a web manifest and service worker for installable/offline app-shell behavior.

## Features

- Estimates monophonic F0 from microphone input
- Resamples input audio to 16 kHz
- Runs inference with a PitchCREPE-compatible CREPE model
- Displays a piano-roll canvas with automatic current-time follow while estimating
- Switches between `Graph` and `Tuner` display modes
- Supports Pause / Resume and Clear
- Supports vertical and horizontal zoom, vertical and horizontal pan, and confidence threshold adjustment in `Graph` mode
- Supports tuner-style cent tracking with smoothed average trace in `Tuner` mode
- Shows hover hints
- Exports CSV data

## Running

Serve the whole directory from an HTTPS URL or localhost, then open `index.html`. Microphone input and service worker registration require a secure context.

For a quick local check:

```sh
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Inference

In the browser, the app loads the CREPE model with TensorFlow.js. Following the PitchCREPE specification, inference input is 16 kHz and output values `time_sec`, `f0_hz`, and `confidence` are converted to MIDI values. The app begins at a 10 ms hop and can adapt the hop up to 250 ms under load. If model loading fails, the app starts with a YIN fallback so the UI can still be checked.

## CSV

`Export CSV` outputs the following columns.

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` is determined by the current confidence threshold and the C1-C7 hard range.

## Verification

The repository currently includes lightweight checks for browser UI behavior and Tuner mode logic.

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-browser.mjs` requires Playwright to be available in the local Node environment. Set `VERIFY_MIC=1` to include a fake-microphone startup check.

## License Notes

Before using CREPE/PitchCREPE-family models or Essentia-family libraries for commercial distribution, SaaS, or paid services, check the license of each model and library individually.

---

## 日本語

ブラウザ完結のリアルタイムF0表示、ピッチグラフ表示、簡易チューナー表示Webアプリです。

### 最新状況

- 初期状態の `Graph` モードでは、声や単音楽器向けのピアノロール型ピッチ履歴を表示します。
- `Mode` ボタンから `Tuner` モードへ切り替えられます。検出音を中心に、+/-50 cent の範囲、10 centごとのガイド、瞬時検出点、平滑化した平均トレースを表示します。
- Tunerの中心音は高confidenceの検出に追従します。有効な検出がまだない場合はA4を中心にします。
- `Tuner` モードでは縦方向の範囲が現在音の +/-50 cent に固定されるため、ピッチズーム、縦パン、ピッチスクロールバーは無効になります。時間ズームと横方向の移動は利用できます。
- 推論は10ms hopから開始し、端末性能や処理負荷に応じて最大250msまで自動調整します。ステータスバーには `max res`、`adapting`、`catch-up`、`limited`、`stable` を表示します。
- 描画は対応ブラウザではOffscreenCanvas Web Workerを使い、非対応環境ではメインスレッドCanvasへfallbackします。
- web manifestとservice workerを含み、インストール可能なPWA風のapp shellキャッシュに対応しています。

### 機能

- マイク入力から単音のF0を推定
- 入力音声を16kHzへリサンプリング
- PitchCREPE互換のCREPEモデル推論
- 推定中は現在時刻へ自動追従するピアノロールCanvas表示
- `Graph` / `Tuner` 表示モード切り替え
- Pause / Resume、Clear
- `Graph` モードでの縦横ズーム、縦横パン、confidence threshold調整
- `Tuner` モードでのcent表示と平均トレース
- hover hint
- CSVエクスポート

### 実行

ディレクトリ全体をHTTPS URLまたはlocalhostで配信し、`index.html` を開いてください。マイク入力とservice worker登録にはsecure contextが必要です。

ローカル確認例:

```sh
python -m http.server 4173
```

その後、`http://localhost:4173/` を開きます。

### 推論

ブラウザではTensorFlow.jsでCREPEモデルを読み込みます。PitchCREPEの仕様に合わせ、推論入力は16kHz、出力は `time_sec`、`f0_hz`、`confidence` をもとにMIDI値へ変換します。hopは10msから開始し、処理負荷に応じて最大250msまで自動調整します。モデル取得に失敗した場合は、アプリの操作確認用にYIN fallbackで起動します。

### CSV

`Export CSV` は以下のカラムを出力します。

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` は現在のconfidence thresholdとC1-C7のhard rangeで判定します。

### 検証

ブラウザUIの基本動作とTunerモードロジックを確認する軽量スクリプトがあります。

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-browser.mjs` の実行には、ローカルのNode環境でPlaywrightが使える必要があります。`VERIFY_MIC=1` を指定するとfake microphoneでの起動確認も含めます。

### ライセンス注意

CREPE/PitchCREPE系モデルやEssentia系ライブラリを商用配布・SaaS・有償提供で使う場合は、利用するモデルとライブラリのライセンスを個別に確認してください。
