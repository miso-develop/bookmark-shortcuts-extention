# Bookmark Shortcuts Minimal

Firefox のブックマークツールバーをキーボードから直接開くための、最小構成の WebExtension です。

## ショートカット

| ショートカット | 動作 |
| --- | --- |
| `Alt+1` ～ `Alt+9` | ブックマークツールバーの左から 1 ～ 9 番目を現在のタブで開く |
| `Alt+0` | 左から 10 番目を現在のタブで開く |
| `Alt+Shift+1` ～ `Alt+Shift+9` | 左から 1 ～ 9 番目を新しいタブで開く |
| `Alt+Shift+0` | 左から 10 番目を新しいタブで開く |

現在のタブがピン留めされている場合は、ピン留めタブを上書きせず新しいタブで開きます。

番号はブックマークツールバー上の表示順に対応します。フォルダーや区切りも位置として数えますが、URL を持たないためショートカットからは開きません。

## 権限

要求する権限は `bookmarks` のみです。

```json
"permissions": [
  "bookmarks"
]
```

Bookmarks API でブックマークツールバーの内容を読み取るために必要です。

以下の権限は要求しません。

- `tabs`
- `storage`
- `activeTab`
- `<all_urls>`
- その他の host permissions

`browser.tabs.create()` / `browser.tabs.update()` / URL やタイトルを参照しない通常の `browser.tabs.query()` は、この用途では `tabs` 権限を追加せず利用できます。

## プライバシー / セキュリティ

- Content Script なし
- Web ページ内容へのアクセスなし
- 外部通信なし
- 設定データの保存なし
- npm 依存なし
- ビルド工程なし
- Firefox 向け Manifest V3
- AMO 向けに `data_collection_permissions.required = ["none"]` を明示

インストール対象の実行コードは `background.js` だけなので、コード全体を容易に監査できます。

## 一時インストールして試す

1. このリポジトリを clone または ZIP で取得します。
2. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
3. **一時的なアドオンを読み込む** を選択します。
4. このリポジトリの `manifest.json` を選択します。
5. ブックマークツールバーの先頭に URL ブックマークを置き、`Alt+1` などを試します。

一時インストールした拡張は Firefox の再起動で削除されます。

## ショートカットを変更する

Firefox の以下から変更できます。

1. `about:addons` を開く
2. 右上の歯車メニューを開く
3. **拡張機能のショートカットキーの管理** を選択
4. 各コマンドのキーを変更する

ブラウザー本体や他の拡張機能が同じキーを使用している場合は、競合するショートカットを変更してください。

## 常用する場合

通常版 Firefox へ永続インストールするには Mozilla の署名が必要です。

この拡張は Manifest V3 の Add-on ID と、2025 年以降の AMO 申請で必要なデータ収集宣言を `manifest.json` に含めています。公開せずに利用する場合は AMO の **Unlisted** 配布として署名済み XPI を取得できます。

## ファイル構成

```text
.
├── manifest.json
├── background.js
├── README.md
└── LICENSE
```

## 参考

機能要件の参考として以下の既存プロジェクトを確認しています。

- https://github.com/mortalis13/Bookmark-Shortcuts

既存プロジェクトのコードをそのままコピーするのではなく、必要な WebExtensions API のみを使って最小権限で再実装しています。

## License

MIT License
