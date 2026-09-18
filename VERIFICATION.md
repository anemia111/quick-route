# 公開検証記録

確認日: 2026-09-18（日本時間）

- 公開URL: https://anemia111.github.io/quick-route/
- リポジトリ: https://github.com/anemia111/quick-route
- 初回デプロイ: https://github.com/anemia111/quick-route/actions/runs/35329050533 （build/deploy成功）
- レイアウト更新: https://github.com/anemia111/quick-route/actions/runs/35329165670 （成功）
- 後続更新の結果: https://github.com/anemia111/quick-route/actions

## 実施済み

- ローカル: TypeScriptチェック、Vitest 6件、Lint、本番ビルド成功。
- GitHub Actions: npm ci、型チェック、テスト、本番ビルド、Pagesデプロイ成功。
- HTTP: 公開トップ、CSS、JS、SVGアイコン、Apple Touch Icon、192px/512pxアイコン、Manifest、登録スクリプト、Service Workerが200。適切なContent-Typeを確認。
- Manifest: id/start_url/scopeが /quick-route/、standalone。Service Worker登録も /quick-route/ に限定。
- Chrome上の公開版: 初回設定、未入力エラー、同一駅警告、駅保存、再読み込み後の保持、歯車から設定、駅の入れ替えと保存、戻る操作を確認。
- Chrome上の公開版: 「目的地へ」で東京→新宿、「最寄りへ」で新宿→東京のYahoo!検索結果を実際に表示。両方とも2026-09-18 18:23出発、到着時刻順、ルート一覧を確認。
- 画面: 390×844相当のダーク表示（ローカル）、320×568相当のライト表示（公開版）を目視。320px幅で横はみ出しなし、検索ボタン高さ88pxを確認。
- コミット対象を確認。node_modules、dist、設定駅、アクセストークン、端末の個人パスはリポジトリに含めていません。

## 検証環境で見つかった制限

Codex内蔵ブラウザでは同じホストに以前保存された別アプリが表示されました。HTTPからは正しいQuick Routeが配信され、Chromeでは正常に表示・操作できたため、既存のブラウザキャッシュ／Service Workerの干渉と考えられます。既存アプリやその保存データは変更していません。同様の現象が起きる場合は、まず別ブラウザまたはプライベートブラウズで開いてください。Quick Route自身のService Workerはサブパス限定です。

## 実機未検証

iPhone実機のSafari、ホーム画面追加、standalone起動、Dynamic Island／ホームインジケーターの実表示、PWAからYahoo!への外部遷移、SafariとPWA間の保存領域分離。CSSとManifestには対応を実装していますが、画面サイズ検証は実機検証ではありません。オフライン動作はキャッシュ生成と通信不要の設定実装を確認しており、実機のオフライン切替試験は未実施です。
