/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';
import { Order, Product, Contract, ReconciliationResult } from '../types';

export const parseExcelFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

const parseDate = (dateInput: any): Date | null => {
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'number') {
    // Excel serial date to JS Date
    const dateObj = XLSX.SSF.parse_date_code(dateInput);
    return new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H, dateObj.M, dateObj.S);
  }
  if (typeof dateInput === 'string') {
    // Try common formats
    const formats = ['MM/dd/yyyy', 'MM-dd-yyyy', 'yyyy/MM/dd', 'dd/MM/yyyy'];
    for (const fmt of formats) {
      const parsed = parse(dateInput, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
  }
  return null;
};

export const validateFileColumns = (data: any[], type: 'orders' | 'products' | 'contracts'): string[] => {
  const orderCols = ['Ngày đơn hàng', 'Mã nhà thuốc', 'Tên nhà thuốc', 'Mã sản phẩm', 'Tên sản phẩm', 'Doanh số'];
  const productCols = ['Mã sản phẩm', 'Tên sản phẩm'];
  const contractCols = ['Ngày đăng ký hợp đồng', 'Mã nhà thuốc', 'Tên nhà thuốc', 'Mức doanh số cam kết'];

  const required = type === 'orders' ? orderCols : type === 'products' ? productCols : contractCols;
  
  if (data.length === 0) return ['File không có dữ liệu'];
  const firstRow = data[0];
  const missing = required.filter(col => !(col in firstRow));
  return missing;
};

export const processReconciliation = (
  ordersRaw: any[],
  productsRaw: any[],
  contractsRaw: any[]
): { results: ReconciliationResult[]; errors: string[] } => {
  const errors: string[] = [];

  // 1. Validate Columns
  const orderCols = ['Ngày đơn hàng', 'Mã nhà thuốc', 'Tên nhà thuốc', 'Mã sản phẩm', 'Tên sản phẩm', 'Doanh số'];
  const productCols = ['Mã sản phẩm', 'Tên sản phẩm'];
  const contractCols = ['Ngày đăng ký hợp đồng', 'Mã nhà thuốc', 'Tên nhà thuốc', 'Mức doanh số cam kết'];

  const checkCols = (data: any[], required: string[], fileName: string) => {
    if (data.length === 0) return;
    const firstRow = data[0];
    const missing = required.filter(col => !(col in firstRow));
    if (missing.length > 0) {
      errors.push(`File ${fileName} thiếu các cột: ${missing.join(', ')}`);
    }
  };

  checkCols(ordersRaw, orderCols, 'Đơn hàng');
  checkCols(productsRaw, productCols, 'Danh mục sản phẩm');
  // NOTE: For backward compatibility, we allow 'Ngày đăng ký hợp đồng' instead of strictly matching 'Ngày bắt đầu hợp đồng'
  // But we will parse both. Let's just use the strict check on the older standard
  checkCols(contractsRaw, contractCols, 'Hợp đồng');

  if (errors.length > 0) return { results: [], errors };

  // 2. Map Products
  const validProductIds = new Set(
    productsRaw.map((p) => String(p['Mã sản phẩm'] || '').trim().toUpperCase())
  );
  const validProductNames = new Set(
    productsRaw.map((p) => String(p['Tên sản phẩm'] || '').trim().toUpperCase())
  );

  // 3. Map Contracts
  const contracts: Contract[] = contractsRaw.map((c) => {
    const startDate = parseDate(c['Ngày bắt đầu hợp đồng'] || c['Ngày đăng ký hợp đồng']) || new Date();

    return {
      registrationDate: startDate,
      pharmacyId: String(c['Mã nhà thuốc'] || '').trim(),
      pharmacyName: String(c['Tên nhà thuốc'] || '').trim(),
      committedRevenue: Number(c['Mức doanh số cam kết'] || 0),
    };
  }).filter(c => c.pharmacyId);

  // 4. Map Orders
  const orders: Order[] = ordersRaw.map((o) => ({
    orderDate: parseDate(o['Ngày đơn hàng']) || new Date(),
    pharmacyId: String(o['Mã nhà thuốc'] || '').trim(),
    pharmacyName: String(o['Tên nhà thuốc'] || '').trim(),
    productId: String(o['Mã sản phẩm'] || '').trim().toUpperCase(),
    productName: String(o['Tên sản phẩm'] || '').trim().toUpperCase(),
    revenue: Number(o['Doanh số'] || 0),
  })).filter(o => o.pharmacyId);

  // 5. Group Results by Pharmacy
  const results: ReconciliationResult[] = contracts.map((contract) => {
    const pharmacyOrders = orders.filter((order) => {
      // Only pharmacies in contract
      if (order.pharmacyId !== contract.pharmacyId) return false;

      // Only products in catalog (by ID or exact Name)
      if (!validProductIds.has(order.productId) && !validProductNames.has(order.productName)) return false;

      // Only orders on or after start date
      const dOrder = new Date(order.orderDate);
      dOrder.setHours(0,0,0,0);
      const dStart = new Date(contract.registrationDate);
      dStart.setHours(0,0,0,0);

      return dOrder.getTime() >= dStart.getTime();
    });

    const actualRevenue = pharmacyOrders.reduce((sum, order) => sum + order.revenue, 0);

    return {
      pharmacyId: contract.pharmacyId,
      pharmacyName: contract.pharmacyName,
      registrationDate: contract.registrationDate,
      committedRevenue: contract.committedRevenue,
      actualRevenue,
      isAchieved: actualRevenue >= contract.committedRevenue,
      validOrders: pharmacyOrders,
    };
  });

  return { results, errors };
};

export const exportToExcel = (
  results: ReconciliationResult[],
  ordersRaw: any[],
  productsRaw: any[],
  contractsRaw: any[]
) => {
  // 1. Prepare valid products
  const validProductIds = new Set(
    productsRaw.map((p) => String(p['Mã sản phẩm'] || '').trim().toUpperCase())
  );
  const validProductNames = new Set(
    productsRaw.map((p) => String(p['Tên sản phẩm'] || '').trim().toUpperCase())
  );

  // 2. Prepare actual contracts with their computed dates
  const contractsObj: Record<string, { start: Date, name: string }> = {};
  const sheet5Data = contractsRaw.map(c => {
    const startDateRaw = parseDate(c['Ngày bắt đầu hợp đồng'] || c['Ngày đăng ký hợp đồng']);
    const startDate = startDateRaw || new Date();
    
    const pharmacyId = String(c['Mã nhà thuốc'] || '').trim();
    if (pharmacyId) {
      contractsObj[pharmacyId] = { start: startDate, name: String(c['Tên nhà thuốc'] || '').trim() };
    }

    return {
      'Mã nhà thuốc': pharmacyId,
      'Tên nhà thuốc': String(c['Tên nhà thuốc'] || '').trim(),
      'Ngày bắt đầu hợp đồng': startDateRaw ? startDate : 'THIẾU DỮ LIỆU',
      'Mức doanh số cam kết': c['Mức doanh số cam kết']
    };
  });

  // 3. Process every order for Sheet 1 & Sheet 3
  const sheet1DataAll = ordersRaw.map((o) => {
    const pharmacyId = String(o['Mã nhà thuốc'] || '').trim();
    const productId = String(o['Mã sản phẩm'] || '').trim().toUpperCase();
    const productName = String(o['Tên sản phẩm'] || '').trim().toUpperCase();
    const orderDateRaw = o['Ngày đơn hàng'];
    const orderDate = parseDate(orderDateRaw) || orderDateRaw;

    let isInCatalog = "NO";
    let catalogReason = "Không tìm thấy mã/tên trong danh mục HM";
    if (productId && validProductIds.has(productId)) {
        isInCatalog = "YES";
        catalogReason = "Khớp Mã SP";
    } else if (productName && validProductNames.has(productName)) {
        isInCatalog = "YES";
        catalogReason = "Khớp Tên SP";
    }

    let isIndates = "NO";
    let datesReason = "Thiếu dữ liệu HĐ hoặc ngày đơn lỗi";

    const contract = contractsObj[pharmacyId];
    if (contract && orderDate instanceof Date) {
        const dOrder = new Date(orderDate); dOrder.setHours(0,0,0,0);
        const dStart = new Date(contract.start); dStart.setHours(0,0,0,0);

        if (dOrder >= dStart) {
             isIndates = "YES";
             datesReason = "Trong thời gian HĐ";
        } else if (dOrder < dStart) {
             isIndates = "NO";
             datesReason = "Phát sinh TRƯỚC HĐ";
        }
    } else if (!contract) {
        datesReason = "Nhà thuốc không có HĐ";
    }

    const calculatedResult = (isInCatalog === "YES" && isIndates === "YES") ? "ĐƯỢC TÍNH" : "KHÔNG TÍNH";

    return {
       'Ngày đơn hàng': orderDate,
       'Mã nhà thuốc': String(o['Mã nhà thuốc'] || '').trim(),
       'Tên nhà thuốc': String(o['Tên nhà thuốc'] || '').trim(),
       'Mã sản phẩm': String(o['Mã sản phẩm'] || '').trim(),
       'Tên sản phẩm': String(o['Tên sản phẩm'] || '').trim(),
       'Số lượng': Number(o['Số lượng']) || 0,
       'Doanh số': Number(o['Doanh số']) || 0,
       'Ngày bắt đầu hợp đồng': null, 
       'CÓ TRONG DANH MỤC HỢP ĐỒNG': null, 
       'NẰM TRONG THỜI GIAN HỢP ĐỒNG': null, 
       'KẾT LUẬN TÍNH HỢP ĐỒNG': null, 
       'Căn cứ Danh mục': catalogReason,
       'Căn cứ Thời gian': datesReason,
       '_calcResult': calculatedResult
    };
  });

  const sheet3Data = sheet1DataAll.filter(row => row['_calcResult'] === 'KHÔNG TÍNH').map(row => {
     const newRow = { ...row };
     delete newRow['_calcResult'];
     return newRow;
  });

  const sheet1Data = sheet1DataAll.map(row => {
     const newRow = { ...row };
     delete newRow['_calcResult'];
     return newRow;
  });

  // 4. Results summary (Sheet 2)
  const sheet2Data = results.map(r => {
    const ratio = r.committedRevenue > 0 ? (r.actualRevenue / r.committedRevenue) : 0;
    const adjustedDate = new Date(r.registrationDate);

    return {
      'Ngày ký hợp đồng': adjustedDate,
      'Mã nhà thuốc': r.pharmacyId,
      'Tên nhà thuốc': r.pharmacyName,
      'Doanh số thực tế (Tổng)': r.actualRevenue,
      'Mức cam kết hợp đồng': r.committedRevenue,
      'Tỉ lệ đạt': ratio,
      'Trạng thái': r.isAchieved ? 'Đạt' : 'Chưa đạt'
    };
  });

  const generateDataSheetWithFormulas = (data: any[], wsTitle: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    if (!ws['!ref']) return ws;
    
    // Add formulas and formats
    for (let r = 0; r < data.length; r++) {
      const row = r + 2;
      // Date format A
      if (ws[`A${row}`] && ws[`A${row}`].t === 'd') ws[`A${row}`].z = 'dd/mm/yyyy';
      // Number format G
      if (ws[`G${row}`]) ws[`G${row}`].z = '#,##0';

      // Formulas
      // Lookup Start Date by ID, fallback to Name
      ws[`H${row}`] = { f: `IFERROR(XLOOKUP(B${row},'DANH SÁCH HỢP ĐỒNG NHÀ THUỐC'!$A:$A,'DANH SÁCH HỢP ĐỒNG NHÀ THUỐC'!$C:$C,IFERROR(XLOOKUP(C${row},'DANH SÁCH HỢP ĐỒNG NHÀ THUỐC'!$B:$B,'DANH SÁCH HỢP ĐỒNG NHÀ THUỐC'!$C:$C,""),"")),"")`, z: 'dd/mm/yyyy' };
      // Check Catalog
      ws[`I${row}`] = { t: 's', f: `IF(COUNTIF('DANH MỤC HỢP ĐỒNG'!$A:$A,D${row})>0,"YES","NO")` };
      // Check Dates (Only Start Date)
      ws[`J${row}`] = { t: 's', f: `IF(OR(H${row}="",H${row}="THIẾU DỮ LIỆU"),"THIẾU NGÀY BẮT ĐẦU HỢP ĐỒNG",IF(A${row}>=H${row},"YES","NO"))` };
      // Calculation Result
      ws[`K${row}`] = { t: 's', f: `IF(AND(I${row}="YES",J${row}="YES"),"ĐƯỢC TÍNH","KHÔNG TÍNH")` };
    }
    
    ws['!autofilter'] = { ref: ws['!ref'] };
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    return ws;
  };

  const ws1 = generateDataSheetWithFormulas(sheet1Data, 'DATA ĐƠN HÀNG HỢP ĐỒNG');
  const ws3 = generateDataSheetWithFormulas(sheet3Data, 'DÒNG KHÔNG ĐƯỢC TÍNH');

  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
  if (ws2['!ref']) {
    for (let r = 0; r < sheet2Data.length; r++) {
      const row = r + 2;
      if (ws2[`A${row}`] && ws2[`A${row}`].t === 'd') ws2[`A${row}`].z = 'dd/mm/yyyy';
      if (ws2[`D${row}`]) ws2[`D${row}`].z = '#,##0';
      if (ws2[`E${row}`]) ws2[`E${row}`].z = '#,##0';
      if (ws2[`F${row}`]) ws2[`F${row}`].z = '0.00%';
    }
    ws2['!autofilter'] = { ref: ws2['!ref'] };
    ws2['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  const ws4 = XLSX.utils.json_to_sheet(productsRaw);
  if (ws4['!ref']) {
    ws4['!autofilter'] = { ref: ws4['!ref'] };
    ws4['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  const ws5 = XLSX.utils.json_to_sheet(sheet5Data);
  if (ws5['!ref']) {
    for (let r = 0; r < sheet5Data.length; r++) {
      const row = r + 2;
      if (ws5[`C${row}`] && ws5[`C${row}`].t === 'd') ws5[`C${row}`].z = 'dd/mm/yyyy';
      if (ws5[`D${row}`]) ws5[`D${row}`].z = '#,##0'; // Mức doanh số cam kết
    }
    ws5['!autofilter'] = { ref: ws5['!ref'] };
    ws5['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws1, 'DATA ĐƠN HÀNG HỢP ĐỒNG');
  XLSX.utils.book_append_sheet(workbook, ws2, 'KẾT QUẢ TÍNH HỢP ĐỒNG');
  XLSX.utils.book_append_sheet(workbook, ws3, 'DÒNG KHÔNG ĐƯỢC TÍNH');
  XLSX.utils.book_append_sheet(workbook, ws4, 'DANH MỤC HỢP ĐỒNG');
  XLSX.utils.book_append_sheet(workbook, ws5, 'DANH SÁCH HỢP ĐỒNG NHÀ THUỐC');
  
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Doi_Soat_Hop_Dong_Tich_Luy_${dateStr}.xlsx`);
};
