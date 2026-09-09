# Bookmark Shortcuts Minimal

[English](README.md) | **日本語**

Firefox / Chrome のブックマークツールバー / ブックマークバーをキーボードから直接操作する、最小権限の拡張機能です。

## 対応ブラウザ

- Firefox: Manifest V3
- Chrome 134 以降: Manifest V3

フォルダUIは両ブラウザとも拡張機能のAction Popupを使用します。Side Panelは使用しません。

## 基本ショートカット

| ショートカット | 動作 |
| --- | --- |
| `Alt+1` ～ `Alt+9` | ブックマークツールバー / バー左から 1 ～ 9 番目を開く |
| `Alt+0` | 10 番目を開く |
| `Alt+Shift+1` ～ `Alt+Shift+0` | 通常ブックマークを新しいタブで開く |

フォルダも位置として数えます。Firefoxでは区切りも位置として数えます。

### Chromeのショートカット初期設定

Chromeでは、拡張機能が既定値として割り当てられるショートカットは最大4件です。そのためChrome版では初期状態で次の4件だけを提案します。

- `Alt+1`
- `Alt+2`
- `Alt+3`
- `Alt+4`

コマンド自体は20件すべて登録します。残りは一度だけ以下から設定してください。

```text
chrome://extensions/shortcuts
```

拡張機能のOptions画面では、現在の設定状況を `configured / 20` 形式で表示し、未割当のコマンドを確認できます。

## フォルダポップアップ

ショートカット対象がフォルダの場合、専用ポップアップを開きます。

- `↑` / `↓`: 1項目ずつ選択
- `Shift+↑` / `Shift+↓`: 5項目ずつ移動。端では先頭 / 末尾で停止
- `PageUp` / `PageDown`: 約1画面分選択を移動
- `Shift+PageUp` / `Shift+PageDown`: 通常ページ移動の約半分だけ選択を移動
- `Home`: 先頭の選択可能項目へ移動
- `End`: 最後の選択可能項目へ移動
- `Enter`: 選択中のブックマークを開く / フォルダへ入る
- `Ctrl+Enter`: 選択中のブックマークを新しいタブで開く
- ルートフォルダで `←` / `→`: ブックマークツールバー / バー上の前 / 次のフォルダへ切り替える。通常ブックマークや区切りは飛ばし、端では循環しない
- サブフォルダで `←` / `→`: 何もしない
- `Backspace`: 親フォルダへ戻る
- 戻るボタン: 親フォルダへ戻る
- `Alt+Enter`: 現在のフォルダ内容を新しいタブの全画面レイアウトで開く
- `Alt+Tab`: ポップアップがキーイベントを受け取れた場合は同じ全画面表示を実行。ただし通常はOS側のAlt+Tabが優先されるため、拡張側では取得できない

ルートフォルダまたはそのサブフォルダを表示している間、ヘッダには `F3` のようにブックマークバー上の起点位置を表示します。

`PageUp` / `PageDown` / `Shift+PageUp` / `Shift+PageDown` / `Shift+↑` / `Shift+↓` / `Home` / `End` は、選択状態だけでなく移動先へ実フォーカスも移します。

サブフォルダから `Backspace` / 戻るボタンで親へ戻った場合は、親フォルダ内の「今戻ってきたサブフォルダ」項目へ選択状態と実フォーカスを復元します。

### マウスとキーボードのフォーカス優先順位

マウスを実際に動かして項目上を移動したときは、その項目へ選択とフォーカスを同期します。その後にキー入力があった場合はキーボード選択を優先します。マウスカーソルが以前の項目上に静止していても、キー入力後に古いhover表示が選択を奪い返しません。

`Tab` / `Shift+Tab` によるポップアップ内フォーカス移動も維持します。

### ポップアップを開いたままショートカットを押した場合

ポップアップ自身が `Alt+数字` を処理し、backgroundの永続状態には依存しません。

- 現在表示しているルートフォルダのショートカット: サブフォルダ表示中でも何もしない
- 別のフォルダのショートカット: 現在のポップアップ内容をそのフォルダへ切り替える
- 通常ブックマークのショートカット: ブックマークを開いてポップアップを閉じる
- ルート階層で `←` / `→`: 同じポップアップ内で前 / 次のフォルダへ切り替える

この構成により、Chrome Manifest V3のService Workerが停止してglobal変数が失われても、開いているポップアップの操作状態に依存しません。

### ブラウザーショートカットの抑止

専用ポップアップがキーイベントを受信できた場合、`Esc` と通常の `Tab` / `Shift+Tab` 以外はcapture phaseで `preventDefault()` / `stopImmediatePropagation()` します。

ただしブラウザまたはOS予約のショートカットは、WebExtensionより先に処理される場合があります。`Ctrl+Tab` や `Alt+Tab` をブラウザ / OS側が先に消費した場合、完全な抑止は保証できません。

`Esc` はポップアップを閉じられるようブラウザ側へそのまま渡します。

## Chrome固有の動作

### Bookmarks Barの選択

Chrome 134以降では、Google Account側とローカルの「This device」側など、複数の `bookmarks-bar` が存在する場合があります。

- 1本だけなら自動選択
- 複数ある場合はOptions画面から、`Alt+数字` の対象にするBookmarks Barを選択可能
- 未選択時は、同期中 / Google Account側が存在すればそちらを優先

選択値はIndexedDBへローカル保存します。`storage`権限は追加しません。

### favicon

Chrome版では `favicon` 権限を必須とし、通常ブックマークにはChrome内部に保存されたサイトfaviconを表示します。外部faviconサービスへブックマークURLを送信しません。

フォルダは引き続き汎用フォルダアイコンを使用します。

### Actionアイコン

Chromeでは拡張機能のActionをBookmarks Bar内へ配置できないため、Chrome上部の拡張機能ツールバーに表示されます。

一時的な位置バッジ（`1`、`F3`など）を確認しやすくするためPinを推奨しますが、Pinしていなくてもキーボードショートカット自体は利用できます。

## 設定

ブラウザの拡張機能管理画面からOptionsを開きます。

共通設定:

- **Enterで常に新しいタブで開く**

Chrome版ではさらに以下を表示します。

- キーボードショートカットの設定状況
- Bookmarks Barが複数ある場合の対象選択
- ブラウザ / 拡張機能バージョン

Enter設定は拡張ページ自身の `localStorage` に保存するため、`storage` 権限は要求しません。

## 権限

### Firefox

```json
"permissions": [
  "bookmarks"
]
```

### Chrome

```json
"permissions": [
  "bookmarks",
  "favicon"
]
```

どちらも以下は要求しません。

- `tabs`
- `storage`
- `activeTab`
- `<all_urls>`
- host permissions

Content Script、外部通信、データ収集もありません。

## ビルド

Node.js 22以上:

```bash
npm run build
```

出力先:

```text
dist/firefox/
dist/chrome/
```

個別ビルドもできます。

```bash
npm run build:firefox
npm run build:chrome
```

ソースmanifest:

- `manifest.json`: Firefox
- `manifest.chrome.json`: Chrome

## インストール

### Firefox 開発 / 一時インストール

1. `npm run build:firefox`
2. Firefoxで `about:debugging#/runtime/this-firefox` を開く
3. **一時的なアドオンを読み込む**
4. `dist/firefox/manifest.json` を選択

通常版Firefoxへの常設にはMozilla署名が必要です。個人利用ならAMO Unlistedで署名済みXPIを取得できます。

### Chrome ローカル常設

1. `npm run build:chrome`
2. `chrome://extensions` を開く
3. **Developer mode** をON
4. **Load unpacked** を選択
5. `dist/chrome` ディレクトリを指定
6. `chrome://extensions/shortcuts` で必要な残りのショートカットを設定
7. 必要に応じてBookmark ShortcutsをChromeの拡張機能ツールバーへPin

unpacked拡張はChrome再起動後も残ります。再ビルド後は `chrome://extensions` から **Reload** してください。

## テスト

```bash
npm test
```

GitHub Actionsでは `main` へのpushとPull Requestごとにテストを実行し、Firefox / Chrome両方のパッケージをビルドします。

## 参考

- https://github.com/mortalis13/Bookmark-Shortcuts

既存プロジェクトのコードをコピーせず、必要なブラウザ拡張APIのみで再実装しています。

## License

MIT License
