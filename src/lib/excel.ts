import ExcelJS from 'exceljs';

/**
 * Read an Excel/CSV file buffer and return rows as key-value objects.
 */
export async function readExcelFile(buffer: ArrayBuffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '');
  });

  const rows: Record<string, any>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, any> = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (key) obj[key] = cell.value;
    });
    if (Object.keys(obj).length > 0) rows.push(obj);
  });

  return rows;
}

/**
 * Create and download an Excel file from JSON data with multiple sheets.
 */
export async function writeExcelFile(
  sheets: { name: string; data: Record<string, any>[] }[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();

  for (const { name, data } of sheets) {
    if (data.length === 0) continue;
    const sheet = workbook.addWorksheet(name);
    const keys = Object.keys(data[0]);

    sheet.columns = keys.map(key => ({
      header: key,
      key,
      width: Math.max(key.length + 2, 15),
    }));

    for (const row of data) {
      sheet.addRow(row);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
