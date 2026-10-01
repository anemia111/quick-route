# Quick Route Next 全国鉄道データ調査

調査日・本文に記載した情報源の最終確認日：**2026-10-01（日本時間）**。提供元の更新日と、この確認日を混同しない。登録・認証を要するAPIの全応答、全列車・全運行日の正確性、iPhone実機は未確認。未確認は「公開データが存在しない」という意味ではない。

## 結論と不足範囲

全国の駅名・事業者名・路線名の検索は国土交通省N02で無償実現できる。全国の完全な時刻表、乗換時間、列車単位の現在情報、過去の遅延実績を、恒久的かつ再配布可能な無料データだけで確保できることは確認できなかった。個人・少人数利用にも各規約が適用される。

全国一覧の基準は[国土数値情報N02-2025](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html)。2025-12-31時点、2026年4月更新。元の鉄道路線区間GeoJSONから事業者名・路線名の重複を除くと597組、事業者名文字列は177種類。これは現在の法人数・運転系統数ではない。元データに「事業者名：三国芦原線／路線名：えちぜん鉄道」という項目も存在するため、原文を保ち要確認とした。路線の法定名称と案内上の名称、2026年の変更、運休・休止区間にも注意する。

JR北海道・JR東海・JR西日本・JR四国・JR九州の全線、JR東日本の首都圏対象外、全国の新幹線、大部分の関西・中京・地方私鉄について、本構成で利用可能な完全な時刻表・無料リアルタイムAPIは未確認。公式サイト上のPDF・列車位置表示が存在することと、機械取得・加工・再配布の許諾は別。バスのGTFS公開を同じ事業者の鉄道公開と扱わない。

## 提供元・利用条件の比較

全行の確認日は2026-10-01。APIの数値的な利用回数上限は、記載のないものは未確認。「上限未確認」を「無制限」と扱わない。CC BYは出典・ライセンス・変更表示などの条件付きで加工・保存・再配布・商用利用が可能。CC0も商標・個人情報等の別の権利まで消すものではない。

| 提供元・公式URL | 対象・範囲 | 無料／登録・キー | 加工・端末保存・再配布／少人数・商用 | 更新・上限 | CORS／GitHub Pages |
|---|---|---|---|---|---|
| [国交省N02](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html) | 全国の旅客鉄道・軌道の駅・線形・事業者。時刻表なし | 無料、公開ZIPは登録不要 | 当該2025版CC BY 4.0。少人数・商用とも条件は同じ | 基準年ごとの整備。最新2025版。回数上限未確認 | 配信先のCORS未確認。許諾済み加工データを同一オリジンのPagesから配信可 |
| [駅データ.jp](https://ekidata.jp/agreement.php)、[ダウンロード](https://ekidata.jp/dl/) | 全国駅・路線・会社CSV。全無料列の詳細は未確認 | 無料版あり、登録必要。ライブAPI条件は未確認 | 加工・商用利用・第三者提供可。加工なしのデータ単体の有償販売など規約に制限。端末内保存は当該利用条件に従う | 更新不定期。サイト最新表示2026-09-14。API上限未確認 | API CORS未確認。許諾された静的配信構成を検討可 |
| [ODPT通常公開](https://developer.odpt.org/)、[カタログ](https://ckan.odpt.org/dataset/?tags=%E9%89%84%E9%81%93-railway) | 主に首都圏および一部地方。JSON・GTFS・GTFS-RT | 無償公開。保護APIは会員登録・キー、公開APIの一部は不要 | ライセンスはリソースごと。基本ライセンスは利用と生データ再配布を区別。少人数だから自由とはならない | 静的は改正等、動的は頻度・有効期限属性に従う。数値上限未確認 | キー非公開条件あり。Pagesに秘密キーを埋め込めない。公開CCリソースの一部はCORS実測可 |
| [ODPTチャレンジ2026](https://challenge2026.odpt.org/ja/opendata.html)、[限定ライセンス](https://developer.odpt.org/challenge_license) | JR東日本の一部・首都圏私鉄等の追加公開 | 登録・キー、参加条件あり | 限定ライセンスは期間・参加・提供方法等を制限。家族専用利用の適合は未確認。JR東日本には競合サービス開発等に関する特定条件 | 開催2026-07-01〜2027-03-12。限定ライセンスは終了後の利用停止・削除条件あり | 恒久的な公開静的パッケージや共有キーの根拠にしない |
| [東京都交通局・ODPT](https://ckan.odpt.org/dataset/train-toei) | 地下鉄4線・荒川線・日暮里舎人。GTFS／JSON／RT | 公開GTFSと公開RTは登録・キー不要、GET成功 | CC BY 4.0。出典「東京都交通局・公共交通オープンデータ協議会」、加工表示。少人数・商用とも可 | 静的版20260921、有効20260314〜20270312、HTTP更新2026-09-24。動的の個別頻度未確認、アプリは60秒以下の間隔で連打しない | 静的GETはCORS `*`。TripUpdates GETもCORS `*`。Pages構成で利用可、実iPhone未確認 |
| [東京メトロ](https://ckan.odpt.org/organization/tokyometro) | 9路線の駅・路線・駅／列車時刻表・運行情報、GTFS、RT Alert | 通常ODPTの保護APIは登録・キー | 基本ライセンス。列車時刻表全体をPagesに再配布する構成は採用しない。長期保存・共有の適合未確認 | 改正・動的更新。数値上限未確認 | 対象APIのCORS未確認、秘密キー公開不可 |
| [横浜市営地下鉄RT](https://ckan.odpt.org/dataset/r_train_gtfs_rt-yokohamamunicipal) | ブルー／グリーンライン、GTFS・JSON・RT。全RTメッセージの意味は未確認 | ODPT通常登録・キー | 基本ライセンス。再配布・長期保存要確認 | 掲載静的版20251226、有効20261231まで。改正・動的更新、上限未確認 | キー／CORS要確認 |
| [多摩モノレール](https://ckan.odpt.org/dataset/train-tamamonorail)、[りんかい線](https://ckan.odpt.org/dataset/train-twr) | GTFS・列車／駅時刻表・運行情報等。RTの種別はリソース確認が必要 | ODPT通常登録・キー | 基本ライセンス。無条件の再配布・長期保存を認めない | 個別頻度・上限未確認 | CORS未確認、キー非公開 |
| [つくばエクスプレス列車時刻表](https://ckan.odpt.org/dataset/r_train_timetable-mir) | JSON列車／駅時刻表・運行情報。静的GTFSは未確認 | ODPT通常登録・キー | 基本ライセンス | 更新・上限未確認 | CORS未確認、キー非公開 |
| [ことでん](https://www.kotoden.co.jp/publichtm/gtfs/index.html) | 琴平・長尾・志度3線のGTFS | 無料、登録・キー不要 | CC BY 4.0。加工・保存・再配布・商用可、出典等必要 | ZIP更新2026-01-29、有効20251212〜20270228。数値上限未確認 | GET200だがCORS許可ヘッダーなし。許諾された加工版をPagesで同一オリジン配信可 |
| [とさでん交通・ODPT](https://ckan.odpt.org/dataset/tosaden_traffic_streetcar) | 路面電車GTFS | 無料、公開ZIPはキー不要 | CC BY 4.0、加工・保存・再配布・商用可 | ZIP更新2026-09-26、有効20260801〜20270430。上限未確認 | 公開ZIPのGET200、CORS `*`。HEADの404だけで取得不可と判断しない |
| [恵那市／明知鉄道](https://www.city.ena.lg.jp/soshikiichiran/machizukurikikakubu/koutsuu/1/4548.html)、[公開ZIP](https://api.gtfs-data.jp/v2/organizations/aketetsu/feeds/akechirailway/files/feed.zip) | 明知線GTFS | 無料、公開ZIPは登録・キー不要 | リポジトリ表示CC BY 4.0。加工・保存・再配布・商用可 | 2026-03-01更新、有効20260314〜20270331、上限未確認 | GET200、CORS `*` |
| [山形県／山形鉄道](https://www.pref.yamagata.jp/020057/kurashi/kendo/kotsuseisaku/kokyokotsu_gtfs-jp.html) | フラワー長井線GTFS | 無料公開。詳細取得認証条件は未確認 | リポジトリ表示CC BY 4.0。対象ファイルとライセンスの対応を導入時確認 | 県掲載2026-03-09、有効20260314〜20270313、上限未確認 | CORS未確認。許諾確認後の静的Pages配信候補 |
| [GTFSリポジトリ](https://gtfs-data.jp/search?target_feed=chitacity%2Achita-aiaibus)／伊勢鉄道 | 伊勢線GTFS | 無料公開。対象取得条件は未確認 | 掲載CC BY 4.0。直接ファイル・全内容未確認 | 掲載2026-03-05、有効20260314〜20270331、上限未確認 | CORS未確認 |
| [富山県](https://opendata.pref.toyama.jp/pages/gtfs_jp.htm)、[リポジトリ](https://gtfs-data.jp/search?pref=%E5%AF%8C%E5%B1%B1%E7%9C%8C) | 富山地鉄**市内電車**・万葉線のGTFS、TripUpdates・VehiclePositions | 無料公開。RT各エンドポイントの認証条件は未確認 | 静的はリポジトリCC0表示。各RTに同じ許諾が適用されるかは導入前の最終確認が必要 | RT20秒間隔の案内。地鉄有効20260314〜20270313、万葉線20260901〜20270831。過剰アクセス禁止、数値上限未確認 | CORSエンドポイントごと未確認。地鉄の本線等の鉄道線に拡張しない |
| [函館市](https://www.city.hakodate.hokkaido.jp/docs/2020052700015/)、[ODPT](https://ckan.odpt.org/dataset/hakodate_city_alllines) | 市電GTFS、RT VP/TU/Alert | 公開、カタログはキー不要 | 現在カタログは[GTFS-RU](https://gtfs-jp.org/GTFS-RUL)。一般向け案内には事前通知・公認等の条件。少人数例外は未確認。メタデータ中の旧ライセンス表示との一致要確認 | 有効20260815〜20270814。更新・上限詳細未確認 | CORS未確認。許諾・公認条件確認前はアプリ収録しない |
| [熊本県のGTFSリポジトリ](https://gtfs-data.jp/search?pref=%E7%86%8A%E6%9C%AC%E7%9C%8C) | 熊本電鉄**電車**・熊本市電 | 無料公開、直接取得条件未確認 | 熊本電鉄電車はCC0、熊本市電は**CC BY 2.1 JP**と表示。第三者サイトのBY-SA表示を採用しない。各ファイルの正確な許諾は導入前確認 | 電車有効20260511〜20261228、市電20250601〜20270331。上限未確認 | CORS未確認。熊本電鉄バスのRTを鉄道RTと扱わない |
| [国交省「遅延見える化」](https://www.mlit.go.jp/report/press/tetsudo01_hh_000247.html) | 東京圏鉄道路線の遅延証明書発行状況・要因等の年度集計 | 無料閲覧、登録不要 | 各公開資料の利用条件に従う。列車単位の実績データではない | 2026-04-10公表、対象2024年度。年度集計 | API／CORS未確認。履歴予測への直接投入は不可 |

ODPT鉄道タグの検索結果件数はデータセット数であり、事業者数・全国対応率ではない。[基本ライセンス](https://developer.odpt.org/terms/data_basic_license.html)、[基本利用ガイドライン](https://developer.odpt.org/terms/data_basic_use_guideline.html)、[センター規約](https://developer.odpt.org/terms/center_use_rules.html)をリソースごとの特定条件と併せて確認する。基本ライセンスでは元データの全部・相当部分を再利用可能にする公開・再配布等に書面承諾が必要となる。キーを第三者へ開示しない。動的情報は生成時刻・更新頻度・有効期限に従い、古い情報を最新として表示しない。

[ODPT FAQ](https://developer.odpt.org/faq)にある静的応答1000件等は**1応答のレコード数**。APIの毎秒・毎日リクエスト上限とは別。数値上限は未確認。CC BY/CC0のリソースに基本ライセンスの制約を一律に適用せず、逆にカタログが無料だから全リソースをCCと考えない。

## 事業者・路線別の確認事項

| 区分 | 確認した対応 | 不足・制約 |
|---|---|---|
| 都営 | 浅草・三田・新宿・大江戸・日暮里舎人・荒川の6系統。実GTFSのroutesと列車時刻を確認 | 実ZIPにtransfers/pathwaysなし。別公開の駅構内データを同じファイルと扱わない |
| 都営RT | 地下鉄4線と荒川のVP/TU、Alertは日暮里舎人も対象 | 列車位置では三田線目黒〜白金高輪除外。GTFS-RT形式が存在しても、全列車全停車駅の予測が常にあるとは限らない |
| 東京メトロ | 通常公開のGTFS・JSON。RTカタログはAlert | Alertを列車位置・個別発着予測として使用しない |
| JR東日本・期間限定 | 首都圏の一部GTFS／JSON／位置・RT | 新幹線除外。静的は常磐線坂元以南・中央線高尾以東等。RTは常磐線羽鳥以南・中央線甲府以東等で範囲が一致しない。相模・鶴見・南武支線・八高線等RT除外。恒久利用不可 |
| 京王・東武・相鉄・期間限定 | 列車／駅時刻表・GTFS等。京王は2026-09-14にVP/TU追加 | 東武位置は館林以北・新栃木以北など除外。亀戸支線の一部駅間を識別できない。相鉄RTの詳細未確認 |
| 小田急・西武・東急・京急・期間限定 | 駅時刻表等。東急運行情報、京急列車位置も公開 | 駅時刻表だけでは同一列車の駅間接続が確定しない。京急位置は品川〜泉岳寺除外。列車時刻表／GTFSが未確認の会社を自動計算対応にしない |
| 京都市地下鉄 | 烏丸／東西GTFSはカタログ基本ライセンス | 公開期間がチャレンジ限定。**公開期間**と**限定ライセンス**を区別する。全限定公開データに一律の削除義務を推測しない |
| とさでん | 路面電車のGTFS。N02は伊野・後免・桟橋・駅前の法定名称 | GTFSの運転系統と法定路線の一対一対応は未確認 |
| 富山地鉄 | 市内電車の静的／RT | 本線・立山・不二越・上滝等を市内電車の公開で対応済みにしない |
| その他全国 | N02駅・路線基礎情報 | 独自計算に必要な合法・完全・最新の時刻表と乗換を未確認の区間は外部検索 |

## 乗換情報と履歴

N02の駅グループは同名・近接等による整備上の分類であり、乗換可能性や乗換時間ではない。実GTFS検査では、ことでんのtransfersは1行あるが最小乗換時間が空、とさでんは18行で最小時間が空、明知鉄道は0行。ファイルの存在だけで秒数が確認済みとは扱わない。都営[GTFS Pathways](https://ckan.odpt.org/dataset/train-toei/resource/b1019650-4cf5-4f2f-b2c6-87156825e365)は別リソースで公開。大江戸線12駅の構内データ公開が案内されているが、全国乗換表ではなく、改札や経路の走行条件・歩行時間・公開期間を別途検証する必要がある。

全国全列車の過去の実到着・実出発の無料公開履歴は未確認。遅延証明書の最大遅延、年度集計、位置サンプル、将来発着予測を実績と混同しない。自己入力した利用履歴の端末内集計は可能。RT収集を履歴化する場合は保存・分析・再配布の許諾を別確認する。今回のアプリは運行情報の永続履歴を作成しない。

[研究用GTFS](https://gtfs-gis.jp/gtfs4research/)は公式作成・校閲ではなく、研究目的限定、古い・推定データも含む旨が明記される。案内アプリの不足を埋めるデータとして採用しない。福井市の公式ページが案内するオープンデータには鉄道時刻表候補もあるが、個別データの改正日・利用許諾・完全性は未確認で、今回収録していない。

## 無料OSSの確認

最終コミット日はGitHub既定ブランチのAPI確認結果（UTCの日付）。すべて2026-10-01確認。保守が続くこと・iPhone動作の保証ではない。下表のiPhone欄は構成上の評価であり、実機テスト結果ではない。

| プロジェクト | 用途／ライセンス | 最終コミット日 | iPhone・採用判断 |
|---|---|---|---|
| [planarnetwork/raptor](https://github.com/planarnetwork/raptor) | RAPTOR/rRAPTOR、READMEはGPLv3 | 2026-09-16 | ブラウザ・Worker対応記述あり。実機速度未確認。GPLと依存の義務を確認して採用。今回は直接取り込まずCSAを実装 |
| [BlinkTagInc/node-gtfs](https://github.com/BlinkTagInc/node-gtfs) | GTFSのNode・DB処理、MIT | 2026-08-23 | PC前処理向け。iPhoneへそのまま載せる構成ではない |
| [MobilityData/gtfs-validator](https://github.com/MobilityData/gtfs-validator) | JavaのGTFS検証、Apache-2.0 | 2026-09-29 | CI・前処理で利用候補。実機実行不要 |
| [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) | 大規模経路計算、LGPL-3.0-or-later、別ライセンスの組込み部品あり | 2026-09-30 | Javaサーバー構成。静的Pagesと端末内計算に直接適用困難 |
| [nagix/mini-tokyo-3d](https://github.com/nagix/mini-tokyo-3d) | 日本鉄道・ODPTのブラウザ可視化、MIT | 2026-09-30 | 日本鉄道データ処理の参考。全国時刻表の権利を提供するものではない。実機性能未確認 |
| [linkedconnections/client.js](https://github.com/linkedconnections/client.js) | CSA関連実装、READMEはMIT | 2019-10-07 | READMEにDeprecated。新規採用は避ける |
| [Dexie.js](https://github.com/dexie/Dexie.js) | IndexedDB、現在Apache-2.0 | 2026-09-28 | Safari対応資料あり、[Safari制限](https://dexie.org/docs/IndexedDB-on-Safari)。実機未確認。有料Cloudなしでコア利用可能 |
| [idb](https://github.com/jakearchibald/idb) | IndexedDBの小さいラッパー、ISC | 2025-05-07 | ブラウザ向け、今回採用。最新コミットが古いだけで放棄と断定しない。実機未確認 |

[RAPTOR原論文](https://www.microsoft.com/en-us/research/publication/round-based-public-transit-routing/)、[CSA原論文](https://arxiv.org/abs/1703.05997)、[GTFS Schedule仕様](https://gtfs.org/documentation/schedule/reference/)、[Realtime仕様](https://gtfs.org/documentation/realtime/reference/)を参照する。

## 推奨構成と注意点

全国駅はN02の加工JSON、時刻表は再配布が確認できたCC BY/CC0データを版・地域／路線別に配信、個人履歴と保存データはIndexedDB。全国駅検索と時刻表対応範囲を別に管理する。未確認・認証秘密を必要とする情報源は初期運用に組み込まない。データ不足はYahoo!の公開ブラウザ検索へ遷移し、同サイトのデータを収集しない。

GitHub Pagesは静的公開配信であり、少人数だけがURLを知っていることは非公開や再配布除外の根拠にならない。[Pages制限](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)には公開サイト1GB、帯域月100GBのsoft limit等がある。CORSは配信URL・応答ごとに確認する。`no-cors`は応答を読み取る解決策ではない。

[WebKit保存方針](https://webkit.org/blog/14403/updates-to-storage-policy/)の永続化要求は容量・保存を保証しない。ホーム画面追加、SafariとPWAの保存領域、OSによる削除、利用者の消去を考慮する。オフラインのリアルタイム更新は不可能。[Service Workerの背景処理](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)は常時実行の手段ではない。自動保存は表示中・起動時に行い、再表示時に復旧する。

実GET検査の詳細は、調査作業フォルダーの `feed-probes.json` と `toei-probe.json` に保存。調査資料は権利の法律判断を代替せず、ライセンス・URL・期間が変更された場合は再確認する。
