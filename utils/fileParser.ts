import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { Order, OrderStatus, WarningStatus, DEPARTMENT_DICT, DEPARTMENTS } from '../types';

// 导入模板字段映射
interface ImportRow {
  '客户/项目名称': string;
  '申请单号/外部订单号':string;
  '收货地址': string;
  '收货人':string;
  '收货人电话': string;
  '物料名称': string;
  '订单号':string;
  '快递公司': string;
  '快递单号':string;
  '备注'?: string;
}

export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 验证表头
        const headers = jsonData[0] as string[];
        const requiredHeaders = ['客户/项目名称', '申请单号/外部订单号', '收货地址', '收货人', '收货人电话', '物料名称', '订单号', '快递公司', '快递单号'];
        
        for (const header of requiredHeaders) {
          if (!headers.includes(header)) {
            reject(new Error(`Excel文件缺少必要列: ${header}`));
            return;
          }
        }
        
        // 转换为对象数组（跳过表头）
        const rows = jsonData.slice(1).map((row: any[]) => {
          const rowObj: Record<string, any> = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index];
          });
          return rowObj;
        });
        
        resolve(rows);
      } catch (error) {
        reject(new Error('解析Excel文件失败: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('读取Excel文件失败'));
    reader.readAsArrayBuffer(file);
  });
};

export const parseCSVFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'utf-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('解析CSV文件失败: ' + results.errors[0].message));
          return;
        }
        resolve(results.data);
      },
      error: (error) => {
        reject(new Error('读取CSV文件失败: ' + error.message));
      }
    });
  });
};

export const processImportData = (rawData: any[]): { orders: Order[]; errors: Array<{ row: number; message: string }> } => {
  const orders: Order[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const existingOrderNumbers = new Set<string>();
  
  rawData.forEach((row, index) => {
    const importRow = row as ImportRow;
    const rowNumber = index + 2; // 行号从2开始（跳过表头）
    
    // 验证必填字段
    if (!importRow['客户/项目名称']) {
      errors.push({ row: rowNumber, message: '客户/项目名称不能为空' });
      return;
    }
    
    if (!importRow['申请单号/外部订单号']) {
      errors.push({ row: rowNumber, message: '申请单号/外部订单号不能为空' });
      return;
    }
    
    if (!importRow['收货地址']) {
      errors.push({ row: rowNumber, message: '收货地址不能为空' });
      return;
    }
    
    if (!importRow['收货人']) {
      errors.push({ row: rowNumber, message: '收货人不能为空' });
      return;
    }
    
    if (!importRow['收货人电话']) {
      errors.push({ row: rowNumber, message: '收货人电话不能为空' });
      return;
    }
    
    if (!importRow['物料名称']) {
      errors.push({ row: rowNumber, message: '物料名称不能为空' });
      return;
    }
    
    if (!importRow['订单号']) {
      errors.push({ row: rowNumber, message: '订单号不能为空' });
      return;
    }
    
    if (!importRow['快递公司']) {
      errors.push({ row: rowNumber, message: '快递公司不能为空' });
      return;
    }
    
    if (!importRow['快递单号']) {
      errors.push({ row: rowNumber, message: '快递单号不能为空' });
      return;
    }
    
    // 检查订单号重复（后端有唯一约束）
    const orderNumber = String(importRow['订单号']).trim();
    if (existingOrderNumbers.has(orderNumber)) {
      errors.push({ row: rowNumber, message: `订单号重复: ${orderNumber}` });
      return;
    }
    
    // 验证日期格式 - 不再需要日期字段
    
    // 检查部门是否存在 - 不再需要部门字段
    
    try {
      // 使用当前日期作为默认的下单日期和计划发货日
      const currentDate = new Date().toISOString();
      
      const order: Order = {
        id: Math.floor(Math.random() * 1000000), // 临时ID，后端会生成实际ID
        order_number: orderNumber,
        customer_name: String(importRow['客户/项目名称']).trim(),
        department_key: DEPARTMENTS[0].key, // 使用默认部门
        user_id: 1, // 添加默认用户ID，与后端实体默认值一致
        status: OrderStatus.PENDING,
        is_archived: false,
        warning_status: WarningStatus.NONE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        details: {
          order_date: currentDate,
          destination: String(importRow['收货地址']).trim(),
          planned_ship_date: currentDate,
          carrier: String(importRow['快递公司']).trim(),
          product_info: String(importRow['物料名称']).trim(),
          note: importRow['备注'] ? String(importRow['备注']).trim() : undefined,
          phone: String(importRow['收货人电话']).trim(),
          recipient: String(importRow['收货人']).trim(),
          application_number: String(importRow['申请单号/外部订单号']).trim(),
          tracking_number: String(importRow['快递单号']).trim(),
          timeline: [],
          created_by: 'system' // 实际应用中应从用户上下文获取
        }
      };
      
      orders.push(order);
      existingOrderNumbers.add(order.order_number);
    } catch (error) {
      errors.push({ row: rowNumber, message: '数据处理错误: ' + (error as Error).message });
    }
  });
  
  return { orders, errors };
};

export const generateImportTemplate = () => {
  const headers = ['客户/项目名称', '申请单号/外部订单号', '收货地址', '收货人', '收货人电话', '物料名称', '订单号', '快递公司', '快递单号', '备注'];
  const sampleData = [
    ['项目Alpha', 'APPLY-001', '上海市', '张三', '13800138000', '电子元器件', 'ORDER-001', '顺丰速运', 'SF1234567890', '紧急订单'],
    ['客户B', 'APPLY-002', '广州市', '李四', '13900139000', '办公用品', 'ORDER-002', '圆通快递', 'YT0987654321', '']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单导入模板');
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 20 }, // 客户/项目名称
    { wch: 25 }, // 申请单号/外部订单号
    { wch: 15 }, // 收货地址
    { wch: 10 }, // 收货人
    { wch: 15 }, // 收货人电话
    { wch: 20 }, // 物料名称
    { wch: 15 }, // 订单号
    { wch: 12 }, // 快递公司
    { wch: 15 }, // 快递单号
    { wch: 30 }  // 备注
  ];
  
  XLSX.writeFile(workbook, '订单导入模板.xlsx');
};

// 导出数据为Excel文件
export const exportOrdersToExcel = (orders: Order[], filterCriteria?: any) => {
  // 应用筛选条件
  let filteredOrders = [...orders];
  
  if (filterCriteria) {
      // 按部门筛选
      if (filterCriteria.department) {
        filteredOrders = filteredOrders.filter(order => order.department_key === filterCriteria.department);
      }
      
      // 按时间范围筛选
      if (filterCriteria.dateRange) {
        const startDate = new Date(filterCriteria.dateRange.start);
        const endDate = new Date(filterCriteria.dateRange.end);
        
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = order.details?.order_date ? new Date(order.details.order_date) : new Date();
          return orderDate >= startDate && orderDate <= endDate;
        });
      }
      
      // 按物流状态筛选
      if (filterCriteria.status) {
        filteredOrders = filteredOrders.filter(order => order.status === filterCriteria.status);
      }
      
      // 按承运商筛选
      if (filterCriteria.carrier) {
        filteredOrders = filteredOrders.filter(order => order.details?.carrier === filterCriteria.carrier);
      }
    
    // 按预警状态筛选
    if (filterCriteria.warningStatus) {
      filteredOrders = filteredOrders.filter(order => order.warning_status === filterCriteria.warningStatus);
    }
    
    // 按搜索关键词筛选（物流单号或客户名称）
    if (filterCriteria.searchTerm) {
      const searchTerm = filterCriteria.searchTerm.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.order_number.toLowerCase().includes(searchTerm) ||
        order.customer_name.toLowerCase().includes(searchTerm)
      );
    }
  }
  
  // 转换数据格式，适合导出
  const exportData = filteredOrders.map(order => {
    // 获取最新轨迹节点
    const latestTrackingNode = order.details?.timeline?.length > 0 ? order.details.timeline[0] : null;
    
    return {
      '物流单号': order.order_number,
      '客户/项目名称': order.customer_name,
      '下单日期': order.details?.order_date ? new Date(order.details.order_date).toLocaleDateString() : '',
      '目的地': order.details?.destination || '',
      '计划发货日': order.details?.planned_ship_date ? new Date(order.details.planned_ship_date).toLocaleDateString() : '',
      '业务部门': order.department_key,
      '当前状态': order.status,
      '承运商': order.details?.carrier || '',
      '产品信息': order.details?.product_info || '',
      '备注': order.details?.note || '',
      '预警状态': order.warning_status,
      '最后更新时间': new Date(order.updated_at).toLocaleString(),
      '最新轨迹节点': latestTrackingNode ? `${latestTrackingNode.location} - ${latestTrackingNode.description}` : '无',
      '创建时间': order.created_at ? new Date(order.created_at).toLocaleString() : '',
      '创建人': order.details?.created_by || ''
    };
  });
  
  // 创建工作表
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单数据');
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 }, // 物流单号
    { wch: 20 }, // 客户/项目名称
    { wch: 12 }, // 下单日期
    { wch: 15 }, // 目的地
    { wch: 15 }, // 计划发货日
    { wch: 12 }, // 业务部门
    { wch: 10 }, // 当前状态
    { wch: 12 }, // 承运商
    { wch: 20 }, // 产品信息
    { wch: 30 }, // 备注
    { wch: 12 }, // 预警状态
    { wch: 18 }, // 最后更新时间
    { wch: 30 }, // 最新轨迹节点
    { wch: 18 }, // 创建时间
    { wch: 10 }  // 创建人
  ];
  
  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `物流订单数据_${timestamp}.xlsx`;
  
  // 导出文件
  XLSX.writeFile(workbook, filename);
};
