from pathlib import Path
from struct import pack_into
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


root = Path(__file__).parent
base = {
    '[Content_Types].xml': '''<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>''',
    '_rels/.rels': '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>''',
    'xl/workbook.xml': '''<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>''',
    'xl/_rels/workbook.xml.rels': '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>''',
    'xl/styles.xml': '''<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>''',
    'xl/worksheets/sheet1.xml': '''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Count</t></is></c><c r="C1" t="inlineStr"><is><t>Active</t></is></c><c r="D1" t="inlineStr"><is><t>Created</t></is></c><c r="E1" t="inlineStr"><is><t>Total</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Ada</t></is></c><c r="B2"><v>2</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" s="1"><v>45500</v></c><c r="E2"><f>B2*2</f><v>4</v></c></row></sheetData></worksheet>''',
}


def write(filename, entries):
    with ZipFile(root / filename, 'w', ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            entry = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            archive.writestr(entry, data)


def relocate(worksheet, target):
    entries = {
        name: data.replace('worksheets/sheet1.xml', target)
        for name, data in base.items()
        if name != 'xl/worksheets/sheet1.xml'
    }
    entries['xl/' + target] = worksheet
    return entries


sheet = base['xl/worksheets/sheet1.xml']
write('contacts.xlsx', base)
for filename, replacement in {
    'uncached-formula.xlsx': sheet.replace('<f>B2*2</f><v>4</v>', '<f>B2*2</f>'),
    'malformed-root-formula.xlsx': sheet.replace('<f>B2*2</f><v>4</v>', '<f>B2*2</f>')
        .replace('<worksheet ', '<customRoot ')
        .replace('</worksheet>', '</customRoot>'),
    'oversized-grid.xlsx': sheet.replace('row r="2"', 'row r="1048576"'),
    'encoded-grid.xlsx': sheet.replace('row r="2"', 'row r="&#49;048576"'),
    'namespaced-grid.xlsx': sheet.replace('row r="2"', 'row evil:r="1048576"'),
    'zero-cell.xlsx': sheet.replace('r="A2"', 'r="A0"'),
}.items():
    write(filename, {**base, 'xl/worksheets/sheet1.xml': replacement})

for suffix, target in {
    'relocated': 'data/sheet1.xml',
    'uppercase': 'data/sheet1.XML',
}.items():
    write('contacts-' + suffix + '.xlsx', relocate(sheet, target))
    write(
        'uncached-formula-' + suffix + '.xlsx',
        relocate(sheet.replace('<f>B2*2</f><v>4</v>', '<f>B2*2</f>'), target),
    )
    write(
        'overlimit-grid-' + suffix + '.xlsx',
        relocate(
            sheet.replace('row r="2"', 'row r="5002"').replace('r="A2"', 'r="A5002"'),
            target,
        ),
    )
    write(
        'overlimit-column-' + suffix + '.xlsx',
        relocate(sheet.replace('r="A2"', 'r="BM2"'), target),
    )

write('compressed-bomb.xlsx', {'xl/worksheets/sheet1.xml': ' ' * (17 * 1024 * 1024)})
raw = bytearray((root / 'compressed-bomb.xlsx').read_bytes())
central = raw.find(b'PK\x01\x02')
pack_into('<I', raw, 22, 1)
pack_into('<I', raw, central + 24, 1)
(root / 'forged-bomb.xlsx').write_bytes(raw)

# Valid bounded worksheet: original tab cells expand in JSON, while business rows stay small.
provenance_rows = ''.join(
    f'<row r="{index}"><c r="A{index}" t="inlineStr"><is><t xml:space="preserve">'
    + '\t' * 4096
    + f'</t></is></c><c r="B{index}" t="inlineStr"><is><t>Retained</t></is></c></row>'
    for index in range(2, 2502)
)
provenance_sheet = (
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    '<row r="1"><c r="A1" t="inlineStr"><is><t>Tenant</t></is></c>'
    '<c r="B1" t="inlineStr"><is><t>Name</t></is></c></row>'
    + provenance_rows
    + '</sheetData></worksheet>'
)
write('provenance-overlimit.xlsx', {**base, 'xl/worksheets/sheet1.xml': provenance_sheet})
write('provenance-overlimit-uppercase.xlsx', relocate(provenance_sheet, 'data/sheet1.XML'))
