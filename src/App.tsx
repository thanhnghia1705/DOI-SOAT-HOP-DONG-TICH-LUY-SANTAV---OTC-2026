/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  FileSpreadsheet, 
  Play, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Search,
  RefreshCcw,
  BarChart3,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { cn } from '@/lib/utils';
import { FileUploader } from './components/FileUploader';
import { ReconciliationResult } from './types';
import { parseExcelFile, processReconciliation, exportToExcel, validateFileColumns } from './lib/excel-logic';

export default function App() {
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  
  const [fileStatuses, setFileStatuses] = useState<{
    orders: 'idle' | 'success' | 'error';
    products: 'idle' | 'success' | 'error';
    contracts: 'idle' | 'success' | 'error';
  }>({ orders: 'idle', products: 'idle', contracts: 'idle' });

  const [fileData, setFileData] = useState<{
    orders: any[];
    products: any[];
    contracts: any[];
  }>({ orders: [], products: [], contracts: [] });

  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleFileSelect = async (type: 'orders' | 'products' | 'contracts', file: File | null) => {
    if (type === 'orders') setOrderFile(file);
    if (type === 'products') setProductFile(file);
    if (type === 'contracts') setContractFile(file);

    setResults([]); // Reset results on file change

    if (file) {
      try {
        const data = await parseExcelFile(file);
        const missingCols = validateFileColumns(data, type);
        
        if (missingCols.length > 0) {
          setFileStatuses(prev => ({ ...prev, [type]: 'error' }));
          setValidationErrors(prev => [...prev, `File ${file.name} thiếu cột: ${missingCols.join(', ')}`]);
        } else {
          setFileStatuses(prev => ({ ...prev, [type]: 'success' }));
          setFileData(prev => ({ ...prev, [type]: data }));
          // Clear validation errors for this file if any
          setValidationErrors(prev => prev.filter(err => !err.includes(file.name)));
        }
      } catch (err) {
        setFileStatuses(prev => ({ ...prev, [type]: 'error' }));
        setError(`Lỗi khi đọc file ${file.name}`);
      }
    } else {
      setFileData(prev => ({ ...prev, [type]: [] }));
      setFileStatuses(prev => ({ ...prev, [type]: 'idle' }));
      // Clear validation errors for this file
      setValidationErrors([]);
    }
  };

  const handleProcess = async () => {
    if (!orderFile || !productFile || !contractFile) {
      setError('Vui lòng tải lên đầy đủ 3 file dữ liệu.');
      return;
    }

    if (fileStatuses.orders === 'error' || fileStatuses.products === 'error' || fileStatuses.contracts === 'error') {
      setError('Vui lòng kiểm tra và tải lại các file bị lỗi (màu đỏ).');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { results: reconciliationResults, errors } = processReconciliation(
        fileData.orders,
        fileData.products,
        fileData.contracts
      );

      if (errors.length > 0) {
        setValidationErrors(errors);
      } else {
        setResults(reconciliationResults);
      }
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi xử lý dữ liệu. Vui lòng kiểm tra định dạng file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredResults = results.filter(r => 
    r.pharmacyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.pharmacyId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalContracts: results.length,
    activePharmacies: results.filter(r => r.actualRevenue > 0).length,
    totalValidRows: results.reduce((sum, r) => sum + r.validOrders.length, 0),
    totalRevenue: results.reduce((sum, r) => sum + r.actualRevenue, 0)
  };

  return (
    <div className="min-h-screen bg-[#F3EFE0] font-sans text-[#031D44] relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-[-10%] w-[50vw] h-[50vw] bg-[#031D44]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#031D44]/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <header className="bg-gradient-to-r from-[#031D44] to-[#011432] text-[#F3EFE0] px-6 py-4 shadow-[0_4px_20px_rgba(3,29,68,0.2)] sticky top-0 z-50 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-[12px] flex items-center justify-center flex-shrink-0 border border-white/20 shadow-inner">
             <BarChart3 className="w-5 h-5 text-[#F3EFE0]" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-[20px] font-bold tracking-[0.02em] text-[#F3EFE0] leading-none mb-1 shadow-sm">SANTAV DASHBOARD</h1>
            <p className="text-[11px] text-[#F3EFE0]/50 font-semibold tracking-[0.1em] uppercase leading-none">Đối Soát Hợp Đồng OTC</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setOrderFile(null);
              setProductFile(null);
              setContractFile(null);
              setFileData({ orders: [], products: [], contracts: [] });
              setResults([]);
              setError(null);
              setValidationErrors([]);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-[14px] font-semibold border border-white/20 rounded-[10px] hover:bg-white/10 hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-200"
          >
            <RefreshCcw className="w-4 h-4" />
            Làm mới
          </button>
          {results.length > 0 && (
            <button 
              onClick={() => exportToExcel(results, fileData.orders, fileData.products, fileData.contracts)}
              className="flex items-center justify-center gap-2 bg-[#F3EFE0] text-[#031D44] px-5 py-2 text-[14px] font-bold rounded-[10px] hover:bg-white hover:-translate-y-[1px] transition-all duration-200 shadow-[0_4px_15px_rgba(243,239,224,0.15)]"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto p-6 md:p-8 lg:pt-12 space-y-8 relative z-10">
        
        {/* Upload Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="h-[28px] w-1.5 bg-[#031D44] rounded-full opacity-90 shadow-sm" />
             <div>
               <h2 className="text-[28px] font-bold text-[#031D44] leading-none mb-1.5 tracking-tight">Tải hồ sơ dữ liệu</h2>
               <p className="text-[#031D44]/60 text-[14px] font-medium">Vui lòng tải lên đúng biểu mẫu theo quy định để hệ thống đồng bộ và đối soát.</p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FileUploader 
              index={1}
              label="Đơn hàng" 
              description="Bao gồm ngày đơn, mã/tên nhà thuốc, mã/tên sản phẩm, doanh số."
              file={orderFile}
              onFileSelect={(f) => handleFileSelect('orders', f)}
              iconColor="bg-[#031D44]/10 text-[#031D44]"
              status={fileStatuses.orders}
            />
            <FileUploader 
              index={2}
              label="Sản phẩm" 
              description="Danh mục mã sản phẩm được tham gia tích lũy."
              file={productFile}
              onFileSelect={(f) => handleFileSelect('products', f)}
              iconColor="bg-[#031D44]/10 text-[#031D44]"
              status={fileStatuses.products}
            />
            <FileUploader 
              index={3}
              label="Hợp đồng" 
              description="Ngày bắt đầu, mã/tên nhà thuốc & doanh số cam kết."
              file={contractFile}
              onFileSelect={(f) => handleFileSelect('contracts', f)}
              iconColor="bg-[#031D44]/10 text-[#031D44]"
              status={fileStatuses.contracts}
            />
          </div>
        </section>

        {/* Action & Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-6 rounded-[22px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_18px_45px_rgba(3,29,68,0.10)] flex flex-col justify-between h-full">
            <h3 className="text-[18px] font-bold text-[#031D44] flex items-center gap-2 mb-5">
              <CheckCircle className="w-5 h-5 opacity-70" />
              Kiểm tra tệp tin
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Đơn hàng', count: fileData.orders.length, status: fileStatuses.orders },
                { label: 'Sản phẩm', count: fileData.products.length, status: fileStatuses.products },
                { label: 'Hợp đồng', count: fileData.contracts.length, status: fileStatuses.contracts },
              ].map((item, i) => (
                <div key={i} className={cn(
                  "flex items-center justify-between p-3.5 rounded-[14px] border transition-all shadow-sm",
                  item.status === 'success' 
                    ? "bg-emerald-500/10 border-emerald-500/30 backdrop-blur-md" 
                    : item.status === 'error'
                      ? "bg-rose-500/10 border-rose-500/30 backdrop-blur-md"
                      : "bg-white/40 border-white/60 opacity-80"
                )}>
                  <span className={cn("text-[14px] font-semibold", item.status === 'success' ? "text-[#031D44]" : "text-[#031D44]/70")}>{item.label}</span>
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "text-[12px] font-bold", 
                      item.status === 'success' ? "text-emerald-700" : "text-[#031D44]/40"
                    )}>
                      {item.count > 0 ? `${item.count} dòng` : "Chưa tải"}
                    </span>
                    {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 drop-shadow-sm" />}
                    {item.status === 'error' && <XCircle className="w-4 h-4 text-rose-600 drop-shadow-sm" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col justify-center items-center p-6 rounded-[22px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_18px_45px_rgba(3,29,68,0.10)] h-full">
            <div className="w-full max-w-[420px] flex flex-col items-center text-center space-y-4">
              <div>
                <h3 className="text-[20px] font-bold text-[#031D44]">Sẵn sàng xử lý dữ liệu</h3>
                <p className="text-[14px] text-[#031D44]/60 font-medium mt-1">Đảm bảo cả 3 tệp tin đã được tải lên thành công hợp lệ trước khi bắt đầu.</p>
              </div>
              <button 
                onClick={handleProcess}
                disabled={isProcessing || !orderFile || !productFile || !contractFile || fileStatuses.orders === 'error' || fileStatuses.products === 'error' || fileStatuses.contracts === 'error'}
                className="w-full flex items-center justify-center gap-3 h-[60px] text-[16px] font-bold rounded-[16px] bg-[#031D44] text-[#F3EFE0] hover:bg-[#021330] hover:shadow-[0_10px_25px_rgba(3,29,68,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-[2px] active:scale-[0.98] shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                    Đang đối soát...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    BẮT ĐẦU ĐỐI SOÁT NGAY
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Alerts */}
        <AnimatePresence>
          {(error || validationErrors.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="space-y-3"
            >
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 backdrop-blur-md">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <h4 className="font-bold text-sm">Lỗi hệ thống</h4>
                    <p className="text-sm opacity-90 mt-1">{error}</p>
                  </div>
                </div>
              )}
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 backdrop-blur-md">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <h4 className="font-bold text-sm">Lỗi cấu trúc dữ liệu</h4>
                    <p className="text-sm opacity-90 mt-1">{err}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Output Section */}
        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pt-4"
          >
            <div className="flex items-center gap-3">
               <div className="h-[28px] w-1.5 bg-[#031D44] rounded-full opacity-90 shadow-sm" />
               <h2 className="text-[28px] font-bold text-[#031D44] tracking-tight">Kết quả phân tích</h2>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
               {/* Primary Stat Card */}
               <div className="p-5 rounded-[20px] bg-[#031D44] text-[#F3EFE0] shadow-[0_12px_25px_rgba(3,29,68,0.3)] flex flex-col justify-between overflow-hidden relative group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[rgba(255,255,255,0.08)] rounded-full blur-[20px] group-hover:scale-[2] transition-transform duration-700" />
                  <p className="text-[11px] font-bold text-white/50 uppercase tracking-[0.05em] relative z-10">Tổng DL hợp lệ</p>
                  <p className="text-2xl md:text-[32px] font-black mt-2 leading-none relative z-10">
                    {stats.totalRevenue.toLocaleString('vi-VN')} <span className="text-[12px] font-bold opacity-70 ml-1">VNĐ</span>
                  </p>
               </div>
               
               <div className="p-5 rounded-[20px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_8px_20px_rgba(3,29,68,0.05)]">
                  <p className="text-[11px] font-bold text-[#031D44]/50 uppercase tracking-[0.05em]">SL Hợp đồng</p>
                  <p className="text-2xl md:text-[32px] font-black text-[#031D44] mt-2 leading-none">{stats.totalContracts}</p>
               </div>

               <div className="p-5 rounded-[20px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_8px_20px_rgba(3,29,68,0.05)]">
                  <p className="text-[11px] font-bold text-[#031D44]/50 uppercase tracking-[0.05em]">Có phát sinh</p>
                  <p className="text-2xl md:text-[32px] font-black text-emerald-700 mt-2 leading-none">{stats.activePharmacies}</p>
               </div>

               <div className="p-5 rounded-[20px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_8px_20px_rgba(3,29,68,0.05)]">
                  <p className="text-[11px] font-bold text-[#031D44]/50 uppercase tracking-[0.05em]">Đơn hàng hợp lệ</p>
                  <p className="text-2xl md:text-[32px] font-black text-[#031D44] mt-2 leading-none">{stats.totalValidRows}</p>
               </div>
            </div>

            {/* Table */}
            <div className="p-6 rounded-[22px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_18px_45px_rgba(3,29,68,0.1)] space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <div>
                   <h3 className="text-[18px] font-bold text-[#031D44]">Chi tiết tiến độ tích lũy</h3>
                   <p className="text-[14px] font-medium text-[#031D44]/60">Kiểm tra kết quả từng nhà thuốc.</p>
                 </div>
                 <div className="relative w-full md:w-80">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#031D44]/40" />
                  <Input 
                    placeholder="Tìm mã hoặc tên..." 
                    className="pl-10 h-[42px] rounded-[12px] bg-white/70 border-white/60 focus-visible:ring-[#031D44]/20 text-[14px] font-medium shadow-inner placeholder:text-[#031D44]/40"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="border border-white/50 rounded-[16px] overflow-hidden bg-white/30 backdrop-blur-md">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-[#white/40] sticky top-0 z-10 backdrop-blur-xl border-b border-white/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-4 text-[#031D44]/60 uppercase text-[10px] font-bold tracking-widest">Mã NT</TableHead>
                        <TableHead className="py-4 text-[#031D44]/60 uppercase text-[10px] font-bold tracking-widest">Tên nhà thuốc</TableHead>
                        <TableHead className="text-right py-4 text-[#031D44]/60 uppercase text-[10px] font-bold tracking-widest">Cam kết</TableHead>
                        <TableHead className="text-right py-4 text-[#031D44]/60 uppercase text-[10px] font-bold tracking-widest">Thực tế</TableHead>
                        <TableHead className="text-center py-4 text-[#031D44]/60 uppercase text-[10px] font-bold tracking-widest">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.length > 0 ? (
                        filteredResults.map((result) => {
                          const ratio = result.committedRevenue > 0 ? (result.actualRevenue / result.committedRevenue) * 100 : 0;
                          return (
                            <TableRow key={result.pharmacyId} className="border-b border-white/30 hover:bg-white/40 border-none transition-colors">
                              <TableCell className="py-3 font-mono text-xs font-semibold text-[#031D44]/60">{result.pharmacyId}</TableCell>
                              <TableCell className="py-3 font-semibold text-[#031D44] text-sm">{result.pharmacyName}</TableCell>
                              <TableCell className="text-right py-3 font-semibold text-[#031D44]/70 text-sm">
                                {result.committedRevenue.toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="text-right py-3">
                                <span className={cn(
                                  "font-bold text-base",
                                  result.isAchieved ? "text-emerald-700" : "text-[#031D44]"
                                )}>
                                  {result.actualRevenue.toLocaleString('vi-VN')}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <div className="flex flex-col items-center gap-1">
                                  <div className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-bold",
                                    result.isAchieved 
                                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" 
                                      : ratio > 0 ? "bg-[#031D44]/10 text-[#031D44] border border-[#031D44]/20" : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                                  )}>
                                    {ratio.toFixed(1)}%
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center">
                            <p className="font-semibold text-sm text-[#031D44]/40">Không tìm thấy dữ liệu.</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Empty State */}
        {results.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-[80px] text-center p-8 rounded-[22px] bg-[rgba(255,255,255,0.48)] backdrop-blur-[18px] border border-[rgba(255,255,255,0.42)] shadow-[0_18px_45px_rgba(3,29,68,0.06)] space-y-5">
            <div className="w-[84px] h-[84px] rounded-full bg-white/60 flex items-center justify-center border border-white/60 text-[#031D44]/30 shadow-inner">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-[20px] font-bold text-[#031D44]">Sẵn sàng nhận dữ liệu</h3>
              <p className="text-[#031D44]/60 font-medium text-[14px] leading-relaxed">
                Hệ thống đang chờ tải lên các tệp dữ liệu. Vui lòng hoàn thành quá trình tải lên ở phía trên để thấy kết quả đối soát.
              </p>
            </div>
          </div>
        )}

        {/* Footer Credit */}
        <footer className="pt-6 pb-12 text-center">
          <div className="inline-block px-8 py-3.5 rounded-[14px] bg-white/50 backdrop-blur-md border border-white/60 shadow-sm">
            <p className="text-[12px] font-bold text-[#031D44]/70 uppercase tracking-[0.1em]">
              PHẦN MỀM ĐỐI SOÁT NỘI BỘ - PHÒNG TRADE MARKETING - SANTAV <span className="font-black text-[#031D44] ml-1">(nguyenthanhnghia)</span>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
