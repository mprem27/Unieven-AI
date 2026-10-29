import io,unittest,importlib
class SeatingParserTests(unittest.TestCase):
    def parser(self):
        try:module=importlib.import_module('app.services.exam_seating')
        except ModuleNotFoundError:self.fail('A bounded seating parser is required.')
        return module.parse_seating_file
    def test_csv_matches_exact_vtu_ids_and_keeps_room_seat_columns(self):
        result=self.parser()('seating.csv',b'VTU Number,Hall,Room,Seat,Reporting Time\nvtu00000,Main Block,A101,S12,09:00\nVTU00001,Main Block,A102,S13,09:00\n')
        self.assertEqual(result['rows'][0]['vtuNumber'],'VTU00000');self.assertEqual(result['rows'][0]['seat'],'S12');self.assertEqual(result['rows'][1]['room'],'A102')
    def test_duplicate_ids_and_spreadsheet_formula_fields_are_rejected(self):
        parse=self.parser()
        for content in [b'VTU,Room,Seat\nVTU00000,A1,S1\nVTU00000,A2,S2',b'VTU,Room,Seat\nVTU00000,=HYPERLINK("bad"),S1']:
            with self.assertRaises(ValueError):parse('seating.csv',content)
    def test_xlsx_is_read_without_executing_formulas(self):
        from openpyxl import Workbook
        parse=self.parser();book=Workbook();sheet=book.active;sheet.append(['VTU Number','Room','Seat']);sheet.append(['VTU00000','A101','S12']);data=io.BytesIO();book.save(data)
        self.assertEqual(parse('seating.xlsx',data.getvalue())['rows'][0]['room'],'A101')
        sheet['B2']='=1+1';data=io.BytesIO();book.save(data)
        with self.assertRaises(ValueError):parse('seating.xlsx',data.getvalue())
    def test_text_pdf_table_and_scanned_pdf_require_correct_review(self):
        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject,NameObject,DictionaryObject
        parse=self.parser();writer=PdfWriter();page=writer.add_blank_page(width=600,height=800)
        stream=DecodedStreamObject();stream.set_data(b'BT /F1 10 Tf 40 740 Td (VTU Number    Room    Seat) Tj 0 -20 Td (VTU00000      A101    S12) Tj ET')
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        page[NameObject('/Contents')]=stream;data=io.BytesIO();writer.write(data)
        self.assertEqual(parse('seating.pdf',data.getvalue())['rows'][0]['seat'],'S12')
        blank=PdfWriter();blank.add_blank_page(width=600,height=800);data=io.BytesIO();blank.write(data)
        result=parse('scanned.pdf',data.getvalue());self.assertEqual(result['rows'],[]);self.assertTrue(result['warnings'])
    def test_oversized_wrong_format_and_active_pdf_are_rejected(self):
        from pypdf import PdfWriter
        parse=self.parser()
        with self.assertRaises(ValueError):parse('seating.csv',b'x'*(8*1024*1024+1))
        with self.assertRaises(ValueError):parse('seating.xlsx',b'not a spreadsheet')
        writer=PdfWriter();writer.add_blank_page(width=600,height=800);writer.add_js('app.alert("blocked")');data=io.BytesIO();writer.write(data)
        with self.assertRaises(ValueError):parse('seating.pdf',data.getvalue())

class SeatingRosterParserTests(unittest.TestCase):
    def parser(self):
        module=importlib.import_module('app.services.exam_seating')
        self.assertTrue(callable(getattr(module,'parse_seating_roster',None)),'An explicit roster parser is required.')
        return module.parse_seating_roster
    def test_roster_requires_exact_vtu_column_and_keeps_optional_names(self):
        result=self.parser()('roster.csv',b'VTU Number,Name\nvtu00001,One\nVTU00002,Two\n')
        self.assertEqual(result['students'],[{'vtuNumber':'VTU00001','name':'One'},{'vtuNumber':'VTU00002','name':'Two'}])
        for data in [b'Name\nVTU00001',b'VTU Number\nstudent1',b'VTU Number,VTU\nVTU00001,VTU00002']:
            with self.assertRaises(ValueError):self.parser()('roster.csv',data)
    def test_explicit_course_filter_uses_exact_codes_and_allows_only_filtered_deduplication(self):
        data=b'VTU Number,Course Code\nVTU00001,CS101\nVTU00001,CS-101\nVTU00002,CS1010\nVTU00003,MA101'
        with self.assertRaises(ValueError):self.parser()('roster.csv',data)
        result=self.parser()('roster.csv',data,course_code='cs-101')
        self.assertEqual(result['students'],[{'vtuNumber':'VTU00001'}]);self.assertTrue(result['warnings'])
        with self.assertRaises(ValueError):self.parser()('roster.csv',b'VTU Number\nVTU00001',course_code='CS101')
        with self.assertRaises(ValueError):self.parser()('roster.csv',data,course_code='CS10')
    def test_roster_rejects_formula_xlsx_and_zip_bombs(self):
        from openpyxl import Workbook
        import zipfile
        parse=self.parser()
        with self.assertRaises(ValueError):parse('roster.csv',b'VTU Number,Name\nVTU00001,=1+1')
        book=Workbook();book.active.append(['VTU Number','Name']);book.active.append(['VTU00001','=1+1']);data=io.BytesIO();book.save(data)
        with self.assertRaises(ValueError):parse('roster.xlsx',data.getvalue())
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w',zipfile.ZIP_DEFLATED) as archive:archive.writestr('xl/worksheets/sheet1.xml',b'x'*(25*1024*1024))
        with self.assertRaises(ValueError):parse('roster.xlsx',data.getvalue())
    def test_roster_limits_and_non_roster_formats_fail_closed(self):
        parse=self.parser()
        for filename,data in [('roster.pdf',b'%PDF-1'),('roster.csv',b'VTU Number\n'),('roster.csv',b'x'*(8*1024*1024+1))]:
            with self.assertRaises(ValueError):parse(filename,data)
        data='VTU Number\n'+'\n'.join(f'VTU{i:05}' for i in range(5001))
        with self.assertRaises(ValueError):parse('roster.csv',data.encode())

class CourseSeatingTests(unittest.TestCase):
    def test_course_import_preserves_source_rows_and_names_and_filters_exactly(self):
        from app.services.exam_seating import parse_seating_file
        result=parse_seating_file('seats.csv',b'Course Code,VTU Number,Name,Room,Seat\nCS-101,vtu00001,One,A1,S1\nCS1010,VTU00002,Two,A2,S2\nCS101,,Unique Name,A3,S3',course_code='cs101')
        self.assertEqual([r['sourceRow'] for r in result['rows']],[2,4])
        self.assertEqual(result['rows'][1]['name'],'Unique Name')
        self.assertEqual(result['rows'][0]['vtuNumber'],'VTU00001')
    def test_missing_subject_and_invalid_identity_are_reported_with_source_row(self):
        from app.services.exam_seating import parse_seating_file
        result=parse_seating_file('seats.csv',b'Course Code,VTU Number,Room,Seat\n,VTU00001,A1,S1\nCS101,bad,A2,S2',course_code='CS101')
        self.assertEqual(result['rows'],[])
        self.assertEqual([i['sourceRow'] for i in result['issues']],[2,3])

    def test_legacy_xls_has_actionable_conversion_error(self):
        from app.services.exam_seating import parse_seating_file
        with self.assertRaisesRegex(ValueError,'XLSX or CSV'):
            parse_seating_file('seats.xls',b'legacy workbook',course_code='CS101')
