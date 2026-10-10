const messages: Record<string, string> = {
  'Copy HTML': 'คัดลอก HTML',
  'HTML copied': 'คัดลอก HTML แล้ว',
  'Could not copy HTML. Select and copy the HTML source.':
    'คัดลอก HTML ไม่ได้ เลือกและคัดลอกโค้ด HTML เอง',

  'Advanced element settings': 'ตั้งค่าองค์ประกอบขั้นสูง',
  Element: 'องค์ประกอบ',
  'CSS classes': 'คลาส CSS',
  'Title attribute': 'แอตทริบิวต์ title',
  'Accessibility label': 'ป้ายกำกับสำหรับการเข้าถึง',
  'Use fixed heading identifier': 'ใช้ตัวระบุหัวเรื่องแบบตายตัว',
  Link: 'ลิงก์',
  'List item': 'รายการ',
  Divider: 'เส้นแบ่ง',
  'Line break': 'ขึ้นบรรทัดใหม่',
  Table: 'ตาราง',
  'Table body': 'ส่วนเนื้อหาตาราง',
  'Table row': 'แถวตาราง',
  'Header cell': 'เซลล์หัวตาราง',
  'Table cell': 'เซลล์ตาราง',
  'The preview uses default styles. Custom classes need CSS in your client.':
    'ตัวอย่างใช้รูปแบบเริ่มต้น คลาสที่กำหนดเองต้องมี CSS ในแอปของคุณ',
  'Use up to 8 class names. Start with a letter or underscore; use letters, numbers, underscores or hyphens. Each name uses up to 64 characters.':
    'ใช้ชื่อคลาสได้สูงสุด 8 ชื่อ เริ่มด้วยตัวอักษรภาษาอังกฤษหรือขีดล่าง ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข ขีดล่าง หรือขีดกลาง แต่ละชื่อยาวได้สูงสุด 64 อักขระ',
  'Title and accessibility labels use up to 160 UTF-8 bytes.':
    'ชื่อและป้ายกำกับสำหรับการเข้าถึงยาวได้สูงสุด 160 ไบต์ UTF-8',
  'Besh does not run x-data or load Alpine.js. Use this fixed identifier only with a trusted consumer that you have reviewed.':
    'Besh ไม่รัน x-data หรือโหลด Alpine.js ใช้ตัวระบุแบบตายตัวนี้เฉพาะกับแอปที่นำไปใช้ซึ่งคุณตรวจสอบและเชื่อถือแล้ว',
  'Check class names: up to 8 names, each 1 to 64 ASCII characters.':
    'ตรวจสอบชื่อคลาส: สูงสุด 8 ชื่อ แต่ละชื่อใช้ 1 ถึง 64 อักขระ ASCII',
  'Shorten the title or accessibility label to 160 UTF-8 bytes.':
    'ลดความยาวชื่อหรือป้ายกำกับสำหรับการเข้าถึงให้ไม่เกิน 160 ไบต์ UTF-8',
  'These settings are too large. Remove some settings.':
    'การตั้งค่ามีขนาดใหญ่เกินไป ลบการตั้งค่าบางส่วน',

  'Item {index}': 'รายการที่ {index}',

  'Rich-text field': 'ฟิลด์ข้อความแบบจัดรูปแบบ',
  'Generate HTML preview': 'สร้างตัวอย่าง HTML',
  'HTML source': 'โค้ด HTML',
  'Rendered HTML preview': 'ตัวอย่าง HTML ที่แสดงผล',
  'Visual preview only. Links are inactive. HTML source is available below.':
    'ใช้ดูตัวอย่างเท่านั้น ลิงก์เปิดไม่ได้ ดูโค้ด HTML ได้ด้านล่าง',
  'HTML preview generated.': 'สร้างตัวอย่าง HTML แล้ว',
  'Could not generate HTML preview.': 'สร้างตัวอย่าง HTML ไม่ได้',
  'Could not verify this HTML preview. Generate it again.':
    'ตรวจสอบตัวอย่าง HTML นี้ไม่ได้ สร้างตัวอย่างใหม่อีกครั้ง',
  'Content entry changed. Reload before previewing.':
    'รายการเนื้อหาเปลี่ยนแล้ว โหลดใหม่ก่อนดูตัวอย่าง',

  'Preview HTML': 'ดูตัวอย่าง HTML',
  'Private HTML preview': 'ตัวอย่าง HTML ส่วนตัว',
  'Rich-text fields': 'ฟิลด์ข้อความแบบจัดรูปแบบ',
  'Review the saved entry and fields. This does not save or publish content.':
    'ตรวจสอบรายการและฟิลด์ที่บันทึกไว้ ขั้นตอนนี้ไม่บันทึกหรือเผยแพร่เนื้อหา',
  'Close HTML preview': 'ปิดตัวอย่าง HTML',

  'This list item cannot be outdented safely.':
    'ไม่สามารถลดระดับรายการนี้ได้อย่างปลอดภัย',

  'This document cannot fit a list. Remove some content first.':
    'เอกสารนี้เพิ่มรายการไม่ได้ ลบเนื้อหาบางส่วนก่อน',
  'Indent list': 'เพิ่มระดับรายการ',
  'Outdent list': 'ลดระดับรายการ',
  'This list item cannot be nested further.':
    'รายการนี้ซ้อนลึกกว่านี้ไม่ได้แล้ว',

  'This document cannot fit a quote. Remove some content first.':
    'เอกสารนี้เพิ่มข้อความอ้างอิงไม่ได้ ลบเนื้อหาบางส่วนก่อน',

  'This document cannot fit a table. Remove some content first.':
    'เอกสารนี้เพิ่มตารางไม่ได้ ลบเนื้อหาบางส่วนก่อน',
  'This document cannot fit a divider. Remove some content first.':
    'เอกสารนี้เพิ่มเส้นคั่นไม่ได้ ลบเนื้อหาบางส่วนก่อน',

  'Insert divider': 'แทรกเส้นคั่น',
  'Choose an unformatted paragraph outside lists and tables to create a code block.':
    'เลือกย่อหน้าที่ไม่มีการจัดรูปแบบและอยู่นอกรายการและตารางเพื่อสร้างบล็อกโค้ด',

  'Code block': 'บล็อกโค้ด',
  '{field} code language': '{field} · ภาษาโค้ด',
  'Plain text': 'ข้อความธรรมดา',
  JavaScript: 'JavaScript',
  'Choose a single paragraph outside lists and tables to create a quote.':
    'เลือกย่อหน้าเดียวที่อยู่นอกรายการและตารางเพื่อสร้างข้อความอ้างอิง',

  Quote: 'ข้อความอ้างอิง',

  'Add row': 'เพิ่มแถว',
  'Add column': 'เพิ่มคอลัมน์',
  'This table cannot grow further.': 'ตารางนี้เพิ่มแถวหรือคอลัมน์ไม่ได้แล้ว',
  'Remove row': 'ลบแถว',
  'Remove column': 'ลบคอลัมน์',

  'Insert table': 'แทรกตาราง',

  'Add link': 'เพิ่มลิงก์',
  'Edit link': 'แก้ไขลิงก์',
  'Remove link': 'ลบลิงก์',
  'Link URL': 'URL ของลิงก์',
  'Apply link': 'ใช้ลิงก์',
  'Enter a complete HTTPS URL without credentials.':
    'กรอก URL แบบ HTTPS ให้ครบ โดยไม่มีชื่อผู้ใช้หรือรหัสผ่าน',
  'Select text to add a link.': 'เลือกข้อความเพื่อเพิ่มลิงก์',
  'Apply or cancel the link before saving this entry.':
    'ใช้หรือยกเลิกลิงก์ก่อนบันทึกรายการนี้',

  'Bullet list': 'รายการหัวข้อย่อย',
  'Numbered list': 'รายการลำดับเลข',

  'Formatted rich text': 'ข้อความที่จัดรูปแบบได้',
  '{field} block style': '{field} · รูปแบบบล็อก',
  Paragraph: 'ย่อหน้า',
  'Heading 1': 'หัวข้อ 1',
  'Heading 2': 'หัวข้อ 2',
  'Heading 3': 'หัวข้อ 3',
  'Heading 4': 'หัวข้อ 4',
  'Heading 5': 'หัวข้อ 5',
  'Heading 6': 'หัวข้อ 6',
  Bold: 'ตัวหนา',
  Italic: 'ตัวเอียง',
  Underline: 'ขีดเส้นใต้',
  Strikethrough: 'ขีดทับ',
  'Inline code': 'โค้ดในบรรทัด',
  Undo: 'เลิกทำ',
  Redo: 'ทำซ้ำ',
  '{field} formatting': '{field} · การจัดรูปแบบ',
  'Opening text editor…': 'กำลังเปิดตัวแก้ไขข้อความ…',
  'This content contains formatting this editor cannot edit yet.':
    'เนื้อหานี้มีรูปแบบที่ตัวแก้ไขนี้ยังแก้ไขไม่ได้',
  'Could not open text editor.': 'เปิดตัวแก้ไขข้อความไม่ได้',
  'Formatted text supports headings and emphasis. Pasted content is plain text.':
    'ข้อความแบบจัดรูปแบบรองรับหัวข้อและการเน้นข้อความ เนื้อหาที่วางจะเป็นข้อความธรรมดา',
  'Invalid formatted text.': 'ข้อความแบบจัดรูปแบบไม่ถูกต้อง',

  'Rich text': 'ข้อความแบบมีรูปแบบ',
  'Paragraph text only. Text is stored literally; preview saved HTML from Content.':
    'ใช้ได้เฉพาะข้อความในย่อหน้า ข้อความบันทึกตามที่พิมพ์ ดูตัวอย่าง HTML ของรายการที่บันทึกแล้วได้ในเมนูเนื้อหา',
  '{field} · Paragraph {index}': '{field} · ย่อหน้าที่ {index}',
  '{field} · Paragraph {paragraph} · Text {text}':
    '{field} · ย่อหน้าที่ {paragraph} · ข้อความที่ {text}',
  'Add paragraph to {field}': 'เพิ่มย่อหน้าใน {field}',
  'Add text to {field} · Paragraph {index}':
    'เพิ่มข้อความใน {field} · ย่อหน้าที่ {index}',
  'Remove {field} · Paragraph {index}': 'ลบ {field} · ย่อหน้าที่ {index}',
  'Remove {field} · Paragraph {paragraph} · Text {text}':
    'ลบ {field} · ย่อหน้าที่ {paragraph} · ข้อความที่ {text}',
  'Empty document': 'เอกสารว่าง',
  'Empty paragraph': 'ย่อหน้าว่าง',
  'Rich text is available only for top-level fields.':
    'ข้อความแบบมีรูปแบบใช้ได้เฉพาะฟิลด์ระดับบนสุด',

  'View content model': 'ดูโมเดลเนื้อหา',
  'Hide content model': 'ซ่อนโมเดลเนื้อหา',

  Content: 'เนื้อหา',
  'Create private collections from saved content models. This does not publish content or an API.':
    'สร้างคอลเลกชันส่วนตัวจากโมเดลเนื้อหาที่บันทึกไว้ ยังไม่เผยแพร่เนื้อหาหรือ API',
  'Choose a collection': 'เลือกคอลเลกชัน',
  'New collection': 'คอลเลกชันใหม่',
  'Loading collections…': 'กำลังโหลดคอลเลกชัน…',
  'No collections yet': 'ยังไม่มีคอลเลกชัน',
  'Private collection': 'คอลเลกชันส่วนตัว',
  'Collection name': 'ชื่อคอลเลกชัน',
  'Content model': 'โมเดลเนื้อหา',
  'Save a content model in Content models first, then refresh this catalog.':
    'บันทึกโมเดลในหน้าโมเดลเนื้อหาก่อน แล้วรีเฟรชรายการนี้',
  'Review the saved model revision before creating. Later model edits do not change this collection.':
    'ตรวจสอบเวอร์ชันโมเดลที่บันทึกไว้ก่อนสร้าง การแก้ไขโมเดลภายหลังจะไม่เปลี่ยนคอลเลกชันนี้',
  'Create collection': 'สร้างคอลเลกชัน',
  'Review current content model': 'ตรวจสอบโมเดลเนื้อหาปัจจุบัน',
  'Saved content model': 'โมเดลเนื้อหาที่บันทึกไว้',
  'Content model revision {version}': 'โมเดลเนื้อหาเวอร์ชัน {version}',
  Required: 'จำเป็น',
  Optional: 'ไม่บังคับ',
  'List item type': 'ชนิดรายการในลิสต์',
  'Discard unsaved collection changes?':
    'ละทิ้งการเปลี่ยนแปลงคอลเลกชันที่ยังไม่ได้บันทึกหรือไม่?',
  'Could not load collections.': 'โหลดคอลเลกชันไม่สำเร็จ',
  'Content model ready for review.': 'โมเดลเนื้อหาพร้อมให้ตรวจสอบ',
  'Collection loaded.': 'โหลดคอลเลกชันแล้ว',
  'Could not load collection.': 'โหลดคอลเลกชันไม่สำเร็จ',
  'Private collection created.': 'สร้างคอลเลกชันส่วนตัวแล้ว',
  'Could not create collection.': 'สร้างคอลเลกชันไม่สำเร็จ',
  'Discard unsaved entry changes?':
    'ละทิ้งการเปลี่ยนแปลงรายการที่ยังไม่ได้บันทึกหรือไม่?',

  'Check the value for {field}.': 'ตรวจสอบค่าของ {field}',
  'Enter a finite number for {field}.':
    'กรอกตัวเลขที่ไม่เป็นอนันต์สำหรับ {field}',
  'Choose a value for {field}.': 'เลือกค่าของ {field}',
  'Include the required field {field}.': 'รวมฟิลด์ที่จำเป็น {field}',
  'This entry is too large. Shorten text or remove list items.':
    'รายการนี้ใหญ่เกินไป ลดข้อความหรือลบรายการในลิสต์',
  'Include {field}': 'รวม {field}',
  'Choose a value': 'เลือกค่า',
  '{field} item {index}': '{field} รายการที่ {index}',
  'Remove {field} item {index}': 'ลบ {field} รายการที่ {index}',
  'Empty list': 'ลิสต์ว่าง',
  'Add item to {field}': 'เพิ่มรายการใน {field}',

  'Could not load entries.': 'โหลดรายการไม่สำเร็จ',
  'New entry': 'รายการใหม่',
  'Entry loaded.': 'โหลดรายการแล้ว',
  'Could not load entry.': 'โหลดรายการไม่สำเร็จ',
  'Private entry created.': 'สร้างรายการส่วนตัวแล้ว',
  'Could not create entry.': 'สร้างรายการไม่สำเร็จ',
  Entries: 'รายการ',
  'Refresh entries': 'รีเฟรชรายการ',
  'Loading entries…': 'กำลังโหลดรายการ…',
  'Revision {version}': 'เวอร์ชัน {version}',
  'No entries yet': 'ยังไม่มีรายการ',
  'Previous entries': 'รายการก่อนหน้า',
  '{total} saved entries': 'บันทึกไว้ {total} รายการ',
  'Next entries': 'รายการถัดไป',
  'Saved entry': 'รายการที่บันทึกไว้',
  'Entry revision {version}': 'รายการเวอร์ชัน {version}',
  'Optional fields are omitted unless included. Empty text, zero, false, empty groups and empty lists are allowed when they match this model.':
    'ฟิลด์ที่ไม่บังคับจะไม่ถูกบันทึกหากไม่ได้เลือกให้รวม ข้อความว่าง ศูนย์ เท็จ กลุ่มว่าง และลิสต์ว่างใช้ได้หากตรงกับโมเดลนี้',

  'Create entry': 'สร้างรายการ',
  'Edit entry': 'แก้ไขรายการ',
  'Reload entry': 'โหลดรายการอีกครั้ง',
  'Save entry': 'บันทึกรายการ',
  'Entry saved.': 'บันทึกรายการแล้ว',
  'Could not save entry.': 'บันทึกรายการไม่สำเร็จ',

  'Delete entry': 'ลบรายการ',
  'Delete this saved entry? This permanently removes its saved content and discards any unsaved entry changes.':
    'ลบรายการที่บันทึกไว้นี้หรือไม่? เนื้อหาที่บันทึกไว้จะถูกลบถาวร และการเปลี่ยนแปลงรายการที่ยังไม่ได้บันทึกจะถูกละทิ้ง',
  'Entry deleted.': 'ลบรายการแล้ว',
  'Could not delete entry.': 'ลบรายการไม่สำเร็จ',

  'Struct draft changed. Review before creating.':
    'ฉบับร่าง Struct เปลี่ยนแล้ว ตรวจสอบก่อนสร้าง',
  'Content entry changed. Reload before saving.':
    'รายการเนื้อหาเปลี่ยนแล้ว โหลดอีกครั้งก่อนบันทึก',
  'Content entry changed. Reload before deleting.':
    'รายการเนื้อหาเปลี่ยนแล้ว โหลดอีกครั้งก่อนลบ',

  'Content models': 'โมเดลเนื้อหา',
  'Define record fields with forms. This draft does not publish content or an API.':
    'กำหนดฟิลด์ของข้อมูลด้วยแบบฟอร์ม ฉบับร่างนี้ยังไม่เผยแพร่เนื้อหาหรือ API',
  'New model': 'โมเดลใหม่',
  'Model name': 'ชื่อโมเดล',
  'Choose a model': 'เลือกโมเดล',
  'No content models yet': 'ยังไม่มีโมเดลเนื้อหา',
  'Loading content models…': 'กำลังโหลดโมเดลเนื้อหา…',
  'Model draft': 'ฉบับร่างโมเดล',
  'Draft revision {version}': 'ฉบับร่างเวอร์ชัน {version}',
  'Add field': 'เพิ่มฟิลด์',
  'No fields yet': 'ยังไม่มีฟิลด์',
  'Field {path}': 'ฟิลด์ {path}',
  'Field {path} label': 'ชื่อแสดงของฟิลด์ {path}',
  'Field {path} key': 'คีย์ของฟิลด์ {path}',
  'Field {path} type': 'ชนิดของฟิลด์ {path}',
  'Field {path} required': 'ฟิลด์ {path} ต้องมีค่า',
  'Field {path} item type': 'ชนิดรายการของฟิลด์ {path}',
  'Add field to {path}': 'เพิ่มฟิลด์ใน {path}',
  'Remove field {path}': 'ลบฟิลด์ {path}',
  Group: 'กลุ่ม',
  List: 'รายการ',
  Choice: 'ตัวเลือก',
  'Choices for {path}': 'ตัวเลือกของ {path}',
  'Add option to {path}': 'เพิ่มตัวเลือกใน {path}',
  'Remove option {path}': 'ลบตัวเลือก {path}',
  'Option {path} value': 'ค่าของตัวเลือก {path}',
  'Option {path} label': 'ชื่อแสดงของตัวเลือก {path}',
  'Keys start with a lowercase letter and use lowercase letters, numbers, or underscores. Reserved names are not allowed.':
    'คีย์ต้องเริ่มด้วยตัวอักษรภาษาอังกฤษพิมพ์เล็ก ใช้ตัวอักษรพิมพ์เล็ก ตัวเลข หรือขีดล่าง ห้ามใช้ชื่อสงวน',
  'Use up to 32 fields per group, 32 choices per field, and 6 nesting levels. Each model supports up to 128 fields and nested item types.':
    'แต่ละกลุ่มมีได้ไม่เกิน 32 ฟิลด์ แต่ละฟิลด์มีได้ไม่เกิน 32 ตัวเลือก และซ้อนได้ 6 ระดับ แต่ละโมเดลมีฟิลด์และชนิดรายการที่ซ้อนกันรวมได้ไม่เกิน 128 รายการ',
  'Enter a model name with 1 to 80 characters.':
    'ใส่ชื่อโมเดลยาว 1 ถึง 80 ตัวอักษร',
  'Complete every field with a valid, unique key and a label of 1 to 80 characters.':
    'ทุกฟิลด์ต้องมีคีย์ที่ถูกต้องและไม่ซ้ำ พร้อมชื่อแสดงยาว 1 ถึง 80 ตัวอักษร',
  'Choices need at least one option. Values must be unique. Values and labels use 1 to 80 characters.':
    'ต้องมีอย่างน้อยหนึ่งตัวเลือก ค่าแต่ละตัวต้องไม่ซ้ำ ค่าและชื่อแสดงต้องยาว 1 ถึง 80 ตัวอักษร',
  'Content model draft saved.': 'บันทึกฉบับร่างโมเดลเนื้อหาแล้ว',
  'Could not load content models.': 'โหลดรายการโมเดลเนื้อหาไม่ได้',
  'Could not load content model.': 'โหลดโมเดลเนื้อหาไม่ได้',
  'Could not save content model.': 'บันทึกโมเดลเนื้อหาไม่ได้',
  'Reload saved version': 'โหลดเวอร์ชันที่บันทึกไว้อีกครั้ง',
  'Discard unsaved content model changes?':
    'ละทิ้งการเปลี่ยนแปลงโมเดลเนื้อหาที่ยังไม่ได้บันทึกหรือไม่?',
  'Changing this type removes its nested fields or choices. Continue?':
    'การเปลี่ยนชนิดนี้จะลบฟิลด์หรือตัวเลือกที่ซ้อนอยู่ ดำเนินการต่อหรือไม่?',
  'READ A SAVED DATABASE COPY': 'อ่านสำเนาฐานข้อมูลที่บันทึกไว้',
  'Choose a SQLite copy, review its tables, then build a read API.':
    'เลือกสำเนา SQLite ตรวจสอบตาราง แล้วสร้าง API สำหรับอ่านข้อมูล',
  'Refresh connections': 'รีเฟรชรายการการเชื่อมต่อ',
  'SQLite uploaded copy · read-only':
    'สำเนา SQLite ที่อัปโหลด · อ่านอย่างเดียว',
  'This is an uploaded read-only copy. Changes to your original database are not synced.':
    'นี่คือสำเนาที่อัปโหลดสำหรับอ่านอย่างเดียว การเปลี่ยนแปลงในฐานข้อมูลต้นฉบับจะไม่ซิงก์มายังสำเนานี้',
  'Upload an ordinary SQLite file up to 2 MiB. No database address, server credentials, or SQL is needed.':
    'อัปโหลดไฟล์ SQLite ทั่วไปขนาดไม่เกิน 2 MiB ไม่ต้องใช้ที่อยู่ฐานข้อมูล ข้อมูลเข้าสู่ระบบเซิร์ฟเวอร์ หรือ SQL',
  'Loading SQLite copies…': 'กำลังโหลดสำเนา SQLite…',
  'Upload a SQLite copy': 'อัปโหลดสำเนา SQLite',
  'Manage database connections access is needed to upload, check, or delete copies.':
    'ต้องมีสิทธิ์จัดการการเชื่อมต่อฐานข้อมูลเพื่ออัปโหลด ตรวจสอบ หรือลบสำเนา',
  'Connection name': 'ชื่อการเชื่อมต่อ',
  'SQLite file': 'ไฟล์ SQLite',
  'Upload read-only copy': 'อัปโหลดสำเนาแบบอ่านอย่างเดียว',
  'Read database connections access is needed to list saved copies, preview rows, or choose API fields.':
    'ต้องมีสิทธิ์อ่านการเชื่อมต่อฐานข้อมูลเพื่อดูรายการสำเนาที่บันทึกไว้ ดูตัวอย่างแถวข้อมูล หรือเลือกฟิลด์ API',
  'No SQLite copies yet': 'ยังไม่มีสำเนา SQLite',
  'Upload a copy to review its ordinary tables and saved rows.':
    'อัปโหลดสำเนาเพื่อตรวจสอบตารางทั่วไปและแถวข้อมูลที่บันทึกไว้',
  'Saved SQLite copies': 'สำเนา SQLite ที่บันทึกไว้',
  'Read-only · v{version}': 'อ่านอย่างเดียว · v{version}',
  'Database connection': 'การเชื่อมต่อฐานข้อมูล',
  '{count} tables · {size} KiB saved copy. Published APIs read this copy.':
    '{count} ตาราง · สำเนาที่บันทึกไว้ขนาด {size} KiB API ที่เผยแพร่แล้วจะอ่านสำเนานี้',
  'SQLite copy uploaded. Review its table and returned columns.':
    'อัปโหลดสำเนา SQLite แล้ว ตรวจสอบตารางและคอลัมน์ที่จะส่งกลับ',
  'Database connections refreshed.': 'รีเฟรชรายการการเชื่อมต่อฐานข้อมูลแล้ว',
  'Loading data sources…': 'กำลังโหลดแหล่งข้อมูล…',
  'Read data sources access is needed to browse saved sources.':
    'ต้องมีสิทธิ์อ่านแหล่งข้อมูลเพื่อดูแหล่งข้อมูลที่บันทึกไว้',
  'Choose a data source': 'เลือกแหล่งข้อมูล',
  'Showing {shown} of {total} rows. Version {version} · Saved {saved}':
    'แสดง {shown} จาก {total} แถว เวอร์ชัน {version} · บันทึกเมื่อ {saved}',
  'Sheet: {sheet}': 'ชีต: {sheet}',
  'Data sources refreshed.': 'รีเฟรชรายการแหล่งข้อมูลแล้ว',
  'Delete data source': 'ลบแหล่งข้อมูล',
  'Data sources used by a draft or published API cannot be deleted.':
    'แหล่งข้อมูลที่ใช้โดย API ฉบับร่างหรือ API ที่เผยแพร่อยู่ไม่สามารถลบได้',
  'Delete data source {source}? This cannot be undone.':
    'ลบแหล่งข้อมูล {source} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
  'Data source deleted.': 'ลบแหล่งข้อมูลแล้ว',
  'Google Sheets link': 'ลิงก์ Google Sheets',
  'Import Google Sheet': 'นำเข้า Google Sheet',
  'Share the sheet for anyone with the link to view. We save its current rows; changes are imported only when you refresh saved data. For a private sheet, upload Excel or CSV instead.':
    'แชร์ชีตให้ทุกคนที่มีลิงก์ดูได้ เราบันทึกแถวข้อมูลปัจจุบันไว้ การเปลี่ยนแปลงจะนำเข้าเมื่อคุณรีเฟรชข้อมูลที่บันทึกไว้เท่านั้น หากเป็นชีตส่วนตัว ให้อัปโหลด Excel หรือ CSV แทน',
  'Open Google Sheet': 'เปิด Google Sheet',
  'Refresh saved data': 'รีเฟรชข้อมูลที่บันทึกไว้',
  'This is a saved snapshot. Refresh imports changes from Google Sheets for APIs using this source.':
    'นี่คือข้อมูลที่บันทึกไว้ การรีเฟรชจะนำเข้าการเปลี่ยนแปลงจาก Google Sheets ให้ API ที่ใช้แหล่งข้อมูลนี้',
  'Refresh saved data for {source}? APIs using this source will read the new Google Sheets snapshot.':
    'รีเฟรชข้อมูลที่บันทึกไว้ของ {source} หรือไม่? API ที่ใช้แหล่งข้อมูลนี้จะอ่านข้อมูลชุดใหม่จาก Google Sheets',
  'Google Sheet refreshed. Your APIs now use the saved data.':
    'รีเฟรช Google Sheet แล้ว ตอนนี้ API ของคุณใช้ข้อมูลที่บันทึกไว้',
  'Manage data sources access is needed to import or change saved rows.':
    'ต้องมีสิทธิ์จัดการแหล่งข้อมูลเพื่อนำเข้าหรือเปลี่ยนแถวข้อมูลที่บันทึกไว้',
  'Replacement spreadsheet': 'ไฟล์สเปรดชีตใหม่',
  'Replace spreadsheet': 'แทนที่สเปรดชีต',
  'Replaces saved rows used by your APIs. Keep published columns and their types compatible.':
    'แทนที่แถวข้อมูลที่บันทึกไว้ซึ่ง API ของคุณใช้อยู่ คอลัมน์และชนิดข้อมูลต้องยังรองรับ API ที่เผยแพร่แล้ว',
  'Replace saved data for {source}? APIs using this source will read the new snapshot.':
    'แทนที่ข้อมูลที่บันทึกไว้ของ {source} หรือไม่? API ที่ใช้แหล่งข้อมูลนี้จะอ่านข้อมูลชุดใหม่',
  'Spreadsheet replaced. Your APIs now use the saved data.':
    'แทนที่สเปรดชีตแล้ว ตอนนี้ API ของคุณใช้ข้อมูลที่บันทึกไว้',
  'FROM SPREADSHEET TO API': 'จากสเปรดชีตสู่ API',
  'Bring your data. Preview its columns. Build an API without writing JSON.':
    'นำข้อมูลของคุณมา ดูตัวอย่างคอลัมน์ แล้วสร้าง API โดยไม่ต้องเขียน JSON',
  'Refresh list': 'รีเฟรชรายการ',
  'Import a spreadsheet': 'นำเข้าสเปรดชีต',
  'Check your data': 'ตรวจสอบข้อมูล',
  'Choose API fields': 'เลือกฟิลด์ API',
  'Add a data source': 'เพิ่มแหล่งข้อมูล',
  'Import method': 'วิธีนำเข้า',
  'Spreadsheet file': 'ไฟล์สเปรดชีต',
  'Public Google Sheet': 'Google Sheet สาธารณะ',
  'Source name': 'ชื่อแหล่งข้อมูล',
  Products: 'สินค้า',
  'Import spreadsheet': 'นำเข้าสเปรดชีต',
  'CSV or Excel (.xlsx), up to 2 MB. Put column names in the first row. Imports save a snapshot of your data.':
    'CSV หรือ Excel (.xlsx) ขนาดไม่เกิน 2 MB ใส่ชื่อคอลัมน์ในแถวแรก การนำเข้าจะบันทึกภาพข้อมูล ณ เวลานั้น',
  'No data sources yet.': 'ยังไม่มีแหล่งข้อมูล',
  'Import a spreadsheet to see your data here.':
    'นำเข้าสเปรดชีตเพื่อดูข้อมูลที่นี่',
  'Spreadsheet imported. Check your data before creating an API.':
    'นำเข้าสเปรดชีตแล้ว ตรวจสอบข้อมูลก่อนสร้าง API',
  'Saved data source': 'แหล่งข้อมูลที่บันทึกไว้',
  '{source} · {count} rows': '{source} · {count} แถว',
  '{count} rows': '{count} แถว',
  'Empty cells allowed': 'อนุญาตเซลล์ว่าง',
  Empty: 'ว่าง',
  'Use an exact path, such as /v1/messages. WebSocket messages carry input values; named path parameters are not supported.':
    'ใช้เส้นทางที่ตรงตามที่ระบุ เช่น /v1/messages ข้อความ WebSocket ใช้ส่งค่าข้อมูลเข้า ไม่รองรับพารามิเตอร์เส้นทางที่มีชื่อ',
  'Use an exact path, such as /v1/customers. GraphQL arguments carry input values.':
    'ใช้เส้นทางที่ตรงตามที่ระบุ เช่น /v1/customers อาร์กิวเมนต์ GraphQL ใช้ส่งค่าข้อมูลเข้า',
  'GRAPHQL OPERATION': 'การดำเนินการ GRAPHQL',
  'Live · v{version}': 'ใช้งานจริง · v{version}',
  'Saved · revision {revision}': 'บันทึกแล้ว · ฉบับแก้ไข {revision}',
  '{nodes} nodes · {connections} connections':
    '{nodes} ขั้นตอน · {connections} การเชื่อมต่อ',
  'Use /v1/customers/:id for a versioned route with a path parameter. Each :name occupies a whole route segment.':
    'ใช้ /v1/customers/:id สำหรับเส้นทางที่ระบุเวอร์ชันและมีพารามิเตอร์ในเส้นทาง แต่ละ :name ต้องเป็นหนึ่งส่วนเต็มของเส้นทาง',
  'Owner and member keys manage drafts. Create an API key in API keys to call a published endpoint.':
    'คีย์เจ้าของและสมาชิกใช้จัดการฉบับร่าง สร้างคีย์ API ในหน้าคีย์ API เพื่อเรียกปลายทางที่เผยแพร่แล้ว',
  'REQUEST DETAILS': 'รายละเอียดคำขอ',
  '// Save your draft, then run a test.\n// Your response will appear here.':
    '// บันทึกฉบับร่าง แล้วรันทดสอบ\n// คำตอบของคุณจะแสดงที่นี่',
  'Discard unsaved draft changes?':
    'ละทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่ได้บันทึกหรือไม่?',
  'Start with your spreadsheet, or build a blank API using the request and response below. Opening either path does not save or publish an API. You choose when to create or save its draft.':
    'เริ่มจากสเปรดชีตของคุณ หรือสร้าง API เปล่าโดยใช้คำขอและคำตอบด้านล่าง การเปิดเส้นทางใดก็ตามจะไม่บันทึกหรือเผยแพร่ API คุณเลือกเองว่าจะสร้างหรือบันทึกฉบับร่างเมื่อใด',
  'Your next idea starts here.': 'ไอเดียถัดไปของคุณเริ่มที่นี่',
  'Create your first API.': 'สร้าง API แรกของคุณ',
  'Your team': 'ทีมของคุณ',
  'WORKSPACE CONTROL': 'การควบคุมพื้นที่ทำงาน',
  'Member keys manage the workspace. Use API keys for published endpoint callers.':
    'คีย์สมาชิกใช้จัดการพื้นที่ทำงาน ใช้คีย์ API สำหรับผู้เรียกปลายทางที่เผยแพร่แล้ว',
  'Loading workspace records…': 'กำลังโหลดระเบียนพื้นที่ทำงาน…',
  'Only the owner can manage members and roles.':
    'เฉพาะเจ้าของเท่านั้นที่จัดการสมาชิกและบทบาทได้',
  'Refresh Members and review an active tenant before creating this member.':
    'โหลดหน้าสมาชิกใหม่และตรวจสอบผู้เช่าที่ใช้งานอยู่ก่อนสร้างสมาชิกนี้',
  'Create {name} with assigned tenant {tenant}? Protected API actions derive this identity. API permissions and dependency USE remain separate. This assignment and member credential are created together.':
    'สร้าง {name} พร้อมมอบหมายผู้เช่า {tenant} หรือไม่? การดำเนินการ API ที่ปกป้องไว้ใช้ตัวตนนี้ สิทธิ์ API และสิทธิ์ USE ของทรัพยากรที่เกี่ยวข้องยังแยกจากกัน การมอบหมายนี้และข้อมูลรับรองสมาชิกจะสร้างพร้อมกัน',
  'Member created. Save their token; it is shown once.':
    'สร้างสมาชิกแล้ว เก็บโทเคนของสมาชิกไว้ เพราะแสดงเพียงครั้งเดียว',
  Name: 'ชื่อ',
  'Member name': 'ชื่อสมาชิก',
  Role: 'บทบาท',
  'Member role': 'บทบาทสมาชิก',
  'Member email (optional)': 'อีเมลสมาชิก (ไม่บังคับ)',
  'Member password': 'รหัสผ่านสมาชิก',
  '12 to 128 characters. Leave email blank for key-only access.':
    '12 ถึง 128 อักขระ เว้นอีเมลว่างไว้เพื่อใช้คีย์เข้าถึงเท่านั้น',
  'New member API access': 'สิทธิ์เข้าถึง API ของสมาชิกใหม่',
  'New member tenant': 'ผู้เช่าของสมาชิกใหม่',
  'No tenant assigned': 'ยังไม่ได้มอบหมายผู้เช่า',
  'Optional initial assignment. Review before adding the member; no separate credential creation and reassignment occurs.':
    'การมอบหมายเริ่มต้นเป็นทางเลือก ตรวจสอบก่อนเพิ่มสมาชิก จะไม่มีการสร้างข้อมูลรับรองแยกแล้วมอบหมายใหม่',
  'Add member': 'เพิ่มสมาชิก',
  'Save this member token': 'เก็บโทเคนสมาชิกนี้ไว้',
  'New member token': 'โทเคนสมาชิกใหม่',
  'Member token copied.': 'คัดลอกโทเคนสมาชิกแล้ว',
  Copy: 'คัดลอก',
  'I saved it': 'บันทึกไว้แล้ว',
  'Opening invitations…': 'กำลังเปิดคำเชิญ…',
  'API access': 'สิทธิ์เข้าถึง API',
  'Tenant identity': 'ตัวตนผู้เช่า',
  'Invite sign-in': 'เชิญตั้งค่าการเข้าสู่ระบบ',
  'Bootstrap owner': 'เจ้าของที่สร้างตอนเริ่มต้น',
  'Revoke access for {name}?': 'เพิกถอนสิทธิ์เข้าถึงของ {name} หรือไม่?',
  'Member access revoked.': 'เพิกถอนสิทธิ์เข้าถึงของสมาชิกแล้ว',
  'Selected APIs · {count}': 'API ที่เลือก · {count}',
  'Manage APIs for {name}': 'จัดการ API ของ {name}',
  'Owner access cannot be restricted.':
    'ไม่สามารถจำกัดสิทธิ์เข้าถึงของเจ้าของได้',
  'Owner reviews a tenant for each protected action.':
    'เจ้าของตรวจสอบผู้เช่าสำหรับการดำเนินการที่ปกป้องไว้แต่ละครั้ง',
  'Assigned tenant': 'ผู้เช่าที่มอบหมาย',
  'Manage tenant for {name}': 'จัดการผู้เช่าของ {name}',
  'Viewer · read APIs': 'ผู้ดู · อ่าน API',
  'Editor · build and test': 'ผู้แก้ไข · สร้างและทดสอบ',
  '{name} · custom role': '{name} · บทบาทกำหนดเอง',
  'Role for {name}': 'บทบาทของ {name}',
  "Change {name}'s role from {current} to {next}? This ends their active browser sessions. Their member key immediately uses the new permissions.":
    'เปลี่ยนบทบาทของ {name} จาก {current} เป็น {next} หรือไม่? การกระทำนี้สิ้นสุดเซสชันเบราว์เซอร์ที่ใช้งานอยู่ของสมาชิก คีย์สมาชิกจะใช้สิทธิ์ใหม่ทันที',
  'Member role updated. Their browser sessions were ended.':
    'อัปเดตบทบาทสมาชิกแล้ว เซสชันเบราว์เซอร์ของสมาชิกสิ้นสุดแล้ว',
  'Could not update member role.': 'อัปเดตบทบาทสมาชิกไม่สำเร็จ',
  'Change role': 'เปลี่ยนบทบาท',
  'Selected APIs only': 'เฉพาะ API ที่เลือก',
  'Selected sharing limits API scope. Use Viewer or a custom role with only API, runtime-key and load-test actions. Actions still require separate role grants. It grants no API creation or global resource management.':
    'การแชร์แบบเลือกจำกัดขอบเขต API ใช้บทบาทผู้ดูหรือบทบาทกำหนดเองที่มีเฉพาะการดำเนินการ API คีย์สำหรับเรียกใช้งาน และการทดสอบโหลด การดำเนินการยังต้องมีสิทธิ์จากบทบาทแยกต่างหาก ไม่ให้สิทธิ์สร้าง API หรือจัดการทรัพยากรทั้งหมดของพื้นที่ทำงาน',
  'This role has actions beyond Read APIs and selected API operations. Choose an eligible custom role or Viewer, or explicitly select All APIs before continuing.':
    'บทบาทนี้มีการดำเนินการนอกเหนือจากการอ่าน API และการดำเนินการกับ API ที่เลือก เลือกบทบาทกำหนดเองที่เข้าเกณฑ์หรือบทบาทผู้ดู หรือเลือก API ทั้งหมดอย่างชัดเจนก่อนดำเนินการต่อ',
  'Choose APIs to share': 'เลือก API ที่จะแชร์',
  'Share {name}': 'แชร์ {name}',
  '{count} APIs selected.': 'เลือก {count} API แล้ว',
  'No APIs selected. This member can sign in, but sees no APIs.':
    'ยังไม่ได้เลือก API สมาชิกนี้เข้าสู่ระบบได้ แต่จะไม่เห็น API ใด',
  'Dependencies these APIs may use': 'ทรัพยากรที่ API เหล่านี้ใช้ได้',
  'USE permits these selected APIs to read chosen dependency data or trigger product login when the role allows testing, publishing or callers. It can expose stored data through the API. It grants no dependency preview or management. Row, column and tenant authorization remain separate; selecting APIs or dependencies does not provide them.':
    'สิทธิ์ USE อนุญาตให้ API ที่เลือกอ่านข้อมูลจากทรัพยากรที่เลือกหรือเริ่มการเข้าสู่ระบบผลิตภัณฑ์เมื่อบทบาทอนุญาตให้ทดสอบ เผยแพร่ หรือเรียกใช้งาน API ได้ อาจเปิดเผยข้อมูลที่เก็บไว้ผ่าน API แต่ไม่ให้สิทธิ์ดูตัวอย่างหรือจัดการทรัพยากรนั้น การอนุญาตระดับแถว คอลัมน์ และผู้เช่ายังแยกจากกัน การเลือก API หรือทรัพยากรไม่ได้ให้สิทธิ์เหล่านี้',
  'Use spreadsheet sources': 'ใช้แหล่งข้อมูลสเปรดชีต',
  'Use SQLite copies': 'ใช้สำเนา SQLite',
  'Use product login connections': 'ใช้การเชื่อมต่อเข้าสู่ระบบผลิตภัณฑ์',
  'Use spreadsheet {name}': 'ใช้สเปรดชีต {name}',
  'Use SQLite copy {name}': 'ใช้สำเนา SQLite {name}',
  'Use product login {name}': 'ใช้การเข้าสู่ระบบผลิตภัณฑ์ {name}',
  'Structure only · version {version}': 'เฉพาะโครงสร้าง · เวอร์ชัน {version}',
  'No saved dependencies in this group.':
    'ยังไม่มีทรัพยากรที่บันทึกไว้ในกลุ่มนี้',
  '{count} dependencies allowed for USE.': 'อนุญาต USE สำหรับ {count} ทรัพยากร',
  'All current and future APIs. Actions still follow the assigned role.':
    'API ทั้งหมดในปัจจุบันและอนาคต การดำเนินการยังเป็นไปตามบทบาทที่มอบหมาย',
  'Custom roles': 'บทบาทกำหนดเอง',
  'New role': 'บทบาทใหม่',
  'Choose actions for this local workspace. Every member can manage their own account and sessions. Member and role administration stays with the owner.':
    'เลือกการดำเนินการสำหรับพื้นที่ทำงานในเครื่องนี้ สมาชิกทุกคนจัดการบัญชีและเซสชันของตนเองได้ การจัดการสมาชิกและบทบาทเป็นหน้าที่ของเจ้าของ',
  'Actions are separate: editing, testing, and publication each need their own grant. Reading related APIs or connections is needed to choose them in forms.':
    'การดำเนินการแยกจากกัน การแก้ไข การทดสอบ และการเผยแพร่ต้องมีสิทธิ์ของตนเอง ต้องมีสิทธิ์อ่าน API หรือการเชื่อมต่อที่เกี่ยวข้องจึงจะเลือกในแบบฟอร์มได้',
  'Loading permission choices…': 'กำลังโหลดตัวเลือกสิทธิ์…',
  'Retry permission choices': 'ลองโหลดตัวเลือกสิทธิ์อีกครั้ง',
  'Save changes to {name}? Changed grants apply immediately to member keys and end affected browser sessions. Review all selected permissions before continuing.':
    'บันทึกการเปลี่ยนแปลงของ {name} หรือไม่? สิทธิ์ที่เปลี่ยนจะมีผลกับคีย์สมาชิกทันทีและสิ้นสุดเซสชันเบราว์เซอร์ที่ได้รับผลกระทบ ตรวจสอบสิทธิ์ทั้งหมดที่เลือกก่อนดำเนินการต่อ',
  'Role updated. Changed grants end affected browser sessions.':
    'อัปเดตบทบาทแล้ว สิทธิ์ที่เปลี่ยนจะสิ้นสุดเซสชันเบราว์เซอร์ที่ได้รับผลกระทบ',
  'Role created. Assign it to a member when ready.':
    'สร้างบทบาทแล้ว มอบหมายให้สมาชิกเมื่อพร้อม',
  'Could not save role.': 'บันทึกบทบาทไม่สำเร็จ',
  'Edit {name} · version {version}': 'แก้ไข {name} · เวอร์ชัน {version}',
  'Create custom role': 'สร้างบทบาทกำหนดเอง',
  'Role name': 'ชื่อบทบาท',
  'No workspace action grants. Members with this role can still sign in and manage their own account.':
    'ไม่มีสิทธิ์ดำเนินการในพื้นที่ทำงาน สมาชิกที่มีบทบาทนี้ยังเข้าสู่ระบบและจัดการบัญชีของตนเองได้',
  'Backup access exposes the entire workspace, including saved data and sensitive credential records. Keep downloads private.':
    'การเข้าถึงข้อมูลสำรองเปิดเผยทั้งพื้นที่ทำงาน รวมถึงข้อมูลที่บันทึกไว้และระเบียนข้อมูลรับรองที่ละเอียดอ่อน เก็บไฟล์ที่ดาวน์โหลดเป็นส่วนตัว',
  'Load testing repeatedly executes live APIs. Configured writes can change product data. Grant only to trusted operators.':
    'การทดสอบโหลดเรียกใช้ API ที่เผยแพร่อยู่ซ้ำ ๆ การเขียนข้อมูลที่ตั้งค่าไว้อาจเปลี่ยนข้อมูลผลิตภัณฑ์ ให้สิทธิ์เฉพาะผู้ดำเนินการที่เชื่อถือได้',
  'Save role': 'บันทึกบทบาท',
  'Cancel role changes': 'ยกเลิกการเปลี่ยนบทบาท',
  'If another owner session changes this role, refresh the members page and reopen the role before saving again.':
    'หากเซสชันเจ้าของอื่นเปลี่ยนบทบาทนี้ ให้โหลดหน้าสมาชิกใหม่และเปิดบทบาทอีกครั้งก่อนบันทึกอีกครั้ง',
  'Custom · v{version}': 'กำหนดเอง · v{version}',
  'Account and own sessions only': 'เฉพาะบัญชีและเซสชันของตนเอง',
  'Edit {name}': 'แก้ไข {name}',
  'Delete role {name}? This cannot be undone. Roles assigned to members cannot be deleted.':
    'ลบบทบาท {name} หรือไม่? การกระทำนี้ย้อนกลับไม่ได้ บทบาทที่มอบหมายให้สมาชิกอยู่ไม่สามารถลบได้',
  'Role deleted.': 'ลบบทบาทแล้ว',
  'Could not delete role.': 'ลบบทบาทไม่สำเร็จ',
  'Delete {name}': 'ลบ {name}',
  'No custom roles yet. Built-in owner, editor, and viewer roles stay available.':
    'ยังไม่มีบทบาทกำหนดเอง บทบาทเจ้าของ ผู้แก้ไข และผู้ดูที่มีในระบบยังใช้งานได้',
  'Read APIs': 'อ่าน API',
  'Edit APIs': 'แก้ไข API',
  'Test drafts': 'ทดสอบฉบับร่าง',
  'Publish and roll back': 'เผยแพร่และย้อนกลับเวอร์ชัน',
  'Read data sources': 'อ่านแหล่งข้อมูล',
  'Manage data sources': 'จัดการแหล่งข้อมูล',
  'Read database copies': 'อ่านสำเนาฐานข้อมูล',
  'Manage database copies': 'จัดการสำเนาฐานข้อมูล',
  'Read product login connections': 'อ่านการเชื่อมต่อเข้าสู่ระบบผลิตภัณฑ์',
  'Manage product login connections': 'จัดการการเชื่อมต่อเข้าสู่ระบบผลิตภัณฑ์',
  'Manage runtime API keys': 'จัดการคีย์ API สำหรับเรียกใช้งาน',
  'Read audit history': 'อ่านประวัติการดำเนินการ',
  'Manage workspace backups': 'จัดการข้อมูลสำรองของพื้นที่ทำงาน',
  'Read migration history': 'อ่านประวัติการย้ายโครงสร้างฐานข้อมูล',
  'Run load tests': 'รันทดสอบโหลด',
  APIs: 'API',
  Databases: 'ฐานข้อมูล',
  Security: 'ความปลอดภัย',
  'Read authorized API drafts, release history, OpenAPI documents, client examples, and generated backend source.':
    'อ่านฉบับร่าง API ที่ได้รับอนุญาต ประวัติเวอร์ชัน เอกสาร OpenAPI ตัวอย่างโค้ดไคลเอนต์ และซอร์สโค้ดแบ็กเอนด์ที่สร้างขึ้น',
  'Create and save API drafts. Selected access permits editing existing shared APIs with explicit dependency use, but cannot create APIs.':
    'สร้างและบันทึกฉบับร่าง API การเข้าถึงแบบเลือกอนุญาตให้แก้ไข API ที่แชร์อยู่โดยมีสิทธิ์ใช้ทรัพยากรที่เกี่ยวข้องอย่างชัดเจน แต่สร้าง API ไม่ได้',
  'Execute saved REST and GraphQL drafts, including their configured data and product-login steps. Selected access also requires explicit dependency use.':
    'เรียกใช้ฉบับร่าง REST และ GraphQL ที่บันทึกแล้ว รวมถึงขั้นตอนข้อมูลและการเข้าสู่ระบบผลิตภัณฑ์ที่ตั้งค่าไว้ การเข้าถึงแบบเลือกต้องมีสิทธิ์ใช้ทรัพยากรที่เกี่ยวข้องอย่างชัดเจนด้วย',
  'Change live API behavior by publishing drafts or rolling back releases.':
    'เปลี่ยนพฤติกรรม API ที่เผยแพร่อยู่ด้วยการเผยแพร่ฉบับร่างหรือย้อนกลับเวอร์ชัน',
  'Read source metadata and saved rows.':
    'อ่านข้อมูลประกอบแหล่งข้อมูลและแถวที่บันทึกไว้',
  'Import, replace, refresh, and delete sources. Replacing data changes what published APIs read.':
    'นำเข้า แทนที่ โหลดใหม่ และลบแหล่งข้อมูล การแทนที่ข้อมูลเปลี่ยนข้อมูลที่ API ที่เผยแพร่แล้วอ่าน',
  'Read uploaded SQLite copy metadata and selected rows. Generated APIs may expose their configured data.':
    'อ่านข้อมูลประกอบสำเนา SQLite ที่อัปโหลดและแถวที่เลือก API ที่สร้างขึ้นอาจเปิดเผยข้อมูลที่ตั้งค่าไว้',
  'Upload, check, and delete immutable SQLite copies. Workspace backups include all uploaded data.':
    'อัปโหลด ตรวจสอบ และลบสำเนา SQLite ที่แก้ไขไม่ได้ ข้อมูลสำรองของพื้นที่ทำงานรวมข้อมูลที่อัปโหลดทั้งหมด',
  'Read product-login connection metadata without provider secrets.':
    'อ่านข้อมูลประกอบการเชื่อมต่อเข้าสู่ระบบผลิตภัณฑ์โดยไม่มีข้อมูลลับของผู้ให้บริการ',
  'Create, update, and delete server-held provider credentials. Changes affect live product login.':
    'สร้าง แก้ไข และลบข้อมูลรับรองผู้ให้บริการที่เก็บบนเซิร์ฟเวอร์ การเปลี่ยนแปลงส่งผลต่อการเข้าสู่ระบบผลิตภัณฑ์ที่ใช้งานอยู่',
  'Issue, list, replace, and revoke runtime keys. Selected access manages issuer-bound keys for shared APIs; issuance and replacement require dependency use and preserve release pins.':
    'ออก แสดงรายการ แทนที่ และเพิกถอนคีย์สำหรับเรียกใช้งาน การเข้าถึงแบบเลือกจัดการคีย์ที่ผูกกับผู้ออกสำหรับ API ที่แชร์ การออกและแทนที่ต้องมีสิทธิ์ใช้ทรัพยากรที่เกี่ยวข้องและคงการตรึงเวอร์ชันเผยแพร่ไว้',
  'Read workspace activity and security events.':
    'อ่านกิจกรรมพื้นที่ทำงานและเหตุการณ์ความปลอดภัย',
  'Create, list, and download complete workspace backups containing saved data and sensitive credential records.':
    'สร้าง แสดงรายการ และดาวน์โหลดข้อมูลสำรองพื้นที่ทำงานทั้งหมด ซึ่งรวมข้อมูลที่บันทึกไว้และระเบียนข้อมูลรับรองที่ละเอียดอ่อน',
  'Read the control database migration history.':
    'อ่านประวัติการย้ายโครงสร้างของฐานข้อมูลควบคุม',
  'List published targets and load-test history; start and cancel bounded local runs. Runs execute published APIs and may cause their configured writes.':
    'แสดงเป้าหมายที่เผยแพร่และประวัติการทดสอบโหลด เริ่มและยกเลิกการรันในเครื่องที่มีขอบเขตจำกัด การรันเรียกใช้ API ที่เผยแพร่แล้วและอาจทำให้เกิดการเขียนข้อมูลที่ตั้งค่าไว้',
  'Update available': 'มีเวอร์ชันใหม่',
  'No newer release found': 'ไม่พบเวอร์ชันที่ใหม่กว่า',
  'No matching releases found': 'ไม่พบเวอร์ชันที่ตรงกับการตั้งค่า',
  'Release check failed': 'ตรวจสอบเวอร์ชันไม่สำเร็จ',
  'Owner access required to manage Besh updates.':
    'ต้องมีสิทธิ์เจ้าของเพื่อจัดการการอัปเดต Besh',
  'Could not load update information.': 'โหลดข้อมูลอัปเดตไม่สำเร็จ',
  'YOUR BESH INSTALLATION': 'Besh ที่คุณติดตั้ง',
  'Besh updates': 'อัปเดต Besh',
  'Check public GitHub releases when you are ready.':
    'ตรวจสอบเวอร์ชันที่เผยแพร่บน GitHub สาธารณะเมื่อคุณพร้อม',
  'Discard unsaved update settings and refresh?':
    'ทิ้งการตั้งค่าอัปเดตที่ยังไม่บันทึกและโหลดใหม่หรือไม่?',
  'Refresh update settings': 'โหลดการตั้งค่าอัปเดตใหม่',
  'Loading update settings…': 'กำลังโหลดการตั้งค่าอัปเดต…',
  'Update settings saved. Check releases to get a fresh result.':
    'บันทึกการตั้งค่าอัปเดตแล้ว ตรวจสอบเวอร์ชันเพื่อรับผลล่าสุด',
  'Release settings': 'การตั้งค่าเวอร์ชัน',
  'GitHub repository': 'คลังโค้ด GitHub',
  'Use a public repository URL. Private repositories and access tokens are not supported.':
    'ใช้ URL ของคลังโค้ดสาธารณะ ไม่รองรับคลังโค้ดส่วนตัวและโทเค็นเข้าถึง',
  'Include preview releases': 'รวมเวอร์ชันทดลอง',
  'Show alpha, beta and other prereleases alongside stable versions.':
    'แสดงเวอร์ชัน alpha, beta และเวอร์ชันทดลองอื่นร่วมกับเวอร์ชันเสถียร',
  'Save update settings': 'บันทึกการตั้งค่าอัปเดต',
  'Save your changes before checking releases.':
    'บันทึกการเปลี่ยนแปลงก่อนตรวจสอบเวอร์ชัน',
  'Release status': 'สถานะเวอร์ชัน',
  'Installed {version}': 'ติดตั้งแล้ว {version}',
  'No release check yet': 'ยังไม่ได้ตรวจสอบเวอร์ชัน',
  'Last checked {date}': 'ตรวจสอบล่าสุด {date}',
  'Preview release': 'เวอร์ชันทดลอง',
  'View GitHub release': 'ดูเวอร์ชันบน GitHub',
  'A check runs only when you choose it. Opening this page uses saved information.':
    'ตรวจสอบเมื่อคุณเลือกเท่านั้น การเปิดหน้านี้ใช้ข้อมูลที่บันทึกไว้',
  'Release check finished. Review the result below.':
    'ตรวจสอบเวอร์ชันเสร็จแล้ว ตรวจดูผลด้านล่าง',
  'Check releases': 'ตรวจสอบเวอร์ชัน',
  'One check per minute. Checks inspect the first 20 published GitHub releases.':
    'ตรวจสอบได้หนึ่งครั้งต่อนาที โดยตรวจดู 20 เวอร์ชันแรกที่เผยแพร่บน GitHub',
  'This page reports versions. It does not install updates or verify release compatibility. Review release notes and back up data before upgrading.':
    'หน้านี้รายงานเวอร์ชันเท่านั้น ไม่ติดตั้งอัปเดตหรือตรวจสอบความเข้ากันได้ของเวอร์ชัน อ่านบันทึกประจำเวอร์ชันและสำรองข้อมูลก่อนอัปเกรด',
  'Only the owner can manage Besh release settings and update notices.':
    'เฉพาะเจ้าของเท่านั้นที่จัดการการตั้งค่าเวอร์ชัน Besh และประกาศอัปเดตได้',
  'YOUR WORKSPACE ACCESS': 'การเข้าถึงพื้นที่ทำงานของคุณ',
  'Manage your email sign-in and active browser sessions.':
    'จัดการการเข้าสู่ระบบด้วยอีเมลและเซสชันเบราว์เซอร์ที่ใช้งานอยู่',
  'Loading your account…': 'กำลังโหลดบัญชีของคุณ…',
  'Sign-in details saved. Other browser sessions were revoked.':
    'บันทึกข้อมูลเข้าสู่ระบบแล้ว เซสชันบนเบราว์เซอร์อื่นถูกเพิกถอน',
  'Could not save sign-in details.': 'บันทึกข้อมูลเข้าสู่ระบบไม่สำเร็จ',
  'Optional. Your workspace key still works. Saving new details signs out your other browser sessions.':
    'ไม่จำเป็นต้องตั้งค่า คีย์พื้นที่ทำงานของคุณยังใช้งานได้ การบันทึกข้อมูลใหม่จะออกจากระบบบนเบราว์เซอร์อื่นของคุณ',
  'Account email': 'อีเมลบัญชี',
  'Use 12 to 128 characters.': 'ใช้ 12 ถึง 128 อักขระ',
  'Confirm your identity': 'ยืนยันตัวตนของคุณ',
  'Current password': 'รหัสผ่านปัจจุบัน',
  'Your workspace key': 'คีย์พื้นที่ทำงานของคุณ',
  'Save sign-in details': 'บันทึกข้อมูลเข้าสู่ระบบ',
  'Active sessions': 'เซสชันที่ใช้งานอยู่',
  'Owners can revoke sessions across this workspace.':
    'เจ้าของสามารถเพิกถอนเซสชันทั้งหมดในพื้นที่ทำงานนี้ได้',
  'Only your own active sessions appear here.':
    'แสดงเฉพาะเซสชันที่ใช้งานอยู่ของคุณที่นี่',
  'Session expires {date}.': 'เซสชันหมดอายุ {date}',
  'Refresh sessions': 'รีเฟรชเซสชัน',
  Member: 'สมาชิก',
  Device: 'อุปกรณ์',
  'Last active': 'ใช้งานล่าสุด',
  Expires: 'หมดอายุ',
  Access: 'การเข้าถึง',
  'This device': 'อุปกรณ์นี้',
  'Other browser session': 'เซสชันเบราว์เซอร์อื่น',
  'Revoke session for {name} on this device':
    'เพิกถอนเซสชันของ {name} บนอุปกรณ์นี้',
  'Revoke session for {name}': 'เพิกถอนเซสชันของ {name}',
  'Revoke this session and sign out?': 'เพิกถอนเซสชันนี้และออกจากระบบหรือไม่?',
  'Revoke this browser session for {name}?':
    'เพิกถอนเซสชันเบราว์เซอร์นี้ของ {name} หรือไม่?',
  'This session was revoked. Sign in again.':
    'เซสชันนี้ถูกเพิกถอนแล้ว กรุณาเข้าสู่ระบบอีกครั้ง',
  'Browser session revoked.': 'เพิกถอนเซสชันเบราว์เซอร์แล้ว',
  Revoke: 'เพิกถอน',
  'No active sessions.': 'ไม่มีเซสชันที่ใช้งานอยู่',
  Language: 'ภาษา',
  'Use device language': 'ใช้ภาษาของอุปกรณ์',
  Appearance: 'รูปแบบการแสดงผล',
  Light: 'สว่าง',
  Dark: 'มืด',
  System: 'ตามระบบ',
  'API Studio': 'สตูดิโอ API',
  'Data sources': 'แหล่งข้อมูล',
  'Database connections': 'การเชื่อมต่อฐานข้อมูล',
  'Product login': 'การเข้าสู่ระบบของผลิตภัณฑ์',
  'Load testing': 'ทดสอบโหลด',
  'Audit trail': 'บันทึกการดำเนินการ',
  Members: 'สมาชิก',
  'Tenant protection': 'การปกป้องข้อมูลผู้เช่า',
  'API keys': 'คีย์ API',
  'Account & sessions': 'บัญชีและเซสชัน',
  'Data & backups': 'ข้อมูลและการสำรองข้อมูล',
  Updates: 'การอัปเดต',
  'What’s next': 'สิ่งที่จะทำต่อ',
  Workspace: 'พื้นที่ทำงาน',
  'Local workspace': 'พื้นที่ทำงานในเครื่อง',
  WORKSPACE: 'พื้นที่ทำงาน',
  'YOUR APIS': 'API ของคุณ',
  'New API': 'API ใหม่',
  'Workspace navigation': 'เมนูพื้นที่ทำงาน',
  'Sign out': 'ออกจากระบบ',
  'Working…': 'กำลังดำเนินการ…',
  'Opening your workspace…': 'กำลังเปิดพื้นที่ทำงานของคุณ…',
  'Opening invitation…': 'กำลังเปิดคำเชิญ…',
  'Opening studio…': 'กำลังเปิดสตูดิโอ…',
  'Try again': 'ลองอีกครั้ง',
  'Help & roadmap': 'ความช่วยเหลือและแผนงาน',
  'Drafts stay separate from published APIs':
    'ฉบับร่างแยกจาก API ที่เผยแพร่แล้ว',
  'No APIs shared': 'ยังไม่มี API ที่แชร์',
  'Permission required': 'ต้องมีสิทธิ์เข้าถึง',
  'Owner access required': 'ต้องมีสิทธิ์เจ้าของ',
  'Editor access required': 'ต้องมีสิทธิ์แก้ไข',
  Save: 'บันทึก',
  Cancel: 'ยกเลิก',
  Close: 'ปิด',
  Refresh: 'รีเฟรช',
  Search: 'ค้นหา',
  'API tools': 'เครื่องมือ API',
  'Review details': 'ตรวจสอบรายละเอียด',
  'Besh home': 'หน้าแรก Besh',
  'A SPACE FOR YOUR NEXT IDEA': 'พื้นที่สำหรับไอเดียถัดไปของคุณ',
  'Your next API.': 'API ถัดไปของคุณ',
  'Clearly connected.': 'เชื่อมต่ออย่างชัดเจน',
  'Turn an idea into an endpoint. Build visually, test your flow, and publish when you’re ready.':
    'เปลี่ยนไอเดียให้เป็นปลายทาง API สร้างด้วยภาพ ทดสอบโฟลว์ แล้วเผยแพร่เมื่อพร้อม',
  'Start with a simple request.': 'เริ่มด้วยคำขอแบบง่าย',
  'Ask for exactly what you need.': 'ขอเฉพาะสิ่งที่คุณต้องการ',
  'JSON response': 'คำตอบ JSON',
  Request: 'คำขอ',
  Response: 'คำตอบ',
  'Your workspace. Your APIs. Private by default.':
    'พื้นที่ทำงานของคุณ API ของคุณ เป็นส่วนตัวตั้งแต่เริ่มต้น',
  '02 / SAVE YOUR KEY': '02 / เก็บคีย์ของคุณ',
  '01 / MAKE IT YOURS': '01 / ตั้งค่าพื้นที่ของคุณ',
  'WELCOME BACK': 'ยินดีต้อนรับกลับ',
  'Your workspace is ready.': 'พื้นที่ทำงานของคุณพร้อมแล้ว',
  'A little setup. A lot of possibility.':
    'ตั้งค่าเพียงเล็กน้อย เปิดโอกาสอีกมากมาย',
  'Open your workspace.': 'เปิดพื้นที่ทำงานของคุณ',
  'Keep this owner key safe. It is shown once.':
    'เก็บคีย์เจ้าของนี้ให้ปลอดภัย จะแสดงเพียงครั้งเดียว',
  'Choose a name for your workspace. We’ll create an owner key so you can get started.':
    'ตั้งชื่อพื้นที่ทำงานของคุณ เราจะสร้างคีย์เจ้าของให้คุณเริ่มใช้งาน',
  'Sign in with email and password, or your owner or member key. Configure email sign-in in Account & sessions.':
    'เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน หรือคีย์เจ้าของหรือสมาชิก ตั้งค่าการเข้าสู่ระบบด้วยอีเมลได้ในบัญชีและเซสชัน',
  'Sign-in method': 'วิธีเข้าสู่ระบบ',
  'Workspace key': 'คีย์พื้นที่ทำงาน',
  'Email & password': 'อีเมลและรหัสผ่าน',
  'Workspace name': 'ชื่อพื้นที่ทำงาน',
  'Setup key': 'คีย์ตั้งค่า',
  'Open the setup link printed in your server terminal.':
    'เปิดลิงก์ตั้งค่าที่แสดงในเทอร์มินัลเซิร์ฟเวอร์ของคุณ',
  'Visual API Studio': 'สตูดิโอ API แบบภาพ',
  'Separate drafts and releases': 'แยกฉบับร่างจากรุ่นที่เผยแพร่',
  'Private workspace': 'พื้นที่ทำงานส่วนตัว',
  Email: 'อีเมล',
  Password: 'รหัสผ่าน',
  'Your owner key': 'คีย์เจ้าของของคุณ',
  'Workspace token': 'โทเคนพื้นที่ทำงาน',
  'Copy owner key': 'คัดลอกคีย์เจ้าของ',
  'I saved my owner key': 'ฉันเก็บคีย์เจ้าของแล้ว',
  'Your key creates a private browser session. The key is discarded after sign-in.':
    'คีย์ของคุณใช้สร้างเซสชันเบราว์เซอร์ส่วนตัว คีย์จะถูกล้างหลังเข้าสู่ระบบ',
  'Enter studio': 'เข้าสู่สตูดิโอ',
  'Create workspace': 'สร้างพื้นที่ทำงาน',
  'Open workspace': 'เปิดพื้นที่ทำงาน',
  'A small start. Something worth building.':
    'เริ่มเล็ก ๆ สร้างสิ่งที่มีคุณค่า',
  'Workspace created. Save your owner key.':
    'สร้างพื้นที่ทำงานแล้ว เก็บคีย์เจ้าของของคุณ',
  'Owner key copied.': 'คัดลอกคีย์เจ้าของแล้ว',
  'YOUR WORKSPACE INVITATION': 'คำเชิญเข้าพื้นที่ทำงานของคุณ',
  'Your workspace invite.': 'คำเชิญเข้าพื้นที่ทำงานของคุณ',
  'Set up email sign-in for your existing member. Your role and API access do not change.':
    'ตั้งค่าการเข้าสู่ระบบด้วยอีเมลสำหรับสมาชิกเดิมของคุณ บทบาทและสิทธิ์ API ไม่เปลี่ยนแปลง',
  'Accept invitation': 'รับคำเชิญ',
  'Password set': 'ตั้งรหัสผ่านแล้ว',
  'Email sign-in is ready for {email}. You are not signed in yet.':
    'พร้อมเข้าสู่ระบบด้วยอีเมล {email} แล้ว คุณยังไม่ได้เข้าสู่ระบบ',
  'Sign in': 'เข้าสู่ระบบ',
  'Reading invitation…': 'กำลังอ่านคำเชิญ…',
  'Check invitation': 'ตรวจสอบคำเชิญ',
  'Selected APIs': 'API ที่เลือก',
  'All APIs': 'API ทั้งหมด',
  'Expires {date}.': 'หมดอายุ {date}',
  'Current sign-in': 'การเข้าสู่ระบบปัจจุบัน',
  'Checking current sign-in…': 'กำลังตรวจสอบการเข้าสู่ระบบปัจจุบัน…',
  'You are signed in as {name}. Sign out explicitly before setting this member’s password.':
    'คุณเข้าสู่ระบบเป็น {name} โปรดออกจากระบบก่อนตั้งรหัสผ่านให้สมาชิกนี้',
  'Sign out to accept invitation': 'ออกจากระบบเพื่อรับคำเชิญ',
  'Return to workspace': 'กลับไปพื้นที่ทำงาน',
  'No workspace sign-in is active.': 'ยังไม่มีการเข้าสู่ระบบพื้นที่ทำงาน',
  'Check current sign-in': 'ตรวจสอบการเข้าสู่ระบบปัจจุบัน',
  'New password': 'รหัสผ่านใหม่',
  'Invitation password': 'รหัสผ่านใหม่',
  'Confirm password': 'ยืนยันรหัสผ่าน',
  'Confirm invitation password': 'ยืนยันรหัสผ่าน',
  'Use 12 to 128 characters. Your existing workspace key still works.':
    'ใช้ 12 ถึง 128 ตัวอักษร คีย์พื้นที่ทำงานเดิมของคุณยังใช้ได้',
  'Set password': 'ตั้งรหัสผ่าน',
  'Leave invitation and sign in': 'ออกจากคำเชิญและเข้าสู่ระบบ',
  'Discard unsaved draft changes and sign out to accept this invitation?':
    'ทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่บันทึก แล้วออกจากระบบเพื่อรับคำเชิญนี้หรือไม่?',
  'Passwords must match.': 'รหัสผ่านต้องตรงกัน',
  'Could not read invitation.': 'อ่านคำเชิญไม่ได้',
  'Could not read your current sign-in.':
    'อ่านสถานะการเข้าสู่ระบบปัจจุบันไม่ได้',
  'Current sign-in unknown. Check it before setting a password.':
    'ไม่ทราบสถานะการเข้าสู่ระบบปัจจุบัน โปรดตรวจสอบก่อนตั้งรหัสผ่าน',
  'Could not confirm sign-out. Check current sign-in before continuing; no automatic retry was made.':
    'ยืนยันการออกจากระบบไม่ได้ โปรดตรวจสอบการเข้าสู่ระบบก่อนดำเนินการต่อ ระบบไม่ได้ลองซ้ำอัตโนมัติ',
  'Could not confirm password setup.': 'ยืนยันการตั้งรหัสผ่านไม่ได้',
  'No automatic retry was made. Try ordinary email sign-in if it may have succeeded, or ask the owner to refresh invitations and review a new link.':
    'ระบบไม่ได้ลองซ้ำอัตโนมัติ หากอาจตั้งรหัสผ่านสำเร็จแล้ว ให้ลองเข้าสู่ระบบด้วยอีเมล หรือขอให้เจ้าของรีเฟรชคำเชิญและตรวจสอบลิงก์ใหม่',
  'Sign-in invitation': 'คำเชิญเข้าสู่ระบบ',
  Invitations: 'คำเชิญ',
  'Set up email sign-in for an existing key-only member. Their role, API access and tenant assignment stay unchanged. Existing accounts cannot be reset with an invitation.':
    'ตั้งค่าการเข้าสู่ระบบด้วยอีเมลให้สมาชิกเดิมที่ใช้คีย์เท่านั้น บทบาท สิทธิ์ API และผู้เช่าที่กำหนดไว้ไม่เปลี่ยนแปลง คำเชิญไม่สามารถรีเซ็ตบัญชีที่มีอยู่แล้ว',
  'Refresh invitations': 'รีเฟรชคำเชิญ',
  'Loading invitations…': 'กำลังโหลดคำเชิญ…',
  'Current invitations unknown. Refresh needed.':
    'ไม่ทราบคำเชิญปัจจุบัน ต้องรีเฟรช',
  'Existing member': 'สมาชิกที่มีอยู่',
  'Invitation member': 'สมาชิกที่มีอยู่',
  'Invitation email': 'อีเมลสำหรับคำเชิญ',
  'Expires in 24 hours. Besh does not send email.':
    'หมดอายุใน 24 ชั่วโมง Besh ไม่ได้ส่งอีเมล',
  'Anyone holding the link can set this member’s password. It does not prove email ownership. Share it privately. Creating another link invalidates this member’s earlier invitation; their workspace key still works.':
    'ผู้ที่มีลิงก์สามารถตั้งรหัสผ่านให้สมาชิกนี้ได้ ลิงก์ไม่ได้ยืนยันความเป็นเจ้าของอีเมล โปรดแชร์เป็นการส่วนตัว การสร้างลิงก์ใหม่ทำให้คำเชิญเดิมของสมาชิกนี้ใช้ไม่ได้ แต่คีย์พื้นที่ทำงานยังใช้ได้',
  'Create invitation link': 'สร้างลิงก์คำเชิญ',
  'Save this invitation link': 'เก็บลิงก์คำเชิญนี้',
  'Link status unconfirmed. Refresh invitations before sharing it.':
    'ยังยืนยันสถานะลิงก์ไม่ได้ โปรดรีเฟรชคำเชิญก่อนแชร์',
  'Current pending invitation.': 'คำเชิญปัจจุบันที่รอตอบรับ',
  'This invitation is no longer active. Its link cannot set a password.':
    'คำเชิญนี้ใช้ไม่ได้แล้ว ลิงก์ไม่สามารถตั้งรหัสผ่านได้',
  'Invitation link': 'ลิงก์คำเชิญ',
  'Copy invitation link': 'คัดลอกลิงก์คำเชิญ',
  'I saved the link': 'ฉันเก็บลิงก์แล้ว',
  'Pending invitations': 'คำเชิญที่รอตอบรับ',
  'Refresh to read current pending invitations.':
    'รีเฟรชเพื่ออ่านคำเชิญที่รอตอบรับปัจจุบัน',
  'Revoke invitation': 'เพิกถอนคำเชิญ',
  'No pending invitations.': 'ไม่มีคำเชิญที่รอตอบรับ',
  'Close invitations': 'ปิดคำเชิญ',
  'Could not read invitations.': 'อ่านคำเชิญไม่ได้',
  'Refresh invitations before changing a link.': 'รีเฟรชคำเชิญก่อนเปลี่ยนลิงก์',
  'Refresh invitations before trying again.': 'รีเฟรชคำเชิญก่อนลองอีกครั้ง',
  'Could not confirm whether the invitation was created. Refresh invitations to review current links before reissuing or revoking.':
    'ยืนยันไม่ได้ว่าสร้างคำเชิญสำเร็จหรือไม่ โปรดรีเฟรชเพื่อตรวจสอบลิงก์ปัจจุบันก่อนสร้างใหม่หรือเพิกถอน',
  'Could not confirm whether the invitation was revoked. Refresh invitations before changing another link.':
    'ยืนยันไม่ได้ว่าเพิกถอนคำเชิญแล้วหรือไม่ โปรดรีเฟรชก่อนเปลี่ยนลิงก์อื่น',
  'Invitation created. Copy the link; it is shown once.':
    'สร้างคำเชิญแล้ว คัดลอกลิงก์ จะแสดงเพียงครั้งเดียว',
  'Invitation revoked. That link can no longer set a password.':
    'เพิกถอนคำเชิญแล้ว ลิงก์นั้นตั้งรหัสผ่านไม่ได้อีก',
  'Invitation link copied.': 'คัดลอกลิงก์คำเชิญแล้ว',
  'Invitation unavailable': 'คำเชิญใช้ไม่ได้',
  'Too many invitation attempts': 'พยายามใช้คำเชิญหลายครั้งเกินไป',
  'Email address unavailable': 'อีเมลนี้ใช้ไม่ได้',
  'Invitation state unavailable': 'สถานะคำเชิญใช้ไม่ได้',
  'Choose a member and valid email address':
    'เลือกสมาชิกและระบุอีเมลที่ถูกต้อง',
  'Choose an existing member without an account':
    'เลือกสมาชิกเดิมที่ยังไม่มีบัญชี',
  'Pending invitation limit reached': 'คำเชิญที่รอตอบรับถึงขีดจำกัดแล้ว',
  'Provide an invitation token': 'ระบุโทเคนคำเชิญ',
  'Provide an invitation token and password of 12 to 128 characters':
    'ระบุโทเคนคำเชิญและรหัสผ่าน 12 ถึง 128 ตัวอักษร',
  'Invalid credentials': 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
  'Too many login attempts': 'พยายามเข้าสู่ระบบหลายครั้งเกินไป',
  'Enter a valid email address': 'กรอกอีเมลที่ถูกต้อง',
  'Password must contain 12 to 128 characters':
    'รหัสผ่านต้องมี 12 ถึง 128 ตัวอักษร',
  'Email and password must be provided together':
    'ต้องระบุอีเมลและรหัสผ่านพร้อมกัน',
  'Authentication required': 'ต้องเข้าสู่ระบบ',
  'Permission denied': 'ไม่มีสิทธิ์เข้าถึง',
  'Workspace is shutting down': 'พื้นที่ทำงานกำลังปิด',
  'Browser origin rejected': 'ไม่อนุญาตที่มาของเบราว์เซอร์นี้',
  'Session verification required': 'ต้องยืนยันเซสชัน',
  'Your session expired. Sign in again.':
    'เซสชันของคุณหมดอายุแล้ว โปรดเข้าสู่ระบบอีกครั้ง',
  'Your session expired or was revoked. Sign in again.':
    'เซสชันของคุณหมดอายุหรือถูกเพิกถอน โปรดเข้าสู่ระบบอีกครั้ง',
  'Signed out. This session was revoked.': 'ออกจากระบบแล้ว เซสชันนี้ถูกเพิกถอน',
  'This session has already ended. Sign in again.':
    'เซสชันนี้สิ้นสุดแล้ว โปรดเข้าสู่ระบบอีกครั้ง',
  'Workspace ready.': 'พื้นที่ทำงานพร้อมแล้ว',
  'Connect your first idea.': 'เชื่อมต่อไอเดียแรกของคุณ',
  'Request failed': 'คำขอไม่สำเร็จ',
  'Could not restore session.': 'กู้คืนเซสชันไม่ได้',
  'Invitation link unavailable. Ask the owner for a new link.':
    'ลิงก์คำเชิญใช้ไม่ได้ ขอให้เจ้าของสร้างลิงก์ใหม่',
  'nodePicker.open': 'เพิ่มขั้นตอน',
  'Add step': 'เพิ่มขั้นตอน',
  'nodePicker.title': 'เลือกขั้นตอน',
  'Choose a step': 'เลือกขั้นตอน',
  'nodePicker.search': 'ค้นหาขั้นตอน',
  'Search steps': 'ค้นหาขั้นตอน',
  'nodePicker.help':
    'เลือกขั้นตอนสำหรับฉบับร่างนี้ แล้วตั้งค่าฟิลด์หลังจากเพิ่ม',
  'Choose a step for this draft. Configure its fields after adding.':
    'เลือกขั้นตอนสำหรับฉบับร่างนี้ แล้วตั้งค่าฟิลด์หลังจากเพิ่ม',
  'nodePicker.all': 'ทุกขั้นตอน',
  'All steps': 'ทุกขั้นตอน',
  'nodePicker.favorites': 'รายการโปรด',
  Favorites: 'รายการโปรด',
  'nodePicker.empty': 'ไม่พบขั้นตอน',
  'No steps found.': 'ไม่พบขั้นตอน',
  'nodePicker.noFavorites': 'ยังไม่มีขั้นตอนโปรด',
  'No favorite steps yet.': 'ยังไม่มีขั้นตอนโปรด',
  'nodePicker.favorite': 'เพิ่ม {name} ในรายการโปรด',
  'Favorite {name}': 'เพิ่ม {name} ในรายการโปรด',
  'nodePicker.unfavorite': 'นำ {name} ออกจากรายการโปรด',
  'Remove {name} from favorites': 'นำ {name} ออกจากรายการโปรด',
  'nodePicker.add': 'เพิ่ม {name}',
  'Add {name}': 'เพิ่ม {name}',
  'nodePicker.close': 'ปิดตัวเลือกขั้นตอน',
  'Close step picker': 'ปิดตัวเลือกขั้นตอน',
  'nodePicker.unavailable': 'ใช้กับ API นี้ไม่ได้',
  'Unavailable for this API': 'ใช้กับ API นี้ไม่ได้',
  'nodePicker.requestExists': 'API นี้มีขั้นตอนคำขอแล้ว',
  'This API already has a request step.': 'API นี้มีขั้นตอนคำขอแล้ว',
  'nodePicker.category.api': 'API',
  API: 'API',
  'nodePicker.category.logic': 'ตรรกะ',
  Logic: 'ตรรกะ',
  'nodePicker.category.data': 'ข้อมูล',
  Data: 'ข้อมูล',
  'nodePicker.category.identity': 'การเข้าสู่ระบบของผลิตภัณฑ์',
  'nodePicker.categories': 'หมวดหมู่ขั้นตอน',
  'Step categories': 'หมวดหมู่ขั้นตอน',
  'nodePicker.results': 'ขั้นตอนที่ตรงกัน',
  'Matching steps': 'ขั้นตอนที่ตรงกัน',
  'nodes.request.label': 'คำขอ HTTP',
  'HTTP request': 'คำขอ HTTP',
  'nodes.request.description': 'เริ่ม API และรับข้อมูลเข้า',
  'Start the API and receive its input.': 'เริ่ม API และรับข้อมูลเข้า',
  'nodes.response.label': 'คำตอบ JSON',
  'nodes.response.description': 'ส่งผลลัพธ์ API กลับไปยังผู้เรียก',
  'Send the API result back to its caller.': 'ส่งผลลัพธ์ API กลับไปยังผู้เรียก',
  'nodes.condition.label': 'เงื่อนไข',
  Condition: 'เงื่อนไข',
  'nodes.condition.description': 'เปรียบเทียบค่าเข้าแล้วเลือกเส้นทางถัดไป',
  'Compare an input value and choose the next path.':
    'เปรียบเทียบค่าเข้าแล้วเลือกเส้นทางถัดไป',
  'nodes.data.label': 'แถวจากสเปรดชีต',
  'Spreadsheet rows': 'แถวจากสเปรดชีต',
  'nodes.data.description':
    'อ่านฟิลด์ที่เลือกจากสเปรดชีตที่นำเข้าหรือ Google Sheet ที่บันทึกไว้',
  'Read chosen fields from an imported spreadsheet or saved Google Sheet.':
    'อ่านฟิลด์ที่เลือกจากสเปรดชีตที่นำเข้าหรือ Google Sheet ที่บันทึกไว้',
  'nodes.database.label': 'แถว SQLite',
  'SQLite rows': 'แถว SQLite',
  'nodes.database.description': 'อ่านฟิลด์ที่เลือกจากสำเนา SQLite ที่อัปโหลด',
  'Read chosen fields from an uploaded SQLite copy.':
    'อ่านฟิลด์ที่เลือกจากสำเนา SQLite ที่อัปโหลด',
  'nodes.social.label': 'เข้าสู่ระบบด้วย GitHub',
  'GitHub login': 'เข้าสู่ระบบด้วย GitHub',
  'nodes.social.description':
    'เพิ่มการเข้าสู่ระบบด้วย GitHub ให้ API ของผลิตภัณฑ์',
  'Add GitHub sign-in to the product API.':
    'เพิ่มการเข้าสู่ระบบด้วย GitHub ให้ API ของผลิตภัณฑ์',
  'nodes.wsRequest.label': 'รับข้อความ',
  'Receive message': 'รับข้อความ',
  'nodes.wsRequest.description':
    'รับข้อความ WebSocket แบบมีชนิดข้อมูลหนึ่งข้อความ',
  'Receive one typed WebSocket message.':
    'รับข้อความ WebSocket แบบมีชนิดข้อมูลหนึ่งข้อความ',
  'nodes.wsResponse.label': 'ส่งคำตอบ',
  'Send reply': 'ส่งคำตอบ',
  'nodes.wsResponse.description':
    'ส่งคำตอบ WebSocket แบบมีชนิดข้อมูลหนึ่งคำตอบ',
  'Send one typed WebSocket reply.':
    'ส่งคำตอบ WebSocket แบบมีชนิดข้อมูลหนึ่งคำตอบ',
  'API editing is unavailable.': 'ไม่สามารถแก้ไข API ได้',
  'This API already has 64 steps.': 'API นี้มี 64 ขั้นตอนแล้ว',
  'This API already has a starting step.': 'API นี้มีขั้นตอนเริ่มต้นแล้ว',
  'This step is unavailable for WebSocket request/reply.':
    'ขั้นตอนนี้ใช้กับคำขอและคำตอบ WebSocket ไม่ได้',
  'This WebSocket API already has a reply step.':
    'API WebSocket นี้มีขั้นตอนคำตอบแล้ว',
  'WebSocket request/reply supports one data read.':
    'คำขอและคำตอบ WebSocket รองรับการอ่านข้อมูลหนึ่งขั้นตอน',
  Draft: 'ฉบับร่าง',
  'Unsaved changes': 'การเปลี่ยนแปลงที่ยังไม่บันทึก',
  Saved: 'บันทึกแล้ว',
  'Save draft': 'บันทึกฉบับร่าง',
  Publish: 'เผยแพร่',
  'API name': 'ชื่อ API',
  'API NAME': 'ชื่อ API',
  'API TYPE': 'ชนิด API',
  'API type': 'ชนิด API',
  METHOD: 'เมธอด',
  'HTTP method': 'เมธอด HTTP',
  'ENDPOINT PATH': 'เส้นทางปลายทาง',
  'Endpoint path': 'เส้นทางปลายทาง',
  'Test flow': 'ทดสอบโฟลว์',
  'Request input': 'ข้อมูลเข้าคำขอ',
  'Apply configuration': 'ใช้การตั้งค่า',
  'Remove node': 'นำขั้นตอนออก',
  'Advanced configuration': 'การตั้งค่าขั้นสูง',
  'Node configuration': 'การตั้งค่าขั้นตอน',
  'Create your first API': 'สร้าง API แรกของคุณ',
  'Start with a spreadsheet': 'เริ่มจากสเปรดชีต',
  'Build a blank API': 'สร้าง API เปล่า',
  'Response status': 'สถานะคำตอบ',
  'Response contents': 'เนื้อหาคำตอบ',
  'Response fields': 'ฟิลด์คำตอบ',
  'Rows from data step': 'แถวจากขั้นตอนข้อมูล',
  'GitHub login result': 'ผลการเข้าสู่ระบบ GitHub',
  'Input source': 'แหล่งข้อมูลเข้า',
  'Input field': 'ฟิลด์ข้อมูลเข้า',
  Comparison: 'การเปรียบเทียบ',
  Equals: 'เท่ากับ',
  'Expected type': 'ชนิดที่คาดหวัง',
  'Expected value': 'ค่าที่คาดหวัง',
  Text: 'ข้อความ',
  Number: 'ตัวเลข',
  'True or false': 'จริงหรือเท็จ',
  'Empty value': 'ค่าว่าง',
  'Request body': 'เนื้อหาคำขอ',
  'Query parameter': 'พารามิเตอร์คิวรี',
  'Path parameter': 'พารามิเตอร์เส้นทาง',
  'From request body': 'จากเนื้อหาคำขอ',
  'From query parameter': 'จากพารามิเตอร์คิวรี',
  'From path parameter': 'จากพารามิเตอร์เส้นทาง',
  'Nested data (preserved)': 'ข้อมูลซ้อนกัน (คงไว้)',
  True: 'จริง',
  False: 'เท็จ',
  'Path parameters': 'พารามิเตอร์เส้นทาง',
  'Query parameters': 'พารามิเตอร์คิวรี',
  'Request body fields': 'ฟิลด์เนื้อหาคำขอ',
  'Add query parameter': 'เพิ่มพารามิเตอร์คิวรี',
  'Add body field': 'เพิ่มฟิลด์เนื้อหาคำขอ',
  'Add response field': 'เพิ่มฟิลด์คำตอบ',
  '{prefix} name {number}': 'ชื่อ {prefix} {number}',
  '{prefix} type {number}': 'ชนิด {prefix} {number}',
  '{prefix} value {number}': 'ค่า {prefix} {number}',
  'Remove {prefix} field {number}': 'นำฟิลด์ {prefix} {number} ออก',
  'Path parameter {name}': 'พารามิเตอร์เส้นทาง {name}',
  'Value for :{name}': 'ค่าสำหรับ :{name}',
  Field: 'ฟิลด์',
  Body: 'เนื้อหาคำขอ',
  Query: 'คิวรี',
  'Finish opening your workspace or the current action, then reopen the invitation link. Your draft was kept.':
    'รอให้เปิดพื้นที่ทำงานหรือดำเนินการปัจจุบันเสร็จ แล้วเปิดลิงก์คำเชิญอีกครั้ง ฉบับร่างของคุณยังอยู่',
  'Leave the editor to review this invitation? Your unsaved draft will be kept until you return or confirm sign-out.':
    'ออกจากตัวแก้ไขเพื่อตรวจสอบคำเชิญนี้หรือไม่? ฉบับร่างที่ยังไม่บันทึกจะอยู่จนกว่าคุณกลับมาหรือยืนยันออกจากระบบ',
  'Discard unsaved draft changes and open sign-in?':
    'ทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่บันทึก แล้วเปิดหน้าเข้าสู่ระบบหรือไม่?',
  'Workspace already configured': 'พื้นที่ทำงานตั้งค่าแล้ว',
  'Open the setup link from your server terminal':
    'เปิดลิงก์ตั้งค่าจากเทอร์มินัลเซิร์ฟเวอร์ของคุณ',
  'HTTPS browser origin required': 'ต้องใช้ที่มาเบราว์เซอร์แบบ HTTPS',
  'Invitation revocation takes no fields': 'การเพิกถอนคำเชิญไม่รับฟิลด์',
  'Request failed ({status}).': 'คำขอไม่สำเร็จ ({status})',
  'Invalid request': 'คำขอไม่ถูกต้อง',
  'Invalid request body': 'เนื้อหาคำขอไม่ถูกต้อง',
  'REST API': 'REST API',
  'GraphQL API': 'GraphQL API',
  'Remove field {number}': 'นำฟิลด์ {number} ออก',
  'NODE SETTINGS': 'การตั้งค่าขั้นตอน',
  'BUILD SOMETHING USEFUL': 'สร้างสิ่งที่มีประโยชน์',
  'Connect the dots. Let your API do the work.':
    'เชื่อมต่อขั้นตอน แล้วให้ API ทำงานให้คุณ',
  'API key protected': 'ปกป้องด้วยคีย์ API',
  'Published endpoint URL': 'URL ปลายทางที่เผยแพร่',
  'Flow canvas': 'พื้นที่ออกแบบโฟลว์',
  'New draft': 'ฉบับร่างใหม่',
  'Try it out': 'ทดลองใช้งาน',
  'WAITING FOR A RUN': 'รอการทดสอบ',
  'Use this API': 'ใช้ API นี้',
  'Generated backend': 'แบ็กเอนด์ที่สร้างขึ้น',
  'Your API starts here': 'API ของคุณเริ่มที่นี่',
  'Choose a path': 'เลือกเส้นทาง',
  'Send something back': 'ส่งคำตอบกลับ',
  'Read selected columns': 'อ่านคอลัมน์ที่เลือก',
  'Read an uploaded copy': 'อ่านสำเนาที่อัปโหลด',
  'Resolve a product identity': 'ระบุตัวตนผู้ใช้ผลิตภัณฑ์',
  'Data source': 'แหล่งข้อมูล',
  'Maximum rows': 'จำนวนแถวสูงสุด',
  'Filter rows': 'กรองแถว',
  'Match one column': 'จับคู่หนึ่งคอลัมน์',
  'Match column': 'คอลัมน์ที่จับคู่',
  'Match value type': 'ชนิดค่าที่จับคู่',
  'Fixed text': 'ข้อความคงที่',
  'Fixed number': 'ตัวเลขคงที่',
  'Match value': 'ค่าที่จับคู่',
  'Include {name}': 'รวม {name}',
  'API field: {name}': 'ฟิลด์ API: {name}',
  'Small steps. Powerful APIs.': 'ขั้นตอนเล็ก ๆ สร้าง API ที่ทรงพลัง',
  'Build a flow you can understand, test, and trust.':
    'สร้างโฟลว์ที่เข้าใจ ทดสอบ และไว้วางใจได้',
  owner: 'เจ้าของ',
  editor: 'ผู้แก้ไข',
  viewer: 'ผู้ดู',
  'Unknown role': 'ไม่ทราบบทบาท',
  'Custom role': 'บทบาทที่กำหนดเอง',
  'Loading saved source details…': 'กำลังโหลดรายละเอียดแหล่งข้อมูล…',
  'No saved sources are available. Import a spreadsheet in Data sources, then return to this step.':
    'ยังไม่มีแหล่งข้อมูลที่บันทึกไว้ นำเข้าตารางในหน้าแหล่งข้อมูล แล้วกลับมาที่ขั้นตอนนี้',
  'No allowed sources are available. Ask the owner to review source USE for your selected APIs.':
    'ไม่มีแหล่งข้อมูลที่อนุญาต ขอให้เจ้าของตรวจสอบสิทธิ์ USE ของแหล่งข้อมูลสำหรับ API ที่แชร์ให้คุณ',
  'Choose a saved source to configure this step.':
    'เลือกแหล่งข้อมูลที่บันทึกไว้เพื่อตั้งค่าขั้นตอนนี้',
  'Source details could not be loaded. Check the error above.':
    'โหลดรายละเอียดแหล่งข้อมูลไม่ได้ ตรวจสอบข้อผิดพลาดด้านบน',
  'Source access is required. Ask the owner to review your permissions and source USE.':
    'ต้องมีสิทธิ์เข้าถึงแหล่งข้อมูล ขอให้เจ้าของตรวจสอบสิทธิ์และสิทธิ์ USE ของแหล่งข้อมูล',
  'No sources are available to this account. Ask the owner to provide a source.':
    'บัญชีนี้ยังไม่มีแหล่งข้อมูลที่ใช้ได้ ขอให้เจ้าของจัดเตรียมแหล่งข้อมูล',
  'YOUR DATA, YOUR API': 'ข้อมูลของคุณ API ของคุณ',
  'Create an API': 'สร้าง API',
  'Choose the fields people can receive. We will create a draft you can test and publish in API Studio.':
    'เลือกข้อมูลที่จะส่งให้ผู้ใช้ เราจะสร้างฉบับร่างให้คุณทดสอบและเผยแพร่ใน API Studio',
  '{endpoint} after publication. Use letters, numbers, slashes, hyphens, or underscores.':
    '{endpoint} ใช้ได้หลังเผยแพร่ ใช้ตัวอักษร ตัวเลข เครื่องหมาย / - หรือ _',
  'Start with / and use letters, numbers, slashes, hyphens, or underscores.':
    'เริ่มด้วย / และใช้ตัวอักษร ตัวเลข / ขีดกลาง หรือขีดล่าง',
  'Fields to return': 'ข้อมูลที่จะส่งกลับ',
  'Original column → API field': 'คอลัมน์เดิม → ช่องข้อมูล API',
  'Return {column}': 'ส่งกลับ {column}',
  'Choose at least one field to continue.':
    'เลือกอย่างน้อยหนึ่งฟิลด์เพื่อดำเนินการต่อ',
  'Rows per request': 'จำนวนแถวต่อคำขอ',
  'Up to {count} rows': 'สูงสุด {count} แถว',
  'Filter by input': 'กรองด้วยข้อมูลนำเข้า',
  'Match a supplied value, or return all rows when it is omitted.':
    'จับคู่กับค่าที่ส่งมา หากไม่ส่งค่าจะคืนทุกแถว',
  'Filter column': 'คอลัมน์ที่ใช้กรอง',
  'Filter input name': 'ชื่อข้อมูลนำเข้าสำหรับกรอง',
  'Start with a lowercase letter. Use letters, numbers, or underscores.':
    'เริ่มด้วยตัวอักษรภาษาอังกฤษพิมพ์เล็ก ใช้ตัวอักษร ตัวเลข หรือขีดล่าง',
  'Callers send ?{input}=value in the URL. Omit it to return all rows. API keys control access to the API.':
    'ผู้เรียกใช้ส่ง ?{input}=value ใน URL หากไม่ส่งจะคืนทุกแถว คีย์ API ควบคุมการเข้าถึง API',
  'Callers supply {input} as an optional GraphQL query argument. Its type is created from the selected column. Omit it to return all rows; API keys control access.':
    'ผู้เรียกใช้ส่ง {input} เป็นอาร์กิวเมนต์ที่ไม่บังคับของคำสั่งค้นหา GraphQL ชนิดข้อมูลสร้างจากคอลัมน์ที่เลือก หากไม่ส่งจะคืนทุกแถว คีย์ API ควบคุมการเข้าถึง',
  'Create API from data': 'สร้าง API จากข้อมูล',
  'Discard unsaved draft changes and create this API?':
    'ละทิ้งการเปลี่ยนแปลงฉบับร่างที่ยังไม่ได้บันทึก แล้วสร้าง API นี้หรือไม่?',
  'API draft created. Test your data, then publish it.':
    'สร้างฉบับร่าง API แล้ว ทดสอบข้อมูลก่อนเผยแพร่',
  'API draft created. Read APIs access is needed to open API Studio.':
    'สร้างฉบับร่าง API แล้ว ต้องมีสิทธิ์อ่าน API จึงจะเปิด API Studio ได้',
}

export default messages
