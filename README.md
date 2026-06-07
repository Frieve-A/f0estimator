# Frieve F0 Estimator

(Japanese below)

[Open the app](https://frieve-a.github.io/f0estimator/)

[Support the project](https://ko-fi.com/frievea)

## Overview

Frieve F0 Estimator helps you see how the pitch of a voice or single-note instrument changes over time. You can use live microphone input or upload an audio file from your device.

Use `Graph` mode when you want to review pitch movement over time. Use `Tuner` mode when you want a focused view of the current note and how sharp or flat it is.

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

### Readouts and Export

- See the current detected note in the graph area.
- See a stability readout for notes held for at least 1 second.
- Export pitch observations as CSV.

## Running

The easiest way to use the app is the hosted version:

[Open the app](https://frieve-a.github.io/f0estimator/)

For a local copy, serve this directory from localhost or HTTPS, then open it in a browser. Microphone access will not work from a plain `file://` page.

```sh
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Verification

The repository includes lightweight checks for browser UI behavior, Tuner mode logic, range selection, and upload state handling.

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-tuner-mode.mjs` checks the shared lower-left current note label, sustained-note MAD visibility/update/reset behavior, range-selection stats hint behavior, and mocked upload success/Cancel restoration. `tools/verify-browser.mjs` requires Playwright to be available in the local Node environment. Set `VERIFY_MIC=1` to include a fake-microphone startup check.

## Developer Notes

### Inference

In the browser, the app loads the CREPE model with TensorFlow.js. Following the PitchCREPE specification, inference input is 16 kHz and output values `time_sec`, `f0_hz`, and `confidence` are converted to MIDI values.

The graph display can scroll up to C8. The current CREPE model output itself is effectively limited near the B6/C7 area, while the YIN fallback searches up to the C8 display ceiling. Realtime inference begins at a 10 ms hop and can adapt the hop up to 250 ms under load. Uploaded audio is decoded by the browser, analyzed offline through the same pitch pipeline, and uses the same 10-minute retained-history limit as the realtime graph.

### CSV

`Export CSV` outputs the following columns.

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` is determined by the current confidence threshold and the C1-C8 hard range.

### Rendering and Offline Shell

Rendering uses an OffscreenCanvas Web Worker when supported, with a main-thread canvas fallback. The app includes a web manifest and service worker for installable/offline app-shell behavior.

### License Notes

Before using CREPE/PitchCREPE-family models or Essentia-family libraries for commercial distribution, SaaS, or paid services, check the license of each model and library individually.

---

## 日本語

[アプリを開く](https://frieve-a.github.io/f0estimator/)

[紹介記事: 〖音楽〗リアルタイム音程可視化アプリ「Frieve F0 Estimator」作ってみた](https://note.com/frievea/n/n68ba2af8696e)

[プロジェクトを支援する](https://ko-fi.com/frievea)

### 概要

Frieve F0 Estimatorは、声や単音楽器の音の高さが時間とともにどう動くかを確認するためのWebアプリです。マイク入力を使うことも、手元の音声ファイルをアップロードすることもできます。

`Graph` モードでは音程の動きを時間軸で確認できます。`Tuner` モードでは、今の音名と、基準の音からどれくらい高いか低いかを集中的に確認できます。

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

#### 表示と出力

- グラフ上に現在の検出音名を表示します。
- 1秒以上伸ばした音では、音程の安定度を示す表示が出ます。
- 観測データをCSVとしてエクスポートできます。

### 実行

通常は公開版を開くだけで使えます。

[アプリを開く](https://frieve-a.github.io/f0estimator/)

ローカルで動かす場合は、このディレクトリをlocalhostまたはHTTPSで配信してブラウザで開いてください。`file://` で直接開くと、マイク入力は使えません。

```sh
python -m http.server 4173
```

その後、`http://localhost:4173/` を開きます。

### 検証

ブラウザUIの基本動作、Tunerモードロジック、範囲選択、Upload状態処理を確認する軽量スクリプトがあります。

```sh
node tools/verify-tuner-mode.mjs
node tools/verify-browser.mjs http://localhost:4173
```

`tools/verify-tuner-mode.mjs` では、共通の左下の現在音名表示、継続音MADの表示・更新・リセット動作、範囲選択統計hint、Upload成功/Cancel復元のモック検証も確認します。`tools/verify-browser.mjs` の実行には、ローカルのNode環境でPlaywrightが使える必要があります。`VERIFY_MIC=1` を指定するとfake microphoneでの起動確認も含めます。

### 開発者向け情報

#### 推論

ブラウザではTensorFlow.jsでCREPEモデルを読み込みます。PitchCREPEの仕様に合わせ、推論入力は16kHz、出力は `time_sec`、`f0_hz`、`confidence` をもとにMIDI値へ変換します。

グラフ表示はC8までスクロールできます。現在のCREPEモデル出力自体は実質的にB6/C7付近までで、YIN fallbackは表示上限に合わせてC8まで探索します。リアルタイム推論のhopは10msから開始し、処理負荷に応じて最大250msまで自動調整します。アップロード音声はブラウザでデコードし、同じピッチ推定パイプラインでオフライン解析します。保持履歴はリアルタイム表示と同じく最大10分です。

#### CSV

`Export CSV` は以下のカラムを出力します。

```csv
time_sec,f0_hz,midi_float,note_name,octave,cents_from_nearest,confidence,voiced
```

`voiced` は現在のconfidence thresholdとC1-C8のhard rangeで判定します。

#### 描画とオフラインapp shell

描画は対応ブラウザではOffscreenCanvas Web Workerを使い、非対応環境ではメインスレッドCanvasへfallbackします。web manifestとservice workerを含み、インストール可能なPWA風のapp shellキャッシュに対応しています。

#### ライセンス注意

CREPE/PitchCREPE系モデルやEssentia系ライブラリを商用配布、SaaS、有償提供で使う場合は、利用するモデルとライブラリのライセンスを個別に確認してください。
