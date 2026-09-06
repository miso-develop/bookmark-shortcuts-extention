# Bookmark Shortcuts Minimal

Firefox のブックマークツールバーをキーボードから直接操作する、最小権限の WebExtension です。

## 基本ショートカット

| ショートカット | 動作 |
| --- | --- |
| `Alt+1` ～ `Alt+9` | ブックマークツールバー左から 1 ～ 9 番目を開く |
| `Alt+0` | 10 番目を開く |
| `Alt+Shift+1` ～ `Alt+Shift+0` | 通常ブックマークなら新しいタブで開く |

対象がフォルダの場合は専用ポップアップを開きます。フォルダや区切りもブックマークツールバー上の位置として数えます。

## フォルダポップアップ

- `↑` / `↓`: 1 項目ずつ選択
- `PageUp` / `PageDown`: 約 1 画面分選択を移動
- `Enter`: 選択中のブックマークを開く / フォルダへ入る
- `Ctrl+Enter`: ブックマークを新しいタブで開く
- `←` / `Backspace`: 直前のフォルダへ戻る
- `Alt+Enter`: 現在のフォルダ内容を新しいタブの全画面レイアウトで開く
- `Alt+Tab`: ポップアップがキーイベントを受け取れた場合は同じ全画面タブ表示を実行します。ただし Windows では Alt+Tab は OS のウィンドウ切替が優先されるため、通常は拡張側で取得できません。

マウスで項目にカーソルを合わせた場合や `Tab` でフォーカスを移動した場合も、選択表示と実フォーカスを同期します。古い項目のハイライトは残しません。

### ポップアップを開いたまま別のショートカットを押した場合

フォルダポップアップと background script は `runtime.Port` で接続されています。

- 同じフォルダのショートカット: 何もしない
- 別のフォルダのショートカット: 新しいタブを開かず、現在のポップアップ内容を切り替える

ポップアップを開けない環境では、同じフォルダビューを全画面レイアウトの新しいタブで開きます。

## 設定

設定はフォルダポップアップには表示しません。Firefox のアドオン管理画面からこの拡張の設定を開いて変更します。

現在の設定:

- **Enterで常に新しいタブで開く**

設定値は拡張自身の `localStorage` に保存するため、`storage` 権限は要求しません。

## アイコン

Firefox の Bookmarks API は保存済みブックマークの favicon を返しません。外部 favicon サービスへブックマーク URL を送信する実装はプライバシー上採用していないため、現在はフォルダ / ブックマークの汎用アイコンを表示します。

## 権限

要求する権限は `bookmarks` のみです。

```json
"permissions": [
  "bookmarks"
]
```

以下は要求しません。

- `tabs`
- `storage`
- `activeTab`
- `<all_urls>`
- host permissions

Content Script、外部通信、データ収集もありません。

## 一時インストール

1. リポジトリを clone または ZIP で取得
2. Firefox で `about:debugging#/runtime/this-firefox` を開く
3. **一時的なアドオンを読み込む**
4. `manifest.json` を選択

変更後は同じ画面から **再読み込み** してください。

## ショートカット変更

`about:addons` → 歯車メニュー → **拡張機能のショートカットキーの管理** から変更できます。

## テスト

Node.js 22 以上:

```bash
npm test
```

GitHub Actions でも `main` への push と Pull Request ごとに同じテストを実行します。

## 常用する場合

通常版 Firefox へ永続インストールするには Mozilla の署名が必要です。公開せずに使う場合は AMO の Unlisted 配布として署名済み XPI を取得できます。

## 参考

- https://github.com/mortalis13/Bookmark-Shortcuts

既存プロジェクトのコードをコピーせず、必要な WebExtensions API のみで再実装しています。

## License

MIT License
