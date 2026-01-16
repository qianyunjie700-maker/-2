import { create } from 'zustand';
import { Order, OrderStatus, DEPARTMENT_DICT, DEPARTMENTS, OperationLog, WarningStatus, User, Role, AuthState, OperationType, TargetType } from '../types';
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

// 从本地存储获取初始认证状态
const getInitialAuthState = (): AuthState => {
  const storedUser = localStorage.getItem('user');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const storedToken = localStorage.getItem('token');
  const storedCsrfToken = localStorage.getItem('csrfToken');

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

  addOrder: async (order) => {
    try {
      set({ loading: { addOrder: true }, error: { addOrder: null } });
      
      // 直接调用queryAndSyncLogistics接口完成识别、查询和同步
      const response = await apiService.queryAndSyncLogistics({
        kddh: order.order_number,
        kdgs: order.details?.carrier, // 从details.carrier获取承运商信息
        customer_name: order.customer_name,
        department_key: order.department_key
      });
      
      if (response.code !== 0 || !response.msg) {
        throw new Error(`识别并获取物流信息失败: ${response.msg || '未知错误'}`);
      }
      
      if (response.msg.order) {
        set((state) => {
          const newOrder = response.msg.order;
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
              logistics_data: response.msg.logisticsInfo
            },
            ip_address: '127.0.0.1', // 实际应用中应获取真实IP
            created_at: new Date().toISOString()
          };
          
          return {
            orders: [newOrder, ...state.orders],
            operationLogs: [newLog, ...state.operationLogs],
            loading: { ...state.loading, addOrder: false }
          };
        });
        
        return { success: true, message: '创建订单并获取物流信息成功', data: response.msg };
      }
      
      set({ loading: { addOrder: false }, error: { addOrder: '无法获取订单数据' } });
      return { success: false, message: '无法获取订单数据' };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('创建订单失败:', error);
      set({ loading: { addOrder: false }, error: { addOrder: errorMessage } });
      return { success: false, message: errorMessage };
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
      set({ loading: { importOrders: true }, error: { importOrders: null } });
      
      // 1. 批量调用queryAndSyncLogistics接口
      const ordersResults = await Promise.all(newOrders.map(async (order) => {
        try {
          const result = await apiService.queryAndSyncLogistics({
            kddh: order.order_number,
            customer_name: order.customer_name || '未知客户',
            department_key: order.department_key
          });
          
          if (result.code !== 0 || !result.msg || !result.msg.order) {
            return {
              order,
              success: false,
              error: `识别并获取物流信息失败: ${result.msg || '未知错误'}`
            };
          }
          
          return {
            order,
            success: true,
            data: result.msg
          };
        } catch (error) {
          return {
            order,
            success: false,
            error: `识别并获取物流信息失败: ${(error as Error).message}`
          };
        }
      }));
      
      // 2. 收集成功导入的订单
      const createdOrders = ordersResults
        .filter(item => item.success)
        .map(item => item.data.order);
      
      // 3. 更新状态和操作日志
      const state = get();
      const successCount = createdOrders.length;
      const errorCount = newOrders.length - successCount;
      
      const newLog: OperationLog = {
        id: Math.floor(Math.random() * 1000000),
        user_id: state.auth.user?.id,
        username: state.auth.user?.username || operator,
        operation_type: OperationType.IMPORT,
        target_type: TargetType.ORDER,
        target_id: 'batch_import',
        details: {
          description: errorCount > 0 ? 
            `批量导入了 ${successCount} 个订单，${errorCount} 个订单导入失败` : 
            `批量导入了 ${successCount} 个订单`,
          import_count: successCount,
          failed_count: errorCount,
          operator: operator,
          source: 'API'
        },
        ip_address: '127.0.0.1',
        created_at: new Date().toISOString()
      };
      
      set((state) => ({
        orders: [...createdOrders, ...state.orders],
        operationLogs: [newLog, ...state.operationLogs],
        loading: { ...state.loading, importOrders: false }
      }));
      
      // 返回导入结果
      return {
        success: errorCount === 0,
        message: errorCount > 0 ? 
          `部分导入成功：${successCount} 个订单成功，${errorCount} 个订单失败` : 
          `成功导入 ${successCount} 个订单`
      };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
      console.error('导入订单失败:', error);
      set({ loading: { importOrders: false }, error: { importOrders: errorMessage } });
      return { success: false, message: `导入失败：${errorMessage}` };
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
          const logisticsResponse = await apiService.getSingleLogisticsResult({
            kdgs: order.details?.carrier || 'unknown',
            kddh: order.order_number
          });
          
          console.log('[updateOrderStatus] Logistics API response:', logisticsResponse);
          
          // 根据物流API响应更新订单状态
          if (logisticsResponse.code === 0 && logisticsResponse.msg) {
            // 假设API返回了有效的物流信息
            const newOrderStatus = logisticsResponse.msg.wuliuzhuangtai === '已签收' ? OrderStatus.DELIVERED : 
                                  logisticsResponse.msg.wuliuzhuangtai === '运输中' ? OrderStatus.IN_TRANSIT : 
                                  OrderStatus.PENDING;
            
            // 更新本地订单状态
            const updatedOrder = { ...order, status: newOrderStatus, updated_at: new Date().toISOString() };
            
            // 如果API返回了轨迹信息，更新订单轨迹
            if (logisticsResponse.msg.xiangxiwuliu) {
              updatedOrder.details = { 
                ...updatedOrder.details, 
                tracking: [
                  { 
                    id: Date.now().toString(), 
                    timestamp: logisticsResponse.msg.zuixinshijian, 
                    location: '', 
                    description: logisticsResponse.msg.zuihouwuliu 
                  }
                ]
              };
            }
            
            set((state) => ({
              orders: state.orders.map(o => o.id === Number(id) ? updatedOrder : o),
              loading: { ...state.loading, updateOrderStatus: false }
            }));
            
            return { success: true, message: '更新订单状态成功', data: { order: updatedOrder } };
          }
        } catch (logisticsError) {
          console.error('[updateOrderStatus] Logistics API error:', logisticsError);
          // 如果物流API调用失败，仍然尝试调用本地API
        }
      }
      
      // 回退到本地API调用
      const response = await apiService.put<OrderApiResponse>(`/orders/${id}/status`, { status: newStatus });
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
      
      // 1. 首先从本地后端API获取数据（包含手动录入的订单）
      console.log('fetchAllOrders: 开始调用本地后端API获取订单数据...');
      let localOrders: Order[] = [];
      try {
        const localResponse = await apiService.get<{ orders: Order[] }>('/orders', { page: 1, limit: 100, is_archived: false });
        if (localResponse.success && localResponse.data && localResponse.data.orders) {
          console.log(`fetchAllOrders: 本地后端API返回了 ${localResponse.data.orders.length} 条订单数据`);
          localOrders = localResponse.data.orders;
        }
      } catch (localError) {
        console.warn('fetchAllOrders: 调用本地后端API失败，将只使用第三方物流API数据:', (localError as Error).message);
      }
      
      // 2. 从第三方物流API获取数据
      console.log('fetchAllOrders: 开始调用第三方物流API获取订单数据...');
      let logisticsOrders: Order[] = [];
      try {
        const logisticsResponse = await apiService.getBatchLogisticsResult({
          taskname: 'latest_orders',
          pageno: 1
        });
        
        if (logisticsResponse.code === 0) {
          // 检查响应是否是字符串形式的消息（如"任务不存在"）
          if (typeof logisticsResponse.msg === 'string') {
            console.log(`fetchAllOrders: 第三方物流API返回消息: ${logisticsResponse.msg}`);
          } 
          // 检查响应是否是对象形式且包含list字段
          else if (logisticsResponse.msg && typeof logisticsResponse.msg === 'object' && logisticsResponse.msg.list) {
            console.log(`fetchAllOrders: 第三方物流API返回了 ${logisticsResponse.msg.list.length} 条订单数据`);
            
            logisticsOrders = logisticsResponse.msg.list.map((item, index) => ({
              id: -index - 1, // 使用负数ID避免与本地订单冲突
              order_number: item.kddh,
              customer_name: item.dingdanhao || '未知客户',
              department_key: 'EAST',
              status: OrderStatus.PENDING,
              warning_status: WarningStatus.NONE,
              is_archived: false,
              details: {
                carrier: item.kdgs || 'UNKNOWN',
                order_date: new Date().toISOString(),
                planned_ship_date: new Date().toISOString(),
                destination: '',
                product_info: '',
                phone: ''
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          }
        }
      } catch (logisticsError) {
        console.warn('fetchAllOrders: 调用第三方物流API失败，将只使用本地后端数据:', (logisticsError as Error).message);
      }
      
      // 3. 合并订单数据，优先使用本地订单数据（避免重复）
      const mergedOrders = [...localOrders];
      const localOrderNumbers = new Set(localOrders.map(o => o.order_number));
      
      // 添加本地没有的物流订单
      logisticsOrders.forEach(logisticsOrder => {
        if (!localOrderNumbers.has(logisticsOrder.order_number)) {
          mergedOrders.push(logisticsOrder);
        }
      });
      
      console.log(`fetchAllOrders: 合并后总共 ${mergedOrders.length} 条订单数据`);
      
      // 4. 更新状态
      set((state) => ({
        orders: mergedOrders,
        loading: { ...state.loading, fetchAllOrders: false }
      }));
      
      return { 
        success: true, 
        message: `成功获取 ${mergedOrders.length} 条订单数据` 
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