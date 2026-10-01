"""Build licensed static packages; no scraping. Python 3 standard library only."""
import csv, hashlib, io, json, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
N02 = 'https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip'
TOEI = 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip'

def download(url):
    return urllib.request.urlopen(url, timeout=90).read()

def write(name, data):
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    (OUT / name).write_bytes(raw)
    return {'url': 'data/' + name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def seconds(s):
    h,m,s = map(int,s.split(':'))
    return h*3600+m*60+s

def build(n02, toei):
    z = zipfile.ZipFile(io.BytesIO(n02))
    f = next(n for n in z.namelist() if 'UTF-8' in n and n.endswith('Station.geojson'))
    grouped = {}
    for feature in json.loads(z.read(f))['features']:
        p = feature['properties']; key = str(p['N02_005c'])
        coordinates = feature['geometry']['coordinates']
        if feature['geometry']['type'] == 'MultiLineString': coordinates = coordinates[0]
        lon,lat = coordinates[0][:2]
        station = grouped.setdefault(key, {'id':'n02:'+key,'name':p['N02_005'],'lat':lat,'lon':lon,'operators':[],'lines':[]})
        for field,prop in [('operators','N02_004'),('lines','N02_003')]:
            if p[prop] not in station[field]: station[field].append(p[prop])
    station_meta = write('stations-n02-2025.json', list(grouped.values()))
    z = zipfile.ZipFile(io.BytesIO(toei))
    def rows(name):
        return list(csv.DictReader(io.StringIO(z.read(name).decode('utf-8-sig')))) if name in z.namelist() else []
    info = rows('feed_info.txt')[0]
    stops = [{'id':r['stop_id'],'name':r['stop_name'],'lat':float(r['stop_lat']),'lon':float(r['stop_lon'])} for r in rows('stops.txt')]
    calendars = [{'id':r['service_id'],'start':r['start_date'],'end':r['end_date'],'days':[int(r[d]) for d in ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']]} for r in rows('calendar.txt')]
    exceptions = [{'service':r['service_id'],'date':r['date'],'added':r['exception_type']=='1'} for r in rows('calendar_dates.txt')]
    times = {}
    for r in rows('stop_times.txt'):
        if not r['arrival_time'] or not r['departure_time']:
            if r.get('pickup_type')=='1' and r.get('drop_off_type')=='1': continue # non-stopping passage; never interpolate
            raise ValueError('Missing exact usable stop time')
        times.setdefault(r['trip_id'],[]).append([r['stop_id'], seconds(r['arrival_time']),seconds(r['departure_time']),int(r['stop_sequence']),r.get('pickup_type','0')!='1',r.get('drop_off_type','0')!='1'])
    trips = rows('trips.txt'); packages=[]
    for route in rows('routes.txt'):
        rid=route['route_id']; ident='toei-'+rid
        selected=[{'id':t['trip_id'],'service':t['service_id'],'route':rid,'headsign':t['trip_headsign'],'times':sorted(times[t['trip_id']],key=lambda t:t[3])} for t in trips if t['route_id']==rid]
        used={s[0] for t in selected for s in t['times']}
        # This feed has no transfers: never infer a safe interchange from co-located stops.
        data={'schema':1,'id':ident,'version':info['feed_version'],'validFrom':info['feed_start_date'],'validTo':info['feed_end_date'],'source':TOEI,'license':'CC-BY-4.0','operator':'東京都交通局','routes':[{'id':rid,'name':route['route_long_name']}],'stops':[s for s in stops if s['id'] in used],'calendars':calendars,'exceptions':exceptions,'trips':selected,'transfers':[],'completeTransfers':False,'synthetic':False}
        meta=write(ident+'-'+info['feed_version']+'.json',data)
        packages.append(dict(meta,id=ident,version=info['feed_version'],name=route['route_long_name'],operator='東京都交通局',validFrom=info['feed_start_date'],validTo=info['feed_end_date'],stopNames=sorted({s['name'] for s in data['stops']}),license='CC-BY-4.0',source=TOEI,alternatives=[]))
    for p in packages:
        p['alternatives']=[q['id'] for q in packages if p['id']!=q['id'] and set(p['stopNames'])&set(q['stopNames'])]
    write('manifest.json',{'schema':1,'generatedAt':'2026-10-01','stations':dict(station_meta,version='N02-2025',source=N02,license='CC-BY-4.0',baseline='2025-12-31'),'packages':packages})
    print(json.dumps({'stations':len(grouped),'packages':len(packages),'bytes':sum(p['bytes'] for p in packages)},ensure_ascii=False))

if __name__ == '__main__':
    # Optional files permit reproducible builds from the inspected snapshots.
    build(Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else download(N02),Path(sys.argv[2]).read_bytes() if len(sys.argv)>2 else download(TOEI))
