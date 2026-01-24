import { create } from 'zustand';
import { Order, OrderStatus, DEPARTMENT_DICT, DEPARTMENTS, OperationLog, WarningStatus, User, Role, AuthState, OperationType, TargetType, getCarrierCode } from '../types';
import { apiService } from './api';

// 定义API响应数据结构接口
interface OrderApiResponse {
  order: Order;
  logs?: OperationLog[];
}

interface OrdersApiResponse {
  orders: Order[];
  logs?: OperationLog[];
}

interface CreatedOrdersApiResponse {
  createdOrders: Order[];
  logs?: OperationLog[];
}

interface WarningStatusApiResponse {
  warningStatus: WarningStatus;
}

interface UpdatedWarningsApiResponse {
  updatedOrders: Order[];
  logs?: OperationLog[];
}

// 解析物流详情的辅助函数
function parseTrackingDetails(details: string): any[] {
  if (!details || details === '//太长省略//') {
    return [];
  }
  
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    const nodes: any[] = [];
    
    const lines = details.split('\n');
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        nodes.push({
          time: parts[0].trim(),
          description: parts.slice(1).join('|').trim(),
        });
      }
    }
    
    return nodes;
  }
  
  return [];
}

// 从本地存储获取初始认证状态
const getInitialAuthState = (): AuthState => {
  const storedUser = localStorage.getItem('user');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const storedToken = localStorage.getItem('token');
  const storedCsrfToken = localStorage.getItem('csrfToken');

  // 打印认证状态信息
  console.log('从本地存储获取认证状态:', {
    isAuthenticated,
    storedUser: storedUser ? '存在' : '不存在',
    storedToken: storedToken ? '存在' : '不存在',
    storedCsrfToken: storedCsrfToken ? '存在' : '不存在'
  });

  if (isAuthenticated && storedUser && storedToken) {
    return {
      isAuthenticated: true,
      user: JSON.parse(storedUser),
      token: storedToken || null,
      csrfToken: storedCsrfToken || null
    };
  }

  return {
    isAuthenticated: false,
    user: null,
    token: null,
    csrfToken: null
  };
};

interface LogisticsStore {
  // 数据
  orders: Order[];
  operationLogs: OperationLog[];
  users: User[];
  
  // 认证状态
  auth: AuthState;
  
  // 加载状态
  loading: {
    [key: string]: boolean;
  };
  
  // 错误状态
  error: {
    [key: string]: string | null;
  };
  
  // ★★★ 新增进度状态 ★★★
  taskProgress: number;
  taskStatus: string; // 'idle' | 'creating' | 'polling' | 'saving' | 'completed' | 'error'
  
  // 订单相关Actions
  addOrder: (order: Partial<Order>) => Promise<{ success: boolean; message: string; data?: any }>;
  deleteOrder: (id: number) => Promise<{ success: boolean; message: string }>; // Soft delete
  restoreOrder: (id: number) => Promise<{ success: boolean; message: string }>;
  hardDeleteOrder: (id: number) => Promise<{ success: boolean; message: string }>;
  updateOrderStatus: (id: number, newStatus?: OrderStatus) => Promise<{ success: boolean; message: string }>; // Simulate API update
  importOrders: (newOrders: Order[], operator?: string) => Promise<{ success: boolean; message: string }>; // Return import result
  exportOrders: (filterCriteria?: any, operator?: string) => Promise<{ success: boolean; message: string; data: Order[] }>; // Return filtered orders for export
  refreshAllTracking: () => Promise<{ success: boolean; message: string; data?: any }>; // Simulate nightly batch update
  addOperationLog: (log: OperationLog) => void;
  calculateWarningStatus: (order: Order) => Promise<WarningStatus>;
  updateAllWarningStatuses: () => Promise<{ success: boolean; message: string; data?: any }>;
  fetchAllOrders: () => Promise<{ success: boolean; message: string }>;

  // 用户相关Actions
  fetchAllUsers: () => Promise<{ success: boolean; message: string }>;
  createUser: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: number, userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: number) => Promise<{ success: boolean; message: string }>;

  // 认证相关Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  setCsrfToken: (token: string) => void;
  updateUserProfile: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  isAdmin: () => boolean;
  isUser: () => boolean;

  // Selectors (Computed manually in components usually, but helpers here)
  getStats: (departmentKey?: string) => any;
  getFilteredOrders: (departmentKey?: string, status?: OrderStatus, warningStatus?: WarningStatus) => Order[];
}

export const useLogisticsStore = create<LogisticsStore>((set, get) => ({
  orders: [], // Empty initial data
  operationLogs: [],
  users: [], // Empty initial user data
  auth: getInitialAuthState(),
  loading: {},
  error: {},
  
  // ★★★ 新增初始进度状态 ★★★
  taskProgress: 0,
  taskStatus: 'idle',

  addOrder: async (order) => {
    try {
      set({ loading: { addOrder: true }, error: { addOrder: null }, taskProgress: 0, taskStatus: 'creating' });
      
      // 1. 准备数据
      // 从多个可能的字段中获取快递单号，包括嵌套对象中的字段
      // 优先使用快递单号相关字段，避免使用订单号字段
      const expressNumber = order.details?.tracking_number || order['快递单号'] || order.快递单号 || order['物流单号'] || order.物流单号 || order['tracking_number'] || order.tracking_number || order['logistics_number'] || order.logistics_number || order['express_number'] || order.express_number || order['delivery_number'] || order.delivery_number || order['运单号'] || order.运单号 || order['kddh'] || order.kddh || order.details?.['快递单号'] || order.details?.快递单号 || order.details?.['物流单号'] || order.details?.物流单号 || order.details?.logistics_number || order.details?.express_number || order.details?.delivery_number || order.details?.['运单号'] || order.details?.运单号 || order.details?.kddh;
      const phone = order.details?.phone ? String(order.details.phone).trim() : '';
      const tail = phone.length >= 4 ? phone.slice(-4) : '';
      const kddhsString = tail ? `${expressNumber}||${tail}` : expressNumber;
      
      // 快递公司名称到代码的映射
      const carrierNameToCode: Record<string, string> = {
        '中通': 'zhongtong', '中通快递': 'zhongtong',
        '顺丰': 'shunfeng', '顺丰速运': 'shunfeng', 'SF': 'shunfeng',
        '圆通': 'yuantong', '圆通速递': 'yuantong',
        '申通': 'shentong', '申通快递': 'shentong',
        '京东': 'jingdong', '京东物流': 'jingdong',
        '跨越': 'kuayuesuyun', '跨越速运': 'kuayuesuyun',
        '韵达': 'yunda', '韵达快递': 'yunda',
        '百世': 'bestsign', '百世快递': 'bestsign',
        '邮政': 'ems', 'EMS': 'ems', '邮政EMS': 'ems',
        '天天': 'tiantian', '天天快递': 'tiantian',
        '宅急送': 'zhaijisong',
        '全峰': 'quanfeng', '全峰快递': 'quanfeng',
        '快捷': 'kuaijie', '快捷快递': 'kuaijie',
        '优速': 'yousu', '优速快递': 'yousu',
        '国通': 'guotong', '国通快递': 'guotong',
        '速尔': 'suer', '速尔快递': 'suer',
        '如风达': 'rufengda',
        '德邦': 'debang', '德邦物流': 'debang',
        '安能': 'anneng', '安能物流': 'anneng',
        '天地华宇': 'tiandihuayu',
        '中铁': 'zhongtie', '中铁物流': 'zhongtie',
        '中远': 'zhongyuan', '中远物流': 'zhongyuan',
        '中邮': 'zhongyou', '中邮物流': 'zhongyou',
        '佳吉': 'jiajia', '佳吉物流': 'jiajia',
        '新邦': 'xinbang', '新邦物流': 'xinbang',
        '卡行天下': 'kaxingtianxia',
        '安信达': 'anxinda', '安信达快递': 'anxinda',
        '百福': 'baifu', '百福物流': 'baifu',
        '百世快运': 'bestsignkuaiyun',
        '城市100': 'chengshi100',
        '大田': 'datian', '大田物流': 'datian',
        '递四方': 'disifang',
        '东骏': 'dongjun', '东骏物流': 'dongjun',
        '飞康达': 'feikangda',
        '凡客': 'vancl', '凡客诚品': 'vancl',
        '港中能达': 'gangzhongnengda',
        '共速达': 'gongsuda',
        '恒路': 'henglu', '恒路物流': 'henglu',
        '红马物流': 'hongmawuliu',
        '华宇': 'huayu', '华宇物流': 'huayu',
        '汇通': 'huitong', '汇通快递': 'huitong',
        '佳怡': 'jiayi', '佳怡物流': 'jiayi',
        '加运美': 'jiayunmei',
        '快捷速递': 'kuaijiesudi',
        '联昊通': 'lianhaotong',
        '龙邦': 'longbang', '龙邦物流': 'longbang',
        '民邦': 'minbang', '民邦物流': 'minbang',
        '能达': 'nengda', '能达速递': 'nengda',
        '全日通': 'quanritong',
        '全一': 'quanyi', '全一快递': 'quanyi',
        '如风达快递': 'rufengdakuaidi',
        '三态': 'santai', '三态速递': 'santai',
        '盛辉': 'shenghui', '盛辉物流': 'shenghui',
        '盛丰': 'shengfeng', '盛丰物流': 'shengfeng',
        '速尔快递': 'suierkuaidi',
        'TNT': 'tnt',
        '天地华宇物流': 'tiandihuayuwuliu',
        'UPS': 'ups',
        '万家物流': 'wanjiawuliu',
        '威时沛运': 'weishipeiyun',
        '希伊艾斯': 'xiayiasi',
        '新邦物流': 'xinbangwuliu',
        '信丰': 'xinfeng', '信丰物流': 'xinfeng',
        '亚风速递': 'yafengsudi',
        '一邦': 'yibang', '一邦速递': 'yibang',
        '优速物流': 'yousuwuliu',
        '源伟丰': 'yuanweifeng',
        '远成': 'yuancheng', '远成物流': 'yuancheng',
        '韵达快运': 'yundaexpress',
        '运通': 'yuntong', '运通快递': 'yuntong',
        '宅急送快递': 'zhaijisongkuaidi',
        '中诚': 'zhongcheng', '中诚快递': 'zhongcheng',
        '中铁快运': 'zhongtiekeyun',
        '中外运': 'zhongwaiyun', '中外运物流': 'zhongwaiyun',
        '卓越': 'zhuoyue', '卓越亚马逊': 'zhuoyue'
      };
      
      // 获取并转换快递公司代码
      let carrierCode = order.details?.carrier || 'auto';
      if (carrierCode !== 'auto') {
        const normalizedCarrier = carrierCode.trim();
        carrierCode = carrierNameToCode[normalizedCarrier] || carrierCode;
      }

      // 2. 创建任务
      const createRes = await apiService.post<any>('/logistics-proxy/create', {
        kdgs: carrierCode,
        kddhs: kddhsString
      });

      if (!createRes.success || createRes.data?.code !== 1) {
        throw new Error(`创建任务失败: ${createRes.data?.msg || '未知错误'}`);
      }

      const taskName = createRes.data.msg;
      set({ taskStatus: 'polling', taskProgress: 10 });

      // 3. 轮询进度
      let logisticsResults: any[] = [];
      let retries = 0;
      const maxRetries = 60; // 最多等 2-3 分钟

      while (retries < maxRetries) {
        // 等待 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const selectRes = await apiService.post<any>('/logistics-proxy/select', {
          taskname: taskName,
          pageno: 1
        });

        // 检查是否是请求被驳回的错误
        const isMsgString = typeof selectRes.data?.msg === 'string';
        const isMessageString = typeof selectRes.message === 'string';
        const isRequestRejected = (isMsgString && selectRes.data?.msg.includes('此任务刚刚select过一次，故本次请求被驳回')) || 
                                 (isMessageString && selectRes.message.includes('此任务刚刚select过一次，故本次请求被驳回'));
        
        if (isRequestRejected) {
          // 处理请求被驳回错误，增加重试间隔
          console.warn(`请求被驳回，增加重试间隔 (第${retries}次重试)`);
          // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
          const backoffInterval = Math.min(2000 * Math.pow(2, retries), 30000); // 最大30秒
          console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffInterval));
        } else if (selectRes.success && selectRes.data?.code === 1) {
          const { jindu, list } = selectRes.data.msg;
          set({ taskProgress: Math.max(10, jindu) }); // 更新进度条

          if (jindu === 100) {
            logisticsResults = list || [];
            break;
          }
        }
        retries++;
      }

      if (retries >= maxRetries) {
        throw new Error('查询超时，请稍后手动刷新');
      }

      set({ taskStatus: 'saving', taskProgress: 100 });

      // 4. 合并数据并入库
      let orderToSave = order;
      const logInfo = logisticsResults.find((l: any) => {
        // 尝试直接匹配快递单号
        if (l.kddh === expressNumber) return true;
        // 尝试匹配不包含手机尾号的快递单号
        if (expressNumber.includes('||')) {
          const expressNumberOnly = expressNumber.split('||')[0];
          if (l.kddh === expressNumberOnly) return true;
        }
        // 尝试匹配包含手机尾号的快递单号
        const tail = phone.length >= 4 ? phone.slice(-4) : '';
        const expressNumberWithTail = tail ? `${expressNumber}||${tail}` : expressNumber;
        if (l.kddh === expressNumberWithTail) return true;
        return false;
      });
      
      if (logInfo) {
        // 检查物流轨迹中是否包含已签收/取出关键词
        let isDelivered = false;
        const trackingNodes = parseTrackingDetails(logInfo.xiangxiwuliu);
        if (trackingNodes.length > 0) {
          for (const node of trackingNodes) {
            if (node.description && (node.description.includes('签收') || node.description.includes('取出') || node.description.includes('包裹已从代收点取出') || node.description.includes('包裹已送至') || node.description.includes('已从代收点取出'))) {
              isDelivered = true;
              break;
            }
          }
        }
        
        orderToSave = {
          ...order,
          status: isDelivered || logInfo.wuliuzhuangtai.includes('签收') || logInfo.wuliuzhuangtai.includes('取出') || logInfo.wuliuzhuangtai.includes('包裹已从代收点取出') || logInfo.wuliuzhuangtai.includes('包裹已送至') ? OrderStatus.DELIVERED :
                  logInfo.wuliuzhuangtai.includes('退回') ? OrderStatus.RETURNED :
                  logInfo.wuliuzhuangtai.includes('运输') ? OrderStatus.IN_TRANSIT : OrderStatus.PENDING,
          details: {
            ...order.details,
            trackingInfo: logInfo,
            tracking: trackingNodes,
            lastTrackingUpdate: new Date().toISOString()
          }
        };
      }

      // 保存订单
      const saveRes = await apiService.post('/orders', orderToSave);
      
      if (!saveRes.success) {
        throw new Error(`保存订单失败: ${saveRes.message || '未知错误'}`);
      }

      // 5. 完成
      const state = get();
      const newOrder = saveRes.data?.order || orderToSave;
      
      const newLog: OperationLog = {
        id: Math.floor(Math.random() * 1000000), // 临时ID，后端会生成实际ID
        user_id: state.auth.user?.id,
        username: state.auth.user?.username || 'system',
        operation_type: OperationType.CREATE,
        target_type: TargetType.ORDER,
        target_id: newOrder.id?.toString() || '0',
        details: {
          description: `创建新订单 ${newOrder.order_number}`,
          order_data: newOrder,
          logistics_data: logInfo
        },
        ip_address: '127.0.0.1', // 实际应用中应获取真实IP
        created_at: new Date().toISOString()
      };
      
      // 重新获取所有订单以确保数据最新
      await get().fetchAllOrders();

      set({
        loading: { addOrder: false },
        taskStatus: 'completed',
        taskProgress: 0,
        operationLogs: [newLog, ...state.operationLogs]
      });

      return {
        success: true,
        message: '创建订单并获取物流信息成功',
        data: { order: newOrder }
      };
    } catch (error) {
      const msg = (error as Error).message;
      set({ loading: { addOrder: false }, error: { addOrder: msg }, taskStatus: 'error' });
      return { success: false, message: msg };
    }
  },
  
  deleteOrder: async (id) => {
    try {
      set({ loading: { deleteOrder: true }, error: { deleteOrder: null } });
      
      // 找到要删除的订单
      const state = get();
      const orderToDelete = state.orders.find(o => o.id === id);
      
      // 尝试调用API
      try {
        const response = await apiService.put<OrderApiResponse>(`/orders/${id}/archive`);
        if (response.success && response.data?.order) {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.ARCHIVE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `归档订单 ${orderToDelete?.order_number}`,
              order_id: id,
              order_number: orderToDelete?.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          set((state) => ({
            orders: state.orders.map(o => o.id === id ? response.data.order : o),
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, deleteOrder: false }
          }));
        }
        return { success: response.success, message: response.message || '归档订单成功' };
      } catch (apiError) {
        // API调用失败，在本地处理
        if (orderToDelete) {
          // 更新订单状态为已归档
          const updatedOrder = {
            ...orderToDelete,
            is_archived: true,
            updated_at: new Date().toISOString()
          };
          
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.ARCHIVE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `归档订单 ${orderToDelete.order_number}`,
              order_id: id,
              order_number: orderToDelete.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          // 更新状态
          set((state) => ({
            orders: state.orders.map(o => o.id === id ? updatedOrder : o),
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, deleteOrder: false }
          }));
          
          return { success: true, message: '归档订单成功' };
        }
        
        throw apiError;
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('归档订单失败:', error);
      set({ loading: { deleteOrder: false }, error: { deleteOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  restoreOrder: async (id) => {
    try {
      set({ loading: { restoreOrder: true }, error: { restoreOrder: null } });
      
      // 找到要恢复的订单
      const state = get();
      const orderToRestore = state.orders.find(o => o.id === id);
      
      // 尝试调用API
      try {
        const response = await apiService.put<OrderApiResponse>(`/orders/${id}/restore`);
        if (response.success && response.data?.order) {
          set((state) => ({
            orders: state.orders.map(o => o.id === id ? response.data.order : o),
            operationLogs: response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs,
            loading: { ...state.loading, restoreOrder: false }
          }));
        }
        return { success: response.success, message: response.message || '恢复订单成功' };
      } catch (apiError) {
        // API调用失败，在本地处理
        if (orderToRestore) {
          // 更新订单状态为已恢复
          const updatedOrder = {
            ...orderToRestore,
            is_archived: false,
            updated_at: new Date().toISOString()
          };
          
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.UPDATE,
            target_type: TargetType.ORDER,
            target_id: id.toString(),
            details: {
              description: `恢复订单 ${orderToRestore.order_number}`,
              order_id: id,
              order_number: orderToRestore.order_number
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };
          
          // 更新状态
          set((state) => ({
            orders: state.orders.map(o => o.id === id ? updatedOrder : o),
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, restoreOrder: false }
          }));
          
          return { success: true, message: '恢复订单成功' };
        }
        
        throw apiError;
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('恢复订单失败:', error);
      set({ loading: { restoreOrder: false }, error: { restoreOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  hardDeleteOrder: async (id) => {
    try {
      set({ loading: { hardDeleteOrder: true }, error: { hardDeleteOrder: null } });
      
      // 找到要删除的订单
      const state = get();
      const orderToDelete = state.orders.find(o => o.id === id);
      
      const response = await apiService.delete<{ logs?: OperationLog[] }>(`/orders/${id}`);
      if (response.success) {
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: state.auth.user?.id,
          username: state.auth.user?.username || 'system',
          operation_type: OperationType.DELETE,
          target_type: TargetType.ORDER,
          target_id: id.toString(),
          details: {
            description: `彻底删除订单 ${orderToDelete?.order_number}`,
            order_id: id,
            order_number: orderToDelete?.order_number
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };
        
        set((state) => ({
          orders: state.orders.filter(o => o.id !== id),
          operationLogs: [newLog, ...state.operationLogs],
          loading: { ...state.loading, hardDeleteOrder: false }
        }));
      }
      return { success: response.success, message: response.message || '彻底删除订单成功' };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('彻底删除订单失败:', error);
      set({ loading: { hardDeleteOrder: false }, error: { hardDeleteOrder: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  importOrders: async (newOrders, operator = 'system') => {
    try {
      set({ loading: { importOrders: true }, error: { importOrders: null }, taskProgress: 0, taskStatus: 'creating' });
      
      // 1. 准备数据：提取单号、手机号和快递公司，按快递公司分组
      // 格式：单号1||手机尾号1,单号2||手机尾号2,...
      
      // 快递公司名称到代码的映射
      const carrierNameToCode: Record<string, string> = {
        '中通': 'zhongtong', '中通快递': 'zhongtong',
        '顺丰': 'shunfeng', '顺丰速运': 'shunfeng', 'SF': 'shunfeng',
        '圆通': 'yuantong', '圆通速递': 'yuantong',
        '申通': 'shentong', '申通快递': 'shentong',
        '京东': 'jingdong', '京东物流': 'jingdong',
        '跨越': 'kuayuesuyun', '跨越速运': 'kuayuesuyun',
        '韵达': 'yunda', '韵达快递': 'yunda',
        '百世': 'bestsign', '百世快递': 'bestsign',
        '邮政': 'ems', 'EMS': 'ems', '邮政EMS': 'ems',
        '天天': 'tiantian', '天天快递': 'tiantian',
        '宅急送': 'zhaijisong',
        '全峰': 'quanfeng', '全峰快递': 'quanfeng',
        '快捷': 'kuaijie', '快捷快递': 'kuaijie',
        '优速': 'yousu', '优速快递': 'yousu',
        '国通': 'guotong', '国通快递': 'guotong',
        '速尔': 'suer', '速尔快递': 'suer',
        '如风达': 'rufengda',
        '德邦': 'debang', '德邦物流': 'debang',
        '安能': 'anneng', '安能物流': 'anneng',
        '天地华宇': 'tiandihuayu',
        '中铁': 'zhongtie', '中铁物流': 'zhongtie',
        '中远': 'zhongyuan', '中远物流': 'zhongyuan',
        '中邮': 'zhongyou', '中邮物流': 'zhongyou',
        '佳吉': 'jiajia', '佳吉物流': 'jiajia',
        '新邦': 'xinbang', '新邦物流': 'xinbang',
        '卡行天下': 'kaxingtianxia',
        '安信达': 'anxinda', '安信达快递': 'anxinda',
        '百福': 'baifu', '百福物流': 'baifu',
        '百世快运': 'bestsignkuaiyun',
        '城市100': 'chengshi100',
        '大田': 'datian', '大田物流': 'datian',
        '递四方': 'disifang',
        '东骏': 'dongjun', '东骏物流': 'dongjun',
        '飞康达': 'feikangda',
        '凡客': 'vancl', '凡客诚品': 'vancl',
        '港中能达': 'gangzhongnengda',
        '共速达': 'gongsuda',
        '恒路': 'henglu', '恒路物流': 'henglu',
        '红马物流': 'hongmawuliu',
        '华宇': 'huayu', '华宇物流': 'huayu',
        '汇通': 'huitong', '汇通快递': 'huitong',
        '佳怡': 'jiayi', '佳怡物流': 'jiayi',
        '加运美': 'jiayunmei',
        '快捷速递': 'kuaijiesudi',
        '联昊通': 'lianhaotong',
        '龙邦': 'longbang', '龙邦物流': 'longbang',
        '民邦': 'minbang', '民邦物流': 'minbang',
        '能达': 'nengda', '能达速递': 'nengda',
        '全日通': 'quanritong',
        '全一': 'quanyi', '全一快递': 'quanyi',
        '如风达快递': 'rufengdakuaidi',
        '三态': 'santai', '三态速递': 'santai',
        '盛辉': 'shenghui', '盛辉物流': 'shenghui',
        '盛丰': 'shengfeng', '盛丰物流': 'shengfeng',
        '速尔快递': 'suierkuaidi',
        'TNT': 'tnt',
        '天地华宇物流': 'tiandihuayuwuliu',
        'UPS': 'ups',
        '万家物流': 'wanjiawuliu',
        '威时沛运': 'weishipeiyun',
        '希伊艾斯': 'xiayiasi',
        '新邦物流': 'xinbangwuliu',
        '信丰': 'xinfeng', '信丰物流': 'xinfeng',
        '亚风速递': 'yafengsudi',
        '一邦': 'yibang', '一邦速递': 'yibang',
        '优速物流': 'yousuwuliu',
        '源伟丰': 'yuanweifeng',
        '远成': 'yuancheng', '远成物流': 'yuancheng',
        '韵达快运': 'yundaexpress',
        '运通': 'yuntong', '运通快递': 'yuntong',
        '宅急送快递': 'zhaijisongkuaidi',
        '中诚': 'zhongcheng', '中诚快递': 'zhongcheng',
        '中邮物流': 'zhongyouwuliu',
        '中铁快运': 'zhongtiekeyun',
        '中外运': 'zhongwaiyun', '中外运物流': 'zhongwaiyun',
        '卓越': 'zhuoyue', '卓越亚马逊': 'zhuoyue'
      };
      
      const ordersByCarrier: Record<string, Array<{ order_number: string; phone: string }>> = {};
      
      // 初始化错误数组
      let allErrors: string[] = [];
      
      // 按快递公司分组订单
      newOrders.forEach(o => {
        const phone = o.details?.phone ? String(o.details.phone).trim() : '';
        // 从订单数据中提取快递公司信息
        let carrier = o.details?.carrier || o.carrier || o.express_company || 'auto';
        
        // 转换快递公司名称为代码
        if (carrier !== 'auto') {
          const normalizedCarrier = carrier.trim();
          carrier = carrierNameToCode[normalizedCarrier] || carrier;
        }
        
        // 打印完整的订单对象，以便调试
        console.log(`完整订单对象:`, JSON.stringify(o, null, 2));
        
        // 从多个可能的字段中获取快递单号，包括嵌套对象中的字段
        // 优先使用快递单号相关字段，避免使用订单号字段
        const expressNumber = o.details?.tracking_number || o['快递单号'] || o.快递单号 || o['物流单号'] || o.物流单号 || o['tracking_number'] || o.tracking_number || o['logistics_number'] || o.logistics_number || o['express_number'] || o.express_number || o['delivery_number'] || o.delivery_number || o['运单号'] || o.运单号 || o['kddh'] || o.kddh || o.details?.['快递单号'] || o.details?.快递单号 || o.details?.['物流单号'] || o.details?.物流单号 || o.details?.logistics_number || o.details?.express_number || o.details?.delivery_number || o.details?.['运单号'] || o.details?.运单号 || o.details?.kddh;
        
        // 打印提取到的快递单号
        console.log(`提取到的快递单号:`, expressNumber);
        
        // 只有在快递单号存在且有效的情况下才添加到分组
        if (expressNumber && expressNumber.toString().trim() !== '') {
          if (!ordersByCarrier[carrier]) {
            ordersByCarrier[carrier] = [];
          }
          
          ordersByCarrier[carrier].push({ order_number: expressNumber, phone });
          console.log(`成功添加订单到分组，快递公司: ${carrier}，快递单号: ${expressNumber}`);
        } else {
          console.warn(`订单缺少有效快递单号，跳过处理:`, o);
          allErrors.push(`订单缺少有效快递单号，跳过处理`);
        }
      });
      
      // 为每个快递公司创建一个任务
      const tasks = [];
      for (const [carrier, orders] of Object.entries(ordersByCarrier)) {
        const kddhList = orders.map(o => {
          const tail = o.phone.length >= 4 ? o.phone.slice(-4) : '';
          return tail ? `${o.order_number}||${tail}` : o.order_number;
        });
        
        const kddhsString = kddhList.join(',');
        tasks.push({ carrier, kddhsString, orders });
      }

      // 2. 为每个快递公司创建任务并查询物流信息
      let allLogisticsResults: any[] = [];
      let totalTasks = tasks.length;
      let completedTasks = 0;
      
      console.log('=== 开始处理批量导入订单 ===');
      console.log(`总订单数: ${newOrders.length}`);
      console.log(`快递公司分组: ${Object.keys(ordersByCarrier).length} 个`);
      console.log(`分组详情:`, Object.entries(ordersByCarrier).map(([k, v]) => `${k}: ${v.length}个订单`));
      
      for (const task of tasks) {
        const { carrier, kddhsString, orders } = task;
        
        try {
          console.log(`=== 开始处理快递公司 ${carrier} 的订单 ===`);
          console.log(`订单数: ${orders.length}`);
          console.log(`订单号和手机号:`, orders.map(o => `${o.order_number}||${o.phone.slice(-4)}`));
          
          // 创建任务
          const createRes = await apiService.createBatchLogisticsTask({
            kdgs: carrier,
            kddhs: kddhsString,
            zffs: 'jinbi',
            isBackTaskName: 'yes'
          });

          console.log(`创建任务响应:`, createRes);
          
          if (!createRes.success || createRes.data?.code !== 1) {
            const errorMsg = `为快递公司 ${carrier} 创建任务失败: ${createRes.data?.msg || createRes.message || '未知错误'}`;
            console.error(errorMsg);
            allErrors.push(errorMsg);
            completedTasks++;
            continue;
          }

          const taskName = createRes.data.msg;
          console.log(`创建任务成功，任务名称: ${taskName}`);
          set({ taskStatus: 'polling', taskProgress: Math.floor((completedTasks / totalTasks) * 100) });

          // 轮询进度
          let logisticsResults: any[] = [];
          let retries = 0;
          const maxRetries = 60; // 最多等 3-4 分钟
          let taskCompleted = false;
          let lastRequestTime = 0;
          const minRequestInterval = 10000; // 最小请求间隔，单位：毫秒，增加到10秒

          while (retries < maxRetries) {
            try {
              // 计算距离上次请求的时间间隔
              const now = Date.now();
              const timeSinceLastRequest = now - lastRequestTime;
              
              // 如果距离上次请求的时间间隔小于最小请求间隔，等待到最小请求间隔
              if (timeSinceLastRequest < minRequestInterval) {
                const waitTime = minRequestInterval - timeSinceLastRequest;
                console.log(`距离上次请求时间过短，等待 ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // 记录本次请求的时间
              lastRequestTime = Date.now();
              
              // 支持分页查询，处理最多800条订单
              let currentPage = 1;
              let totalPages = 1;
              let requestRejected = false;
              
              do {
                const selectRes = await apiService.getBatchLogisticsResult({
                  taskname: taskName,
                  pageno: currentPage
                });

                console.log(`轮询第 ${retries} 次，页码 ${currentPage} 响应:`, selectRes);
                
                // 检查是否是请求被驳回的错误
                const isMsgString = typeof selectRes.data?.msg === 'string';
                const isMessageString = typeof selectRes.message === 'string';
                const isRequestRejected = (isMsgString && selectRes.data?.msg.includes('此任务刚刚select过一次，故本次请求被驳回')) || 
                                         (isMessageString && selectRes.message.includes('此任务刚刚select过一次，故本次请求被驳回'));
                
                if (isRequestRejected) {
                  // 处理请求被驳回错误，增加重试间隔
                  console.warn(`请求被驳回，增加重试间隔 (第${retries}次重试)`);
                  // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
                  const backoffInterval = Math.min(2000 * Math.pow(2, retries), 60000); // 最大60秒
                  console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
                  await new Promise(resolve => setTimeout(resolve, backoffInterval));
                  // 标记请求被驳回，跳过当前do-while循环的剩余迭代
                  requestRejected = true;
                  break;
                } else if (selectRes.success) {
                  if (selectRes.data?.code === 1) {
                    const { jindu, totalpage, list } = selectRes.data.msg;
                    console.log(`轮询第 ${retries} 次，进度 ${jindu}%，数据条数 ${list?.length || 0}`);
                    set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100 + (jindu / totalTasks) * 100) }); // 更新进度条

                    if (list && list.length > 0) {
                      console.log(`获取到物流信息:`, list.map(l => l.kddh));
                      // 避免重复添加物流信息
                      const newResults = list.filter((item: any) => 
                        !logisticsResults.some((existing: any) => existing.kddh === item.kddh)
                      );
                      logisticsResults = [...logisticsResults, ...newResults];
                      console.log(`当前累计物流信息: ${logisticsResults.length}条`);
                    }

                    totalPages = totalpage || 1;
                    currentPage++;

                    if (jindu === 100) {
                      console.log(`任务完成，进度 100%`);
                      taskCompleted = true;
                      break;
                    }
                  } else {
                    const errorMsg = `轮询失败: ${selectRes.data?.msg || '未知错误'}`;
                    console.error(errorMsg);
                    allErrors.push(errorMsg);
                  }
                } else {
                  const errorMsg = `轮询请求失败: ${selectRes.message || '网络错误'}`;
                  console.error(errorMsg);
                  allErrors.push(errorMsg);
                }
              } while (currentPage <= totalPages && currentPage <= 8 && !requestRejected); // 最多查询8页，每页100条，共800条
              
              // 如果请求被驳回，跳过当前while循环的剩余迭代，进入下一次while循环
              if (requestRejected) {
                console.log(`请求被驳回，跳过当前轮询迭代`);
                retries++;
                continue;
              }
              
              // 如果已经获取到物流信息，或者任务已经完成，就退出轮询
              if (logisticsResults.length > 0 || taskCompleted) {
                console.log(`轮询结束，获取到 ${logisticsResults.length} 条物流信息`);
                break;
              }
            } catch (error) {
              const errorMsg = `轮询查询进度失败: ${(error as Error).message}`;
              console.error(errorMsg);
              allErrors.push(errorMsg);
            }
            retries++;
          }

          // 将查询到的物流信息添加到总结果中
          if (logisticsResults.length > 0) {
            console.log(`为快递公司 ${carrier} 获取到 ${logisticsResults.length} 条物流信息`);
            // 避免重复添加物流信息
            const newResults = logisticsResults.filter((item: any) => 
              !allLogisticsResults.some((existing: any) => existing.kddh === item.kddh)
            );
            allLogisticsResults = [...allLogisticsResults, ...newResults];
            console.log(`当前总物流信息: ${allLogisticsResults.length}条`);
          } else {
            const errorMsg = `为快递公司 ${carrier} 未获取到物流信息`;
            console.error(errorMsg);
            allErrors.push(errorMsg);
          }
        } catch (error) {
          const errorMsg = `处理快递公司 ${carrier} 的订单失败: ${(error as Error).message}`;
          console.error(errorMsg);
          allErrors.push(errorMsg);
        } finally {
          completedTasks++;
          console.log(`=== 完成处理快递公司 ${carrier} 的订单 ===`);
          set({ taskProgress: Math.floor((completedTasks / totalTasks) * 100) });
        }
      }

      console.log(`=== 批量导入订单处理完成 ===`);
      console.log(`总订单数: ${newOrders.length}`);
      console.log(`获取到物流信息的订单数: ${allLogisticsResults.length}`);
      console.log(`错误信息:`, allErrors);
      
      if (allLogisticsResults.length === 0) {
        const errorMsg = `未获取到任何物流信息，请检查订单数据是否正确。错误详情: ${allErrors.join('; ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      set({ taskStatus: 'saving', taskProgress: 100 });

      // 4. 合并数据并入库
      // 将查询到的物流信息 (allLogisticsResults) 匹配回 newOrders
      const ordersToSave = newOrders.map(order => {
        // 从多个可能的字段中获取快递单号，包括嵌套对象中的字段
        const expressNumber = order.details?.tracking_number || order['快递单号'] || order.快递单号 || order['物流单号'] || order.物流单号 || order['tracking_number'] || order.tracking_number || order['logistics_number'] || order.logistics_number || order['express_number'] || order.express_number || order['delivery_number'] || order.delivery_number || order['运单号'] || order.运单号 || order['kddh'] || order.kddh || order.details?.['快递单号'] || order.details?.快递单号 || order.details?.['物流单号'] || order.details?.物流单号 || order.details?.logistics_number || order.details?.express_number || order.details?.delivery_number || order.details?.['运单号'] || order.details?.运单号 || order.details?.kddh;
        
        // 找到对应的物流结果
        const logInfo = allLogisticsResults.find((l: any) => {
          // 尝试直接匹配快递单号
          if (l.kddh === expressNumber) return true;
          // 尝试匹配不包含手机尾号的快递单号
          if (expressNumber.includes('||')) {
            const expressNumberOnly = expressNumber.split('||')[0];
            if (l.kddh === expressNumberOnly) return true;
          }
          // 尝试匹配包含手机尾号的快递单号
          const phone = order.details?.phone ? String(order.details.phone).trim() : '';
          const tail = phone.length >= 4 ? phone.slice(-4) : '';
          const expressNumberWithTail = tail ? `${expressNumber}||${tail}` : expressNumber;
          if (l.kddh === expressNumberWithTail) return true;
          return false;
        }); // 注意：API返回的可能不带后缀
        
        // 只有在获取到物流信息的情况下才创建订单
        if (logInfo) {
          // 准备基础订单数据，只包含后端接受的字段
          const phone = order.details?.phone ? String(order.details.phone).trim() : '';
          const recipient = order.details?.recipient ? String(order.details.recipient).trim() : '';
          
          // 确保customer_name长度大于或等于2个字符，优先使用收货人姓名
          let customerName = recipient || order.customer_name || '';
          if (!customerName || customerName.length < 2) {
            customerName = '未知'; // 2个字符，满足长度要求
          }
          
          const baseOrder = {
            order_number: order.order_number,
            customer_name: customerName,
            department_key: order.department_key || 'EAST',
            carrier: order.details?.carrier || order.carrier || '',
            carrier_code: order.details?.carrier_code || order.carrier_code || '',
            receiverPhone: phone // 后端期望的字段名是 receiverPhone
          };
          
          // 解析物流轨迹信息
          const timeline = [];
          let isDelivered = false;
          if (logInfo.xiangxiwuliu) {
            // 分割详细物流信息，提取时间和描述
            const logisticsLines = logInfo.xiangxiwuliu.split('<br>');
            for (const line of logisticsLines) {
              const timeMatch = line.match(/<i>([^<]+)<\/i>\s*\|\s*(.+)/);
              if (timeMatch) {
                const [, timeStr, description] = timeMatch;
                const trimmedDescription = description.trim();
                // 使用当前时间作为timestamp，因为物流信息中的时间格式可能不符合ISO要求
                timeline.push({
                  timestamp: new Date().toISOString(),
                  description: trimmedDescription,
                  location: '' // 从描述中提取位置信息，这里暂时留空
                });
                
                // 检查轨迹中是否包含已签收/取出关键词
                if (trimmedDescription.includes('签收') || trimmedDescription.includes('取出') || trimmedDescription.includes('包裹已从代收点取出') || trimmedDescription.includes('包裹已送至') || trimmedDescription.includes('已从代收点取出')) {
                  isDelivered = true;
                }
              }
            }
          }
          
          return {
            ...baseOrder,
            status: isDelivered || logInfo.wuliuzhuangtai.includes('签收') || logInfo.wuliuzhuangtai.includes('取出') || logInfo.wuliuzhuangtai.includes('包裹已从代收点取出') || logInfo.wuliuzhuangtai.includes('包裹已送至') ? OrderStatus.DELIVERED :
                    logInfo.wuliuzhuangtai.includes('退回') ? OrderStatus.RETURNED :
                    logInfo.wuliuzhuangtai.includes('运输') ? OrderStatus.IN_TRANSIT : OrderStatus.PENDING,
            details: {
              order_date: order.details?.order_date || new Date().toISOString(),
              destination: order.details?.destination || '',
              planned_ship_date: order.details?.planned_ship_date || new Date().toISOString(),
              carrier: order.details?.carrier || order.carrier || '',
              product_info: order.details?.product_info || '',
              phone: order.details?.phone || phone,
              note: order.details?.note || '',
              timeline: timeline,
              tracking_number: order.details?.tracking_number || order.tracking_number || expressNumber
            }
          };
        }
        // 没有物流信息时也创建订单
        // 准备基础订单数据，只包含后端接受的字段
        const phone = order.details?.phone ? String(order.details.phone).trim() : '';
        const recipient = order.details?.recipient ? String(order.details.recipient).trim() : '';
        
        // 确保customer_name长度大于或等于2个字符，优先使用收货人姓名
        let customerName = recipient || order.customer_name || '';
        if (!customerName || customerName.length < 2) {
          customerName = '未知'; // 2个字符，满足长度要求
        }
        
        const baseOrder = {
          order_number: order.order_number,
          customer_name: customerName,
          department_key: order.department_key || 'EAST',
          carrier: order.details?.carrier || order.carrier || '',
          carrier_code: order.details?.carrier_code || order.carrier_code || '',
          receiverPhone: phone // 后端期望的字段名是 receiverPhone
        };
        
        // 无论是否有物流信息，都创建订单
        return {
          ...baseOrder,
          status: OrderStatus.PENDING,
          details: {
            order_date: order.details?.order_date || new Date().toISOString(),
            destination: order.details?.destination || '',
            planned_ship_date: order.details?.planned_ship_date || new Date().toISOString(),
            carrier: order.details?.carrier || order.carrier || '',
            product_info: order.details?.product_info || '',
            phone: order.details?.phone || phone,
            note: order.details?.note || '',
            timeline: [],
            tracking_number: order.details?.tracking_number || order.tracking_number || expressNumber,
            recipient: recipient // 保存收货人姓名
          }
        };
      }); // 不再过滤，保留所有订单

      // 批量保存 (这里为了简单，循环调用 create，或者后端支持 bulk create)
      // 建议：循环调用 post /orders，虽然慢点但稳妥
      let savedCount = 0;
      for (const order of ordersToSave) {
        try {
           // 注意：这里需要确保 POST /orders 接口能接收 status 和 details
           await apiService.post('/orders', order);
           savedCount++;
           // 添加适当的延迟，避免请求频率过高
           await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
        } catch (e) {
           console.error('Save order failed', e);
        }
      }

      // 5. 完成
      // 更新本地状态和操作日志
      const state = get();
      const errorCount = newOrders.length - savedCount;
      
      const newLog: OperationLog = {
        id: Math.floor(Math.random() * 1000000),
        user_id: state.auth.user?.id,
        username: state.auth.user?.username || operator,
        operation_type: OperationType.IMPORT,
        target_type: TargetType.ORDER,
        target_id: 'batch_import',
        details: {
          description: errorCount > 0 ? 
            `批量导入了 ${savedCount} 个订单，${errorCount} 个订单导入失败` : 
            `批量导入了 ${savedCount} 个订单`,
          import_count: savedCount,
          failed_count: errorCount,
          operator: operator,
          source: 'API'
        },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      };
      
      // 重新获取所有订单以确保数据最新
      await get().fetchAllOrders();

      set({
        loading: { importOrders: false },
        taskStatus: 'completed',
        taskProgress: 0,
        operationLogs: [newLog, ...state.operationLogs]
      });

      return { success: errorCount === 0, message: `成功导入 ${savedCount} 条订单` };

    } catch (error) {
      const msg = (error as Error).message;
      set({ loading: { importOrders: false }, error: { importOrders: msg }, taskStatus: 'error' });
      return { success: false, message: msg };
    }
  },
  
  exportOrders: async (filterCriteria = {}, operator = 'system') => {
    try {
      set({ loading: { exportOrders: true }, error: { exportOrders: null } });
      const response = await apiService.get<{ orders: Order[]; logs?: OperationLog[] }>('/orders/export', { ...filterCriteria });
      if (response.success && response.data?.orders) {
        set((state) => ({
          operationLogs: response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs,
          loading: { ...state.loading, exportOrders: false }
        }));
        return { success: true, message: '导出成功', data: response.data.orders };
      }
      set((state) => ({ loading: { ...state.loading, exportOrders: false } }));
      return { success: false, message: '导出失败', data: [] };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('导出订单失败:', error);
      set({ loading: { exportOrders: false }, error: { exportOrders: errorMessage } });
      return { success: false, message: errorMessage, data: [] };
    }
  },

  updateOrderStatus: async (id, newStatus?: OrderStatus) => {
    try {
      set({ loading: { updateOrderStatus: true }, error: { updateOrderStatus: null } });
      const state = get();
      const order = state.orders.find(o => o.id === Number(id));
      
      if (order) {
        // 调用真实物流API获取最新状态
        try {
          // 使用queryAndSyncLogistics接口代替getSingleLogisticsResult
          const response = await apiService.queryAndSyncLogistics({
            kddh: order.order_number,
            kdgs: order.details?.carrier,
            phone: order.details?.phone, // 必须传手机号
            customer_name: order.customer_name,
            department_key: order.department_key
          });
          
          console.log('[updateOrderStatus] Sync response:', response);
          
          // 根据物流API响应更新订单状态
          if (response.success && response.data?.order) {
            const updatedOrder = response.data.order;
            
            set((state) => ({
              orders: state.orders.map(o => o.id === Number(id) ? updatedOrder : o),
              loading: { ...state.loading, updateOrderStatus: false }
            }));
            
            return { success: true, message: '物流状态已更新', data: { order: updatedOrder } };
          }
        } catch (logisticsError) {
          console.error('[updateOrderStatus] Logistics API error:', logisticsError);
          // 如果物流API调用失败，仍然尝试调用本地API
        }
      }
      
      // 回退到本地API调用
      const response = await apiService.put<OrderApiResponse>(`/orders/${id}/status`, { status: newStatus || OrderStatus.PENDING });
      if (response.success && response.data) {
        set((state) => ({
          orders: state.orders.map(o => o.id === Number(id) ? response.data.order : o),
          operationLogs: response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs,
          loading: { ...state.loading, updateOrderStatus: false }
        }));
      } else {
        set((state) => ({ loading: { ...state.loading, updateOrderStatus: false } }));
      }
      return { success: response.success, message: response.message || '更新订单状态成功', data: response.data };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('更新订单状态失败:', errorMessage);
      set({ loading: { updateOrderStatus: false }, error: { updateOrderStatus: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  refreshAllTracking: async () => {
    try {
      set({ loading: { refreshAllTracking: true }, error: { refreshAllTracking: null } });
      const response = await apiService.post<OrdersApiResponse>('/orders/refresh-tracking');
      if (response.success && response.data) {
        set((state) => ({
          orders: response.data.orders,
          loading: { ...state.loading, refreshAllTracking: false }
        }));
      } else {
        set((state) => ({ loading: { ...state.loading, refreshAllTracking: false } }));
      }
      return { success: response.success, message: response.message || '刷新物流信息成功', data: response.data };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('刷新所有物流信息失败:', errorMessage);
      set({ loading: { refreshAllTracking: false }, error: { refreshAllTracking: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },
  
  addOperationLog: (log) => set((state) => ({
    operationLogs: [log, ...state.operationLogs]
  })),
  
  calculateWarningStatus: async (order): Promise<WarningStatus> => {
    try {
      const response = await apiService.post<WarningStatusApiResponse>('/orders/calculate-warning', { order });
      return response.success && response.data ? response.data.warningStatus : WarningStatus.NONE;
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('计算预警状态失败:', errorMessage);
      return WarningStatus.NONE;
    }
  },
  
  updateAllWarningStatuses: async () => {
    try {
      set({ loading: { updateAllWarningStatuses: true }, error: { updateAllWarningStatuses: null } });
      const response = await apiService.post<UpdatedWarningsApiResponse>('/orders/update-all-warnings');
      if (response.success && response.data) {
        set((state) => ({
          orders: response.data.updatedOrders,
          operationLogs: response.data.logs ? [...response.data.logs, ...state.operationLogs] : state.operationLogs,
          loading: { ...state.loading, updateAllWarningStatuses: false }
        }));
      } else {
        set((state) => ({ loading: { ...state.loading, updateAllWarningStatuses: false } }));
      }
      return { success: response.success, message: response.message || '批量更新预警状态成功', data: response.data };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('批量更新预警状态失败:', errorMessage);
      set({ loading: { updateAllWarningStatuses: false }, error: { updateAllWarningStatuses: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 用户相关操作
  fetchAllUsers: async () => {
    try {
      set({ loading: { fetchAllUsers: true }, error: { fetchAllUsers: null } });
      const response = await apiService.getAllUsers();
      if (response.success && response.data?.users) {
        set((state) => ({
          users: response.data.users,
          loading: { ...state.loading, fetchAllUsers: false },
          error: { ...state.error, fetchAllUsers: null }
        }));
        return { success: true, message: '获取用户列表成功' };
      } else {
        set({ loading: { fetchAllUsers: false }, error: { fetchAllUsers: '获取失败' } });
        return { success: false, message: '获取失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('获取用户列表失败:', errorMessage);
      set({ loading: { fetchAllUsers: false }, error: { fetchAllUsers: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 获取操作日志
  fetchOperationLogs: async () => {
    try {
      set({ loading: { fetchOperationLogs: true }, error: { fetchOperationLogs: null } });
      const response = await apiService.get('/operation-logs');
      if (response.success) {
        // 确保我们使用的是正确的日志数据格式
        // 后端返回的格式：{ success: true, data: { logs: [], pagination: {} } }
        const logs = (response as any)?.data?.logs || [];
        set((state) => ({
          operationLogs: logs, // 使用后端返回的日志数据
          loading: { ...state.loading, fetchOperationLogs: false },
          error: { ...state.error, fetchOperationLogs: null }
        }));
        return { success: true, message: '获取操作日志成功' };
      } else {
        set({ loading: { fetchOperationLogs: false }, error: { fetchOperationLogs: response.message || '获取失败' } });
        return { success: false, message: response.message || '获取失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('获取操作日志失败:', errorMessage);
      set({ loading: { fetchOperationLogs: false }, error: { fetchOperationLogs: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  createUser: async (userData: any) => {
    try {
      set({ loading: { createUser: true }, error: { createUser: null } });
      const response = await apiService.createUser(userData);
      if (response.success && response.data?.user) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.CREATE,
            target_type: TargetType.USER,
            target_id: response.data.user.id.toString(),
            details: {
              description: `创建了新用户 ${response.data.user.username}`,
              username: response.data.user.username,
              role: response.data.user.role
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: [...state.users, response.data.user],
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, createUser: false },
            error: { ...state.error, createUser: null }
          };
        });
        return { success: true, message: '用户创建成功' };
      } else {
        set({ loading: { createUser: false }, error: { createUser: '创建失败' } });
        return { success: false, message: '创建失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('创建用户失败:', errorMessage);
      set({ loading: { createUser: false }, error: { createUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  updateUser: async (userId: number, userData: any) => {
    try {
      set({ loading: { updateUser: true }, error: { updateUser: null } });
      const response = await apiService.updateUser(userId, userData);
      if (response.success && response.data?.user) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.UPDATE,
            target_type: TargetType.USER,
            target_id: userId.toString(),
            details: {
              description: `更新了用户 ${response.data.user.username} 的信息`,
              user_id: userId,
              username: response.data.user.username,
              updated_fields: Object.keys(userData)
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: state.users.map(user => user.id === userId ? response.data?.user : user),
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, updateUser: false },
            error: { ...state.error, updateUser: null }
          };
        });
        return { success: true, message: '用户更新成功' };
      } else {
        set({ loading: { updateUser: false }, error: { updateUser: '更新失败' } });
        return { success: false, message: '更新失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('更新用户失败:', errorMessage);
      set({ loading: { updateUser: false }, error: { updateUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  deleteUser: async (userId: number) => {
    try {
      set({ loading: { deleteUser: true }, error: { deleteUser: null } });
      
      // Get the user before deletion to include in the log
      const state = get();
      const userToDelete = state.users.find(user => user.id === userId);
      
      const response = await apiService.deleteUser(userId);
      if (response.success) {
        set((state) => {
          // 创建操作日志
          const newLog: OperationLog = {
            id: Math.floor(Math.random() * 1000000),
            user_id: state.auth.user?.id || 0,
            username: state.auth.user?.username || 'system',
            operation_type: OperationType.DELETE,
            target_type: TargetType.USER,
            target_id: userId.toString(),
            details: {
              description: `删除了用户 ${userToDelete?.username || '未知用户'}`,
              user_id: userId,
              username: userToDelete?.username || '未知用户'
            },
            ip_address: '127.0.0.1',
            created_at: new Date().toISOString()
          };

          return {
            users: state.users.filter(user => user.id !== userId),
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, deleteUser: false },
            error: { ...state.error, deleteUser: null }
          };
        });
        return { success: true, message: '用户删除成功' };
      } else {
        set({ loading: { deleteUser: false }, error: { deleteUser: '删除失败' } });
        return { success: false, message: '删除失败' };
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('删除用户失败:', errorMessage);
      set({ loading: { deleteUser: false }, error: { deleteUser: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  // 认证相关操作
  login: async (user, token) => {
    // 更新本地存储
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('token', token);
    
    // 创建登录日志
    const loginLog: OperationLog = {
      id: Math.floor(Math.random() * 1000000),
      user_id: user.id,
      username: user.username,
      operation_type: OperationType.LOGIN,
      target_type: TargetType.USER,
      target_id: user.id.toString(),
      details: {
        description: `用户 ${user.username} 登录系统`
      },
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString()
    };
    
    // 先更新登录状态和本地日志
    set((state) => ({
      auth: {
        isAuthenticated: true,
        user,
        token,
        csrfToken: state.auth.csrfToken || null
      },
      operationLogs: [loginLog, ...state.operationLogs]
    }));
    
    // 然后获取完整的操作日志历史
    try {
      const response = await apiService.get('/operation-logs');
      if (response.success) {
        // 确保我们使用的是正确的日志数据格式
        // 后端返回的格式：{ success: true, data: { logs: [], pagination: {} } }
        const logs = (response as any)?.data?.logs || [];
        // 添加最新的登录日志到后端返回的日志列表
        set((state) => ({
          operationLogs: [loginLog, ...logs]
        }));
      }
    } catch (error) {
      console.error('登录后获取操作日志失败:', error);
      // 获取失败不影响登录流程，继续使用本地日志
    }
  },

  logout: async () => {
    // 在单个set调用中创建登出日志并更新状态
    const state = get();
    const username = state.auth.user?.username || '未知用户';
    const userId = state.auth.user?.id || 0;
    
    // 创建登出日志
    const logoutLog: OperationLog = {
      id: Math.floor(Math.random() * 1000000),
      user_id: userId,
      username,
      operation_type: OperationType.LOGOUT,
      target_type: TargetType.USER,
      target_id: userId.toString(),
      details: {
        description: `用户 ${username} 退出系统`
      },
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString()
    };
    
    // 将日志保存到后端
    try {
      await apiService.createOperationLog(logoutLog);
    } catch (error) {
      console.error('保存登出日志到后端失败:', error);
      // 保存失败不影响主流程
    }
    
    // 更新状态
    set({
      auth: {
        isAuthenticated: false,
        user: null,
        token: null,
        csrfToken: null
      },
      operationLogs: [logoutLog, ...state.operationLogs]
    });
    
    // 清除本地存储
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('csrfToken');
  },

  setCsrfToken: (token) => {
    // 保存CSRF令牌到本地存储
    localStorage.setItem('csrfToken', token);
    
    // 更新状态
    set((state) => ({
      auth: {
        ...state.auth,
        csrfToken: token
      }
    }));
  },

  fetchAllOrders: async () => {
    try {
      const state = get();
      if (!state.auth.isAuthenticated || !state.auth.user) {
        console.log('fetchAllOrders: 用户未登录');
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { fetchAllOrders: true }, error: { fetchAllOrders: null } });
      
      // ✅ 修复：只从本地后端API获取订单数据，移除直接调用第三方物流API的部分
      console.log('fetchAllOrders: 开始调用本地后端API获取订单数据...');
      let localOrders: Order[] = [];
      
      try {
        const localResponse = await apiService.get<{ orders: Order[] }>('/orders', { page: 1, limit: 100, is_archived: false });
        if (localResponse.success && localResponse.data && localResponse.data.orders) {
          console.log(`fetchAllOrders: 本地后端API返回了 ${localResponse.data.orders.length} 条订单数据`);
          localOrders = localResponse.data.orders;
        }
      } catch (localError) {
        console.error('fetchAllOrders: 调用本地后端API失败:', (localError as Error).message);
        throw localError;
      }
      
      console.log(`fetchAllOrders: 总共 ${localOrders.length} 条订单数据`);
      
      // 更新状态
      set((state) => ({
        orders: localOrders,
        loading: { ...state.loading, fetchAllOrders: false }
      }));
      
      return { 
        success: true, 
        message: `成功获取 ${localOrders.length} 条订单数据` 
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('fetchAllOrders: 获取订单数据失败:', errorMessage, error);
      
      set({ loading: { fetchAllOrders: false }, error: { fetchAllOrders: errorMessage } });
      return { success: false, message: `获取订单数据失败: ${errorMessage}` };
    }
  },
  updateUserProfile: async (userData) => {
    try {
      const state = get();
      const currentUser = state.auth.user;
      
      if (!currentUser) {
        console.log('updateUserProfile: 用户未登录');
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { updateUserProfile: true }, error: { updateUserProfile: null } });
      
      // 调试：查看发送到后端的数据和当前用户信息
      console.log('发送到后端的用户数据:', userData);
      console.log('当前用户信息:', currentUser);
      
      // 调用后端API更新用户信息
      const response = await apiService.put(`/users/${currentUser.id}`, userData);
      
      console.log('后端返回的响应:', response);
      
      let updatedUser;
      
      if (response.success) {
        // 修复：正确处理后端返回的数据格式
        // 后端返回格式: { success: true, data: { user } }
        // 经过api.ts响应拦截器处理后: { success: true, data: { data: { user } }, message: '请求成功' }
        
        if ((response as any)?.data?.user) {
          // 最常见的情况：经过响应拦截器处理后的格式
          updatedUser = (response as any).data.user;
        } else if ((response as any)?.user) {
          // 直接从响应中获取user
          updatedUser = (response as any).user;
        } else {
          // 后备方案：直接使用当前用户信息 + 更新的数据
          updatedUser = { ...currentUser, ...userData };
        }
        
        // 确保updatedUser包含所有必要的字段，特别是id和token相关的信息
        const finalUpdatedUser = {
          ...currentUser,  // 保留原有用户信息（包括id、token等）
          ...updatedUser,  // 更新修改的字段
          id: currentUser.id, // 确保ID不会被错误修改
          token: state.auth.token // 确保token不会丢失
        };
        
        // 更新本地存储
        localStorage.setItem('user', JSON.stringify(finalUpdatedUser));
        localStorage.setItem('isAuthenticated', 'true'); // 确保isAuthenticated仍然是true
        localStorage.setItem('token', state.auth.token); // 确保token也被保存
        
        // 调试：检查本地存储的内容
        console.log('最终更新的用户信息:', finalUpdatedUser);
        console.log('本地存储的user:', localStorage.getItem('user'));
        console.log('本地存储的isAuthenticated:', localStorage.getItem('isAuthenticated'));
        console.log('本地存储的token:', localStorage.getItem('token'));
        
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: finalUpdatedUser.id,
          username: finalUpdatedUser.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: finalUpdatedUser.id.toString(),
          details: {
            description: `用户 ${finalUpdatedUser.username} 更新了个人信息`,
            changes: userData
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };

        // 将日志保存到后端
        try {
          await apiService.createOperationLog(newLog);
        } catch (error) {
          console.error('保存操作日志到后端失败:', error);
          // 保存失败不影响主流程
        }
        
        // 更新状态
        set((state) => ({
          auth: {
            ...state.auth,
            user: finalUpdatedUser,
            token: state.auth.token // 再次确保token不会丢失
          },
          operationLogs: [newLog, ...state.operationLogs],
          loading: { ...state.loading, updateUserProfile: false }
        }));
        
        return { success: true, message: '更新个人信息成功' };
      } else {
        // 如果后端API调用失败，回退到本地更新
        console.log('后端API调用失败，回退到本地更新');
        
        // 创建本地更新的用户信息
        const localUpdatedUser = {
          ...currentUser,
          ...userData,
          updated_at: new Date().toISOString(),
          id: currentUser.id, // 确保ID不会被错误修改
          token: state.auth.token // 确保token不会丢失
        };
        
        // 更新本地存储
        localStorage.setItem('user', JSON.stringify(localUpdatedUser));
        localStorage.setItem('isAuthenticated', 'true'); // 确保isAuthenticated仍然是true
        localStorage.setItem('token', state.auth.token); // 确保token也被保存
        
        // 调试：检查本地存储的内容
        console.log('本地更新后的用户信息:', localUpdatedUser);
        
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: localUpdatedUser.id,
          username: localUpdatedUser.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: localUpdatedUser.id.toString(),
          details: {
            description: `用户 ${localUpdatedUser.username} 更新了个人信息 (本地更新)`,
            changes: userData
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };

        // 将日志保存到后端
        try {
          await apiService.createOperationLog(newLog);
        } catch (error) {
          console.error('保存操作日志到后端失败:', error);
          // 保存失败不影响主流程
        }
        
        // 更新状态
        set((state) => ({
          auth: {
            ...state.auth,
            user: localUpdatedUser,
            token: state.auth.token // 确保token不会丢失
          },
          operationLogs: [newLog, ...state.operationLogs],
          loading: { ...state.loading, updateUserProfile: false }
        }));
        
        return { 
          success: false, 
          message: `更新个人信息失败，但已在本地保存: ${response.message || '服务器错误'}` 
        };
      }
    } catch (error) {
      // 调试：查看错误详情
      console.error('更新个人信息失败:', error);
      
      // 确保本地存储仍然保持认证状态
      localStorage.setItem('isAuthenticated', 'true');
      
      // 调试：检查本地存储的内容
      console.log('错误处理后的本地存储:');
      console.log('isAuthenticated:', localStorage.getItem('isAuthenticated'));
      console.log('user:', localStorage.getItem('user'));
      console.log('token:', localStorage.getItem('token'));
      
      // 更新状态，停止加载
      set({ loading: { updateUserProfile: false }, error: { updateUserProfile: '更新失败，请稍后重试' } });
      
      return { success: false, message: '更新失败，请稍后重试' };
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    try {
      const state = get();
      if (!state.auth.user) {
        return { success: false, message: '用户未登录' };
      }
      
      set({ loading: { changePassword: true }, error: { changePassword: null } });
      const response = await apiService.put(`/users/${state.auth.user.id}/password`, { oldPassword, password: newPassword });
      
      if (response.success) {
        // 创建操作日志
        const newLog: OperationLog = {
          id: Math.floor(Math.random() * 1000000),
          user_id: state.auth.user.id,
          username: state.auth.user.username,
          operation_type: OperationType.UPDATE,
          target_type: TargetType.USER,
          target_id: state.auth.user.id.toString(),
          details: {
            description: `用户 ${state.auth.user.username} 修改了密码`
          },
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString()
        };
        
        set((state) => ({
          operationLogs: [newLog, ...state.operationLogs],
          loading: { ...state.loading, changePassword: false }
        }));
        
        return { success: true, message: response.message || '修改密码成功' };
      }
      
      set((state) => ({ loading: { ...state.loading, changePassword: false } }));
      return { success: false, message: response.message || '修改密码失败' };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error('修改密码失败:', errorMessage);
      set({ loading: { changePassword: false }, error: { changePassword: errorMessage } });
      return { success: false, message: errorMessage };
    }
  },

  isAdmin: () => {
    const state = get();
    return state.auth.user?.role === Role.ADMIN;
  },

  isUser: () => {
    const state = get();
    return state.auth.user?.role === Role.USER;
  },

  getStats: (departmentKey?) => {
    const state = get();
    const targetOrders = departmentKey 
      ? state.orders.filter(o => o.department_key === departmentKey && !o.is_archived)
      : state.orders.filter(o => !o.is_archived);
    
    const stats = {
      key: departmentKey || 'all',
      name: departmentKey ? (DEPARTMENT_DICT[departmentKey]?.name || '未知部门') : '全部部门',
      total: targetOrders.length,
      [OrderStatus.PENDING]: 0,
      [OrderStatus.IN_TRANSIT]: 0,
      [OrderStatus.DELIVERED]: 0,
      [OrderStatus.RETURNED]: 0,
      warningCount: 0,
      delayShipmentCount: 0,
      transitAbnormalCount: 0
    };

    targetOrders.forEach(o => {
      stats[o.status]++;
      
      // Count warnings
      if (o.warning_status !== WarningStatus.NONE) {
        stats.warningCount++;
      }
      
      if (o.warning_status === WarningStatus.DELAY_SHIPMENT) {
        stats.delayShipmentCount++;
      } else if (o.warning_status === WarningStatus.TRANSIT_ABNORMAL) {
        stats.transitAbnormalCount++;
      }
    });

    return stats;
  },
  
  getFilteredOrders: (department?, status?, warningStatus?) => {
    const state = get();
    return state.orders.filter(order => {
      if (order.is_archived) return false;
      if (department && order.department_key !== department) return false;
      if (status && order.status !== status) return false;
      if (warningStatus && order.warning_status !== warningStatus) return false;
      return true;
    });
  }
}));