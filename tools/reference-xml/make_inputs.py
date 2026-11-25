"""Builds the inputs of the report XML comparison from IBA-Salesforce: the Pfizer plant
(rows taken from its reference XML) and the 20-row test plant.

    python3 make_inputs.py <IBA-Salesforce checkout> <output directory>
"""
import json, re, sys, xml.etree.ElementTree as ET
SRC = sys.argv[1]
OUT = sys.argv[2]

sql = open(SRC + '/iba-core/src/main/resources/db/migration/V9_001__Interval_Table.sql').read()
head = re.search(r'INSERT INTO ibacer.intervaltable \(([^)]*)\)', sql).group(1).split(', ')
intervals = []
for m in re.finditer(r"^    \((\d+), (.*)\)[,;]$", sql, re.M):
    vals = [int(m.group(1))] + [v.replace("''", "'") for v in re.findall(r"'((?:[^']|'')*)'", m.group(2))]
    rec = dict(zip(head, vals))
    rec['assettype'] = rec['assettype']
    intervals.append(rec)

root = ET.parse(SRC + '/crgen-iba/src/test/resources/goldenmaster/pfizer/ibareport.xml').getroot()

def kids(el):
    return {c.tag: (c.text or '') for c in el}

def none_if_empty(v):
    return None if v in (None, '') else v

rows = []
for d in root.find('devices'):
    k = kids(d)
    rows.append({
        'device_oid': k['device_oid'],
        'tag_id': none_if_empty(k.get('api_instrumentation_id')),
        'asset_id': k.get('api_asset_id') or k['device_oid'],
        'device_tag': k.get('device_tag'),
        'device_measuringtask': k.get('device_measuringtask'),
        'location_name': k.get('location_name'),
        'device_criticality': k.get('device_criticality'),
        'device_accessibility': k.get('device_accessibility'),
        'device_maint_effectivness': k.get('device_maint_effectivness'),
        'device_conditions': k.get('device_conditions'),
        'device_specialdemands': k.get('device_specialdemands') == '1',
        'device_property_envrelevant': k.get('device_property_envrelevant') == 'true',
        'device_property_safetyrelevant': k.get('device_property_safetyrelevant') == 'true',
        'device_property_qualityrelevant': k.get('device_property_qualityrelevant') == 'true',
        'device_shortname': k.get('device_shortname'),
        'supplier_name': k.get('supplier_name'),
        'device_ordercode': k.get('device_ordercode'),
        'device_serialnumber': k.get('device_serialnumber'),
        'devicetype_spk': k.get('devicetype_spk'),
        'devicetype_label_description': k.get('devicetype_label_description'),
        'device_manufacturingdate': none_if_empty(k.get('device_manufacturingdate', '')[:10]),
        'device_productstatus': k.get('psl_status'),
        'device_activities': k.get('device_activities'),
        'add_ordercode_transform': k.get('add_ordercode_transform'),
        'add_recomend_ordercode': k.get('add_recomend_ordercode'),
        'add_amount_spare': k.get('add_amount_spare'),
        'add_remark1': k.get('add_remark1'),
        'add_remark2': k.get('add_remark2'),
        'add_remark3': k.get('add_remark3'),
        'add_nu_price': float(k['add_nu_price']) if k.get('add_nu_price') else None,
        'reco_insp_interval': none_if_empty(k.get('reco_insp_interval')),
        'reco_calib_interval': none_if_empty(k.get('reco_calib_interval')),
        'reco_valid_interval': none_if_empty(k.get('reco_valid_interval')),
        'device_riskofmaint': k.get('device_riskofmaint'),
        'device_obsolence': k.get('device_obsolence'),
    })

def typed(el, ints=(), bools=()):
    out = {}
    for c in el:
        v = c.text or ''
        if c.tag in ints: out[c.tag] = int(v)
        elif c.tag in bools: out[c.tag] = v == 'true'
        else: out[c.tag] = v
    return out

site = typed(root.find('sitevalue'), ints=('lastAssetCount',) + tuple(c.tag for c in root.find('sitevalue') if c.tag.startswith('slider')),
             bools=tuple(c.tag for c in root.find('sitevalue') if c.tag.endswith('_pagebreak')))
site.pop('implementation_timeline_converted', None)
user = typed(root.find('user'), ints=('u_userid',), bools=('isAdmin', 'lastEntry'))
settings = typed(root.find('reportsettings'), bools=('showHeader', 'hideBudgetPrice'))
pfizer = {'accountId': '0017Q00000PfIzErAAA', 'rows': rows, 'intervals': intervals,
          'sitevalue': site, 'user': user, 'reportsettings': settings}
json.dump(pfizer, open(OUT + '/pfizer.input.json', 'w'), ensure_ascii=False, indent=1)

# The 20 rows of the test plant, as the data intake stores them.
PICK = {'low', 'medium', 'high', 'notset'}
small = []
oid = 1000
for part in ('teil-1', 'teil-2'):
    d = json.load(open(SRC + '/docs/salesforce/testdaten/%s.json' % part))
    for loc in d['location']:
        for r in loc['rows']:
            t, a = r['tag'], r['asset']
            if a is None: continue
            oid += 1
            low = lambda v, ok: (v.lower() if v and v.lower() in ok else None)
            flag = lambda v: v is True or v == 'Yes'
            small.append({
                'device_oid': str(oid), 'tag_id': t['Id'], 'asset_id': a['Id'],
                'device_tag': t.get('Name'), 'device_measuringtask': t.get('FSLEH_ParameterType__c'),
                'location_name': t.get('FSLEH_Location_Name__c') or loc['Name'],
                'device_criticality': low(t.get('FSLEH_Criticality__c'), PICK),
                'device_accessibility': low(t.get('FSLEH_Accessibility__c'), {'easy','moderate','difficult','notset'}),
                'device_maint_effectivness': low(t.get('FSLEH_Maintenance_effectiveness__c'), {'low','medium','high'}),
                'device_conditions': low(t.get('FSLEH_Environmental_Conditions__c'), {'normal','heavy','notset'}),
                'device_specialdemands': flag(t.get('FSLEH_Special_Demands__c')),
                'device_property_envrelevant': flag(t.get('FSLEH_Environmental_Relevant__c')),
                'device_property_safetyrelevant': flag(t.get('FSLEH_Safety_Relevant__c')),
                'device_property_qualityrelevant': flag(t.get('FSLEH_Quality_Relevant__c')),
                'device_shortname': a.get('Name'), 'supplier_name': a.get('Manufacturer_List__c'),
                'device_ordercode': a.get('Order_Code__c'), 'device_serialnumber': a.get('SerialNumber'),
                'devicetype_spk': a.get('Device_Type2__c'), 'devicetype_label_description': a.get('deviceTypeValue'),
                'device_manufacturingdate': a.get('Manufacturing_Date__c') or None,
                'device_productstatus': a.get('FSLEH_Product_Status_Formula__c'),
                'device_activities': ['yes', 'no', None][oid % 3],
                'add_ordercode_transform': None, 'add_recomend_ordercode': 'R & D <neu>' if oid % 4 == 0 else None,
                'add_amount_spare': None, 'add_remark1': 'Zeile 1\nZeile 2 ü' if oid % 5 == 0 else None,
                'add_remark2': None, 'add_remark3': None,
                'add_nu_price': [None, 12.5, 1234.56, 0.1][oid % 4],
                'reco_insp_interval': '24' if oid % 6 == 0 else None, 'reco_calib_interval': None, 'reco_valid_interval': None,
                'device_riskofmaint': ['low', 'normal', 'high', 'notset'][oid % 4],
                'device_obsolence': ['low', 'medium', 'high', 'notset'][oid % 4],
            })
smallsite = dict(site)
smallsite['siteName'] = 'DIBA Testanlage Nord'
smallsite['jobId'] = '0017Q00000TsTdAQAV'
smallsite['lastAssetCount'] = len(small)
smallsite['overview_situation'] = smallsite['overview_situation'] + '<ul><li>eins</li><li>zwei</li></ul>Zeile<br />neu &amp; Gr\u00fc\u00dfe'
smallsite['implementation_timeline'] = ('<table><tbody><tr><td><font color="#007ca9">Standardisation </font></td><td>&nbsp;</td>'
    '<td>Gr\u00fc\u00dfe &amp; Ma\u00df \u20ac \u2013 <b>fett</b></td><td>a<br>b</td></tr><tr><td><p>Absatz</p><p>zwei</p></td>'
    '<td>  viel   Raum \n neu  </td><td><div>block <i>i</i></div></td><td></td></tr></tbody></table>')
smallsite['breakdown_situation'] = 'Kein HTML, nur Text mit > und < und "Anf\u00fchrung"'
smallsite['implementation_head1'] = None
smallsettings = dict(settings)
smallsettings['contactDetails'] = 'Endress+Hauser AG\nK\u00e4genstrasse 2\n4153 Reinach'
smalluser = dict(user)
smalluser['hub_last_name'] = 'DIBA Testanlage Nord'
json.dump({'accountId': '0017Q00000TsTdAQAV', 'rows': small, 'intervals': intervals, 'sitevalue': smallsite,
           'user': smalluser, 'reportsettings': smallsettings}, open(OUT + '/testanlage.input.json', 'w'), ensure_ascii=False, indent=1)
print(len(rows), len(small))
