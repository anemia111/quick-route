"""Create the national baseline roster. Unknown is not an assertion of absence."""
import io, json, sys, urllib.request, zipfile
from pathlib import Path
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
url='https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip'
raw=Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else urllib.request.urlopen(url).read()
z=zipfile.ZipFile(io.BytesIO(raw));name=next(n for n in z.namelist() if 'UTF-8' in n and n.endswith('RailroadSection.geojson'))
pairs=sorted({(f['properties']['N02_004'],f['properties']['N02_003']) for f in json.loads(z.read(name))['features']})
known={
'東京都':('GTFS実取得・6系統','地下鉄4線・荒川VP/TU、日暮里舎人はAlert','CC BY 4.0','https://ckan.odpt.org/dataset/train-toei'),
'東京地下鉄':('GTFS・列車／駅時刻表カタログ確認','RT Alert、位置・TU未確認','ODPT基本','https://ckan.odpt.org/organization/tokyometro'),
'横浜市':('GTFS・JSONカタログ確認','JSON位置・RTあり、全メッセージ未確認','ODPT基本','https://ckan.odpt.org/dataset/r_train_gtfs_rt-yokohamamunicipal'),
'多摩都市モノレール':('GTFS・列車時刻表カタログ確認','運行情報等、RT種別要確認','ODPT基本','https://ckan.odpt.org/dataset/train-tamamonorail'),
'東京臨海高速鉄道':('GTFS・列車時刻表カタログ確認','運行情報等、RT種別要確認','ODPT基本','https://ckan.odpt.org/dataset/train-twr'),
'首都圏新都市鉄道':('JSON列車／駅時刻表、GTFS未確認','運行情報、RT種別要確認','ODPT基本','https://ckan.odpt.org/dataset/r_train_timetable-mir'),
'ゆりかもめ':('駅時刻表、列車時刻表／GTFS未確認','未確認','ODPT基本','https://ckan.odpt.org/dataset/?tags=%E9%89%84%E9%81%93-railway'),
'東日本旅客鉄道':('首都圏の一部・期間限定。この法定路線の全区間対応は未確認','首都圏の一部・静的と範囲不一致','チャレンジ限定＋特定条件','https://ckan.odpt.org/dataset/jreast_tokyo_area'),
'京王電鉄':('列車／駅時刻表・GTFS、期間限定','位置・VP/TU・運行情報、期間限定','チャレンジ限定','https://ckan.odpt.org/organization/keio'),
'東武鉄道':('列車／駅時刻表・GTFS、期間限定','位置・RT等、館林／新栃木以北等除外','チャレンジ限定','https://challenge2026.odpt.org/ja/opendata.html'),
'相模鉄道':('列車／駅時刻表・GTFS、期間限定','詳細未確認','チャレンジ限定','https://challenge2026.odpt.org/ja/opendata.html'),
'小田急電鉄':('駅時刻表。列車時刻表／GTFS未確認','未確認','チャレンジ限定','https://challenge2026.odpt.org/ja/opendata.html'),
'西武鉄道':('駅時刻表。列車時刻表／GTFS未確認','運行情報、期間限定','チャレンジ限定','https://challenge2026.odpt.org/ja/opendata.html'),
'東急電鉄':('駅時刻表。列車時刻表／GTFS未確認','運行情報、期間限定','チャレンジ限定','https://ckan.odpt.org/organization/tokyu'),
'京浜急行電鉄':('駅時刻表。列車時刻表／GTFS未確認','位置・運行情報、品川〜泉岳寺除外','チャレンジ限定＋特定条件','https://ckan.odpt.org/organization/keikyu'),
'京都市':('GTFS、公開期間限定','未確認','ODPT基本・公開期間に注意','https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_subway_gtfs'),
'高松琴平電気鉄道':('3線GTFS実取得','未確認','CC BY 4.0','https://www.kotoden.co.jp/publichtm/gtfs/index.html'),
'とさでん交通':('路面電車GTFS実取得、法定路線との一対一対応未確認','未確認','CC BY 4.0','https://ckan.odpt.org/dataset/tosaden_traffic_streetcar'),
'明知鉄道':('GTFS実取得','未確認','CC BY 4.0','https://www.city.ena.lg.jp/soshikiichiran/machizukurikikakubu/koutsuu/1/4548.html'),
'山形鉄道':('GTFS公式掲載確認','未確認','CC BY 4.0掲載','https://www.pref.yamagata.jp/020057/kurashi/kendo/kotsuseisaku/kokyokotsu_gtfs-jp.html'),
'伊勢鉄道':('GTFSリポジトリ掲載確認','未確認','CC BY 4.0掲載','https://gtfs-data.jp/search?target_feed=chitacity%2Achita-aiaibus'),
'万葉線':('GTFS公式掲載確認','VP/TU公式掲載、20秒更新','静的CC0掲載、RT条件要確認','https://opendata.pref.toyama.jp/pages/gtfs_jp.htm'),
'富山地方鉄道':('市内電車GTFS公式掲載、個別法定路線対応は未確認','市内電車VP/TU。本線等へ拡張しない','静的CC0掲載、RT条件要確認','https://opendata.pref.toyama.jp/pages/gtfs_jp.htm'),
'函館市':('市電GTFS公式掲載確認','VP/TU/Alertカタログ確認','GTFS-RU、公認・更新条件要確認','https://www.city.hakodate.hokkaido.jp/docs/2020052700015/'),
'熊本電気鉄道':('電車GTFSリポジトリ掲載確認','鉄道RT未確認、バスRTと区別','CC0掲載','https://gtfs-data.jp/search?pref=%E7%86%8A%E6%9C%AC%E7%9C%8C'),
'熊本市':('市電GTFSリポジトリ掲載確認','未確認','CC BY 2.1 JP掲載、個別許諾確認必要','https://gtfs-data.jp/search?pref=%E7%86%8A%E6%9C%AC%E7%9C%8C'),
}
default=('利用可能な機械形式・許諾・現行全区間対応は未確認','利用可能な機械形式・許諾は未確認','未確認','')
lines=['# 全国事業者・路線別対応状況','',f'基準：[国交省N02-2025]({url})、2025-12-31時点。全国一覧確認日2026-10-01。{len(pairs)}組、事業者名文字列{len({p[0] for p in pairs})}種類。CC BY 4.0、加工あり。','',
'**この一覧は法定路線名の基準一覧と、今回の情報源調査の結果を対応付けたもの。全事業者の全Webページを個別確認した表ではない。** 未確認は存在しないという意味ではない。情報源のカタログ確認と、実ファイルの内容確認と、アプリに収録済みを区別する。限定公開を恒久対応率に数えない。','',
'全行にN02の駅・線形・事業者基礎情報がある。全国の定量的な乗換時間・列車ごとの過去遅延実績は未確認。現在のアプリに収録する列車時刻表は都営6系統のみ。富山地方鉄道の本線・立山・不二越・上滝は市内電車公開で対応済みにしない。JR東日本の新幹線は今回の首都圏GTFS対象外。','',
'| N02事業者名 | N02路線名 | 静的時刻表 | 運行情報・位置・予測 | 許諾区分 | 個別確認日／情報源 |','|---|---|---|---|---|---|']
for op,line in pairs:
    static,rt,license,source=known.get(op,default)
    if op=='東日本旅客鉄道' and '新幹線' in line: static='今回の首都圏GTFS対象外';rt='今回の首都圏位置・RT対象外'
    if op=='富山地方鉄道' and line in ['本線','立山線','不二越線','上滝線']:static='鉄道線の利用可能なGTFS未確認';rt='市内電車RTの対象と扱わない'
    if op=='三国芦原線':static='N02の事業者名／路線名の対応が要確認';rt='未確認'
    reference=f'[2026-10-01]({source})' if source else '未確認（N02一覧だけ確認）'
    lines.append(f'| {op} | {line} | {static} | {rt} | {license} | {reference} |')
(root/'docs'/'NATIONAL-COVERAGE.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
assert len(pairs)==len(set(pairs))
print(len(pairs))
