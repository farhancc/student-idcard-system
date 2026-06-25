import * as XLSX from 'xlsx';
import path from 'path';

function main() {
  const filePath = path.join(process.cwd(), 'sample_cardholders.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log('Total Rows:', data.length);
  console.log('Sample Row:', data[0]);
  console.log('Headers:', Object.keys(data[0] || {}));
  console.log('All Data:', JSON.stringify(data, null, 2));
}

main();
