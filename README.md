# Quick Route

[アプリを開く](https://anemia111.github.io/quick-route/) · [GitHubリポジトリ](https://github.com/anemia111/quick-route)

最寄りと目的地の2駅を登録し、現在時刻のYahoo!乗換案内へワンタップで移動する、iPhone向けの静的Webアプリです。

## 機能・技術

React / TypeScript / Vite / CSS / localStorage / PWA。バックエンド、ログイン、解析ツールは使用しません。青い「目的地へ」と緑の「最寄りへ」、駅の編集・保存・入れ替え、未入力・同一駅の警告、ライト／ダークモード、セーフエリアに対応します。初回は設定画面を開きます。

## ローカル起動

Node.js 24とnpmを使用します。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

開発・プレビューとも表示されたURLの `/quick-route/` を開きます。設定画面はReact内の状態で切り替えるため、サブパスのリロードで404になりません。

## iPhoneで使う

1. Safariで公開アプリを開きます。
2. 共有メニューから「ホーム画面に追加」を選び、「追加」を押します。表示位置はiOSのバージョンによって異なります。
3. ホーム画面のQuick Routeを起動し、「最寄り駅」「目的地駅」を登録して保存します。
4. 「目的地へ」または「最寄りへ」をタップします。

Safariとホーム画面アプリの保存領域は異なる場合があります。その場合はホーム画面アプリ内で再登録してください。歯車からいつでも編集できます。

## Yahoo!乗換案内との連携

`src/routing.ts` の `RouteProvider` インターフェースが検索サービスを分離しています。クリックハンドラー内で毎回 `new Date()` を取得し、日本の乗換検索に合わせて `Asia/Tokyo` へ変換します。端末時計の正確性に依存します。

2026-09-18に[Yahoo!の公開検索フォーム](https://transit.yahoo.co.jp/)へ検証用の「東京」「新宿」を入力して実際に送信し、検索URLと結果を確認しました。使用するのはブラウザ向けの `https://transit.yahoo.co.jp/search/result` です。非公開API・データ収集・スクレイピングには依存しません。

| パラメーター | フォームと結果で確認した内容 |
| --- | --- |
| from / to | 出発駅／到着駅 |
| y / m / d / hh | 日本時間の年／月／日／時 |
| m1 / m2 | 分の十の位／一の位 |
| type=1 | 指定日時に出発 |
| s=0 | 到着が早い順 |
| ticket=ic / expkind=1 | IC運賃／自由席優先 |
| ws=3 | 歩く速度「少しゆっくり」 |
| al / shin / ex / hb / lb / sr = 1 | 公開フォームで既定の移動手段を許可 |
| userpass=1 | 公開フォームが送信した値を維持。独立した意味・効果は未保証 |

確認時の結果には「2026年09月18日 18:10出発」と到着時刻順のルートが表示されました。公式に安定性が保証された外部連携APIではなく、将来URL仕様が変わる可能性があります。検索結果で候補駅が表示された場合はYahoo!側で目的の駅を確認してください。別サービスへ切り替える際は `routeProvider` を差し替えます。

## 自動デプロイ

`.github/workflows/deploy.yml` がmainへのpushと手動実行に対応します。Node.js 24上で `npm ci` → 型チェック → テスト → ビルド → distのPages artifactアップロード → github-pages環境へのデプロイを実行します。PagesのSourceにはGitHub Actionsを使用します。

[GitHub公式Pagesガイド](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)と各Actionの公式リリースを確認して構成しました。checkout v7、setup-node v7、configure-pages v6、upload-pages-artifact v5、deploy-pages v5を使用します。

Viteのbase、Manifestのid/start_url/scope、Service Workerは `/quick-route/` に揃えています。リポジトリ名を変更する場合は `vite.config.ts` とREADME内のURLも更新してください。アプリ本体のみをService Workerにキャッシュし、Yahoo!のページはキャッシュしません。

## 制限・プライバシー

- 検索時は駅名と日時をYahoo!へ送信し、同じ画面で結果を開きます。戻る操作でQuick Routeに戻れます。PWAからの外部遷移方法はiOSの挙動に依存します。
- 駅設定は端末内に保存され、端末間の同期はありません。ブラウザデータ削除やプライベートモードでは保持されないことがあります。
- オフラインでもキャッシュ済みの設定画面を使用できますが、経路検索には通信が必要です。初回アクセスもオンラインが必要です。
- 駅名の存在確認や候補補完は行いません。同じ文字列（全角半角・前後空白等を正規化）は検出しますが、別名で表記された同一駅の判定はできません。
- 料金・所要時間・運行情報・経路の正確性はYahoo!の提供情報に依存します。「到着が早い順」は検索条件であり、最速の到着を保証するものではありません。
- iPhone実機でのSafari、ホーム画面追加、Dynamic Island、セーフエリア、外部遷移は実機未検証です。

## 検証

Vitest / Testing Libraryで入力エラー、同一駅、保存・再読み込み、編集・入れ替え、破損データ、保存失敗、URLエンコード、日本時間の年跨ぎ・午前0時、無効入力をテストしています。公開後の確認結果は `VERIFICATION.md` に記録します。
