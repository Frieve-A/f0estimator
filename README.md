# Frieve F0 Estimator

(Japanese below)

[Open the app](https://frieve-a.github.io/f0estimator/)

[Support the project](https://ko-fi.com/frievea)

## Overview

Frieve F0 Estimator visualizes pitch over time from a live microphone or an audio file. It supports focused analysis of voices and single-note instruments, as well as simultaneous-pitch analysis for polyphonic sources.

Use `Graph` mode to review the pitch contour of a monophonic source over time, `Tuner` mode to focus on the current note and its tuning, and `Multi F0` mode to inspect simultaneous pitches without combining them into a single contour.

## Features

### Analyze Audio

- Start live pitch tracking from the microphone.
- Upload a local audio file and view its pitch analysis on the graph.
- Cancel an upload while it is processing to keep the previous graph.
- Pause, resume, or clear the current session.

### Graph Mode

- Review pitch as a piano-roll style history.
- Zoom and pan through time and pitch range.
- Use the `Conf` slider to hide less certain detections.
- Select a region of the graph to inspect its high/low pitch and pitch variation.
- Hover over points to inspect individual observations.

### Tuner Mode

- See the detected note and cent offset in a focused tuner view.
- Follow the detected note as you sing or play.
- Review the smoothed pitch trace around the current note.

### Multi F0 Mode

- Analyze simultaneous pitches with EffeTune DSP's Note Spectrogram.
- View each detection independently, without connecting detections into pitch contours.
- Read confidence through color and opacity, and per-pitch volume through point size and brightness.
- Use the `Conf` slider to filter detections without running the analysis again.
- Switch between monophonic and polyphonic views without mixing their histories.

Multi F0 uses a 20-cent pitch grid. It presents estimated pitch observations rather than tracked notes or chord names, so results depend on the source material and the estimator's characteristics.

### Readouts and Export

- See the current detected note in the graph area in Graph and Tuner modes.
- See a stability readout for notes held for at least 1 second in the monophonic modes.
- Export the observations for the active mode as CSV.

## Running

The easiest way to use the app is the hosted version:

[Open the app](https://frieve-a.github.io/f0estimator/)

For a local copy, serve this directory from localhost or HTTPS, then open it in a browser. Microphone access will not work from a plain `file://` page.

```sh
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Verification

The repository includes checks for browser UI behavior, Tuner mode logic, Multi F0 analysis, range selection, upload state handling, and renderer compatibility.

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-multi-f0.mjs http://localhost:4173
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-tuner-mode.mjs` checks the monophonic and Tuner behavior. `tools/verify-multi-f0.mjs` runs the actual EffeTune WASM and checks monophonic and polyphonic file analysis through their dedicated workers, cancellation, microphone routing, CSV output, both renderer paths, offline loading, and mobile layout. The browser checks require Playwright and Chrome to be available locally. Set `VERIFY_MIC=1` when running `tools/verify-browser.mjs` to include its fake-microphone startup check.

## Developer Notes

### Inference

Graph and Tuner modes use EffeTune DSP 0.10.0 Pitch Meter for monophonic F0 estimation from C1 through C8. Multi F0 mode uses the same DSP library's Note Spectrogram at the input sample rate.

Live input for both analysis paths runs through EffeTune's AudioWorklet. Uploaded files are decoded by the browser and analyzed with the corresponding EffeTune effect in a dedicated Web Worker. The JavaScript runtime, baseline and SIMD WASM files, and license notices are included under `vendor/effetune`, so neither mode downloads an external model. Live analysis requires AudioWorklet support. Uploaded audio and realtime input both use the same 10-minute retained-history limit.

### CSV

In Graph and Tuner modes, `Export CSV` outputs the following columns:

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` is determined by the current confidence threshold and the C1-C8 hard range.

In Multi F0 mode, each detected pitch is written as a separate row. Simultaneous detections share the same `time_sec`, and the output adds the per-pitch `volume_db` column:

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced,volume_db
```

### Rendering and Offline Shell

Rendering uses an OffscreenCanvas Web Worker when supported, with a main-thread canvas fallback. The app includes a web manifest and service worker for installable/offline app-shell behavior.

---

## 日本語

[アプリを開く](https://frieve-a.github.io/f0estimator/)

[紹介記事: 〖音楽〗リアルタイム音程可視化アプリ「Frieve F0 Estimator」作ってみた](https://note.com/frievea/n/n68ba2af8696e)

[プロジェクトを支援する](https://ko-fi.com/frievea)

### 概要

Frieve F0 Estimatorは、マイク入力または音声ファイルから音高の時間変化を可視化するWebアプリです。声や単音楽器を詳しく確認する単音解析に加え、複音源に含まれる複数の音高を同時に解析できます。

`Graph` モードでは単音源の音高軌跡を時間軸で確認できます。`Tuner` モードでは現在の音名と基準音からのずれを集中的に確認できます。`Multi F0` モードでは、同時に検出された複数の音高を単一の軌跡にまとめず表示します。

### 機能

#### 音声を解析する

- マイクからリアルタイムに音程を確認できます。
- ローカル音声ファイルをアップロードし、解析結果をグラフで確認できます。
- アップロード処理中に `Cancel` すると、処理前のグラフを維持できます。
- Pause、Resume、Clearに対応します。

#### Graphモード

- 音程の履歴をピアノロール風のグラフで確認できます。
- 時間方向と音域方向をズーム、パンできます。
- `Conf` スライダーで、不確かな検出を表示しにくくできます。
- グラフ範囲を選択して、その範囲の高い音、低い音、音程のばらつきを確認できます。
- 点にマウスを重ねると、個別の観測値を確認できます。

#### Tunerモード

- 検出された音名とcent単位のズレを、チューナー風の表示で確認できます。
- 歌ったり演奏したりしている音に表示が追従します。
- 現在音の周辺で、平滑化された音程の動きを確認できます。

#### Multi F0モード

- EffeTune DSPのNote Spectrogramを使用して、複数の音高を同時に解析できます。
- 検出結果を音高軌跡として線で結ばず、個々の観測点として表示します。
- Confidenceを色と透明度、音高ごとの音量を点の大きさと明るさで確認できます。
- `Conf` スライダーで、再解析せずに表示する検出結果を絞り込めます。
- 単音モードと複音モードの履歴を混在させずに切り替えられます。

Multi F0の音高グリッドは20 cent単位です。音符の追跡やコード名の判定は行わず、推定された音高の観測結果を表示するため、結果は音源と推定器の特性に依存します。

#### 表示と出力

- Graph／Tunerモードでは、グラフ上に現在の検出音名を表示します。
- 単音モードで1秒以上伸ばした音では、音程の安定度を表示します。
- 選択中のモードの観測データをCSVとしてエクスポートできます。

### 実行

通常は公開版を開くだけで使えます。

[アプリを開く](https://frieve-a.github.io/f0estimator/)

ローカルで動かす場合は、このディレクトリをlocalhostまたはHTTPSで配信してブラウザで開いてください。`file://` で直接開くと、マイク入力は使えません。

```sh
python -m http.server 4173
```

その後、`http://localhost:4173/` を開きます。

### 検証

ブラウザUIの基本動作、Tunerモード、Multi F0解析、範囲選択、Upload状態処理、描画方式の互換性を確認する検証スクリプトがあります。

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-multi-f0.mjs http://localhost:4173
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-tuner-mode.mjs` は単音解析とTunerモードの動作を確認します。`tools/verify-multi-f0.mjs` は実際のEffeTune WASMを使い、単音・多音それぞれの専用Workerを介したファイル解析、Cancel時の復元、マイク経路、CSV、2種類の描画経路、オフライン読み込み、モバイル表示を確認します。ブラウザ検証にはPlaywrightとChromeが必要です。`tools/verify-browser.mjs` で `VERIFY_MIC=1` を指定すると、疑似マイクによる起動確認も行います。

### 開発者向け情報

#### 推論

Graph／Tunerモードは、EffeTune DSP 0.10.0のPitch Meterを使用してC1からC8までの単音F0を推定します。Multi F0モードは、同じDSPライブラリのNote Spectrogramを入力サンプルレートのまま使用します。

両方の解析経路で、リアルタイム入力はEffeTuneのAudioWorklet、アップロードファイルは対応するEffeTune effectを専用Web Workerで解析します。EffeTuneのJavaScriptランタイム、baseline／SIMD版WASM、ライセンス情報は `vendor/effetune` に同梱しているため、どちらのモードも外部モデルをダウンロードしません。リアルタイム解析にはAudioWorklet対応ブラウザが必要です。保持履歴はアップロード音声、リアルタイム入力とも最大10分です。

#### CSV

Graph／Tunerモードの `Export CSV` は以下のカラムを出力します。

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` は現在のconfidence thresholdとC1-C8のhard rangeで判定します。

Multi F0モードでは、検出された音高ごとに1行を出力します。同時に検出された音高は同じ `time_sec` を持ち、音高ごとの音量を表す `volume_db` 列が追加されます。

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced,volume_db
```

#### 描画とオフラインapp shell

描画は対応ブラウザではOffscreenCanvas Web Workerを使い、非対応環境ではメインスレッドCanvasへfallbackします。web manifestとservice workerを含み、インストール可能なPWA風のapp shellキャッシュに対応しています。
