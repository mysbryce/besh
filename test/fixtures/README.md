# Spreadsheet test fixtures

These are synthetic, minimal Office Open XML workbooks. No personal data or credentials are included. The worksheet uses literal test values: Ada, a numeric count, a Boolean, an Excel date, and a formula with a saved result. The application never computes that formula.

Run `python test/fixtures/generate.py` from the repository root to reproduce every workbook using Python's standard library. Tests use the checked-in files; Python is not required to run Besh or the tests.

| File                          | Behavior                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| `contacts.xlsx`               | Real XLSX import, typed cells, first worksheet and cached formula result    |
| `uncached-formula.xlsx`       | Missing saved formula result requires recalculation and saving in Excel     |
| `malformed-root-formula.xlsx` | A relationship-selected worksheet must have a valid worksheet document root |
| `oversized-grid.xlsx`         | Row coordinate exceeds the 5,000 data-row limit                             |
| `encoded-grid.xlsx`           | Numeric XML character references cannot bypass row limits                   |
| `namespaced-grid.xlsx`        | Attribute prefixes cannot bypass row limits                                 |
| `zero-cell.xlsx`              | Invalid zero-based cell address is rejected                                 |
| `compressed-bomb.xlsx`        | Small compressed archive expands beyond 16 MiB                              |
| `forged-bomb.xlsx`            | False size declarations cannot bypass the bounded decompressor              |

Relocated variants move the worksheet through its workbook relationship to `xl/data/sheet1.xml`. Uppercase variants use `xl/data/sheet1.XML`. Each variant has a valid `contacts-*` workbook, an `uncached-formula-*` workbook, and bounded coordinate fixtures: `overlimit-grid-*` uses row/cell 5002, and `overlimit-column-*` uses column BM (65). These deliberately small coordinates verify preflight rejection without risking a huge parser allocation.
