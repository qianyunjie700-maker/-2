import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLogisticsStore } from '../services/store';
import { Trash2, Upload, Plus, Terminal, Save, FileText, Server, Settings, Database, ShieldAlert, Globe, Download, Users, UserPlus, X, Lock } from 'lucide-react';
import { OrderStatus, DEPARTMENTS, Order, WarningStatus, ORDER_STATUS_MAP, WARNING_STATUS_MAP, User, Role, OperationLog, OperationType, TargetType } from '../types';
import { parseExcelFile, parseCSVFile, processImportData, generateImportTemplate } from '../utils/fileParser';
import { apiService } from '../services/api';

export const Admin: React.FC = () => {
  const { orders, deleteOrder, restoreOrder, hardDeleteOrder, importOrders, addOrder, isAdmin, users, fetchAllUsers, createUser, fetchAllOrders } = useLogisticsStore();
  const operationLogs = useLogisticsStore(state => state.operationLogs);
  const isLoadingUsers = useLogisticsStore(state => state.loading.fetchAllUsers);
  const [activeTab, setActiveTab] = useState<'manage' | 'entry' | 'import' | 'system' | 'config' | 'users'>('manage');

  // Manual Entry State
  const [newOrder, setNewOrder] = useState({
      order_number: '',
      customer_name: '',
      phone: '',
      department_key: DEPARTMENTS[0].key,
      carrier: '',
      orderDate: '',
      plannedShipDate: '',
      destination: '',
      productInfo: ''
  });
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [newUser, setNewUser] = useState({
      username: '',
      password: '',
      email: '',
      role: Role.USER
  });
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [loadingCreateUser, setLoadingCreateUser] = useState(false);
  
  const [loadingLogs, setLoadingLogs] = useState(false);
  const logUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [importStatus, setImportStatus] = useState({ message: '', type: '' as 'success' | 'error' | '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState({
      apiEndpoint: 'http://localhost:8080/api/v1',
      wsEndpoint: 'ws://localhost:8080/stream',
      dataSource: 'local_mock',
      apiKey: 'sk_live_***********',
      autoSync: true
  });

  const archivedOrders = orders.filter(o => o.is_archived);
  const activeOrders = orders.filter(o => !o.is_archived);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin()) {
      return;
    }
    
    try {
      await fetchAllUsers();
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setUserFormError('获取用户列表失败');
    }
  }, [isAdmin, fetchAllUsers]);
  
  const fetchLogs = useCallback(async () => {
    console.log('Fetching logs...');
    setLoadingLogs(true);
    
    try {
      const storeLogs = useLogisticsStore.getState().operationLogs;
      console.log('Store logs fetched:', storeLogs);
    } catch (error) {
      console.error('获取操作日志失败:', error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);
  
  const getOperationColor = (operationType: OperationType) => {
    switch (operationType) {
      case OperationType.CREATE: return 'text-green-400';
      case OperationType.UPDATE: return 'text-blue-400';
      case OperationType.DELETE:
      case OperationType.ARCHIVE: return 'text-red-400';
      case OperationType.LOGIN:
      case OperationType.LOGOUT: return 'text-yellow-400';
      case OperationType.EXPORT:
      case OperationType.IMPORT: return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };
  
  const getTargetTypeDisplayName = (targetType: TargetType) => {
    switch (targetType) {
      case TargetType.ORDER: return '订单';
      case TargetType.USER: return '用户';
      case TargetType.SYSTEM: return '系统';
      case TargetType.DEPARTMENT: return '部门';
      default: return targetType;
    }
  };

  const getOperationDisplayName = (operationType: OperationType) => {
    switch (operationType) {
      case OperationType.CREATE: return '创建';
      case OperationType.UPDATE: return '更新';
      case OperationType.DELETE: return '删除';
      case OperationType.ARCHIVE: return '归档';
      case OperationType.RESTORE: return '恢复';
      case OperationType.IMPORT: return '导入';
      case OperationType.EXPORT: return '导出';
      case OperationType.LOGIN: return '登录';
      case OperationType.LOGOUT: return '登出';
      default: return operationType;
    }
  };

  const validateUsername = (username: string): { isValid: boolean; message?: string } => {
    if (!username) return { isValid: false, message: '用户名不能为空' };
    if (username.length < 3 || username.length > 50) return { isValid: false, message: '用户名长度必须在3-50个字符之间' };
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return { isValid: false, message: '用户名只能包含字母、数字和下划线' };
    return { isValid: true };
  };

  const validatePassword = (password: string): { isValid: boolean; message?: string } => {
    if (!password) return { isValid: false, message: '密码不能为空' };
    if (password.length < 6) return { isValid: false, message: '密码长度必须至少为6个字符' };
    if (!/[a-z]/.test(password)) return { isValid: false, message: '密码必须包含至少一个小写字母' };
    if (!/[A-Z]/.test(password)) return { isValid: false, message: '密码必须包含至少一个大写字母' };
    if (!/[0-9]/.test(password)) return { isValid: false, message: '密码必须包含至少一个数字' };
    return { isValid: true };
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin()) {
      setUserFormError('只有管理员才能创建用户');
      return;
    }
    
    const usernameValidation = validateUsername(newUser.username);
    if (!usernameValidation.isValid) {
      setUserFormError(usernameValidation.message || '用户名不符合要求');
      return;
    }
    
    const passwordValidation = validatePassword(newUser.password);
    if (!passwordValidation.isValid) {
      setUserFormError(passwordValidation.message || '密码不符合要求');
      return;
    }
    
    try {
      setLoadingCreateUser(true);
      setUserFormError('');
      setUserFormSuccess('');
      
      const result = await createUser({
        username: newUser.username,
        password: newUser.password,
        email: newUser.email,
        role: newUser.role
      });
      
      if (result.success) {
        setNewUser({ username: '', password: '', email: '', role: Role.USER });
        fetchLogs();
        setUserFormSuccess('用户创建成功');
        
        setTimeout(() => {
          setShowCreateUserForm(false);
          setUserFormSuccess('');
        }, 2000);
      } else {
        setUserFormError(result.message || '创建用户失败');
      }
    } catch (error) {
      console.error('创建用户失败:', error);
      setUserFormError('创建用户失败');
    } finally {
      setLoadingCreateUser(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && isAdmin()) {
      fetchUsers();
    }
  }, [activeTab, isAdmin, fetchUsers]);
  
  useEffect(() => {
    const { operationLogs, addOperationLog } = useLogisticsStore.getState();
    
    if (operationLogs.length === 0) {
      const mockLogs: OperationLog[] = [
        {
          id: 1,
          username: 'admin',
          operation_type: OperationType.LOGIN,
          target_type: TargetType.SYSTEM,
          target_id: 'system_login',
          details: {
            description: '管理员登录系统',
            ip_address: '127.0.0.1',
            user_agent: 'Mozilla/5.0'
          },
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      
      mockLogs.forEach(log => addOperationLog(log));
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    
    const unsubscribe = useLogisticsStore.subscribe((newState, oldState) => {
      if (JSON.stringify(newState.operationLogs) !== JSON.stringify(oldState.operationLogs)) {
        fetchLogs();
      }
    });
    
    return () => unsubscribe();
  }, [fetchLogs]);

  useEffect(() => {
    if (activeTab === 'system') {
      fetchLogs();
      
      const interval = setInterval(fetchLogs, 3000);
      logUpdateIntervalRef.current = interval;
    } else {
      if (logUpdateIntervalRef.current) {
        clearInterval(logUpdateIntervalRef.current);
        logUpdateIntervalRef.current = null;
      }
    }
    
    return () => {
      if (logUpdateIntervalRef.current) {
        clearInterval(logUpdateIntervalRef.current);
        logUpdateIntervalRef.current = null;
      }
    };
  }, [activeTab, fetchLogs]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setImportStatus({ message: '', type: '' });
    
    try {
      let rawData: any[];
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        rawData = await parseExcelFile(file);
      } else if (file.name.endsWith('.csv')) {
        rawData = await parseCSVFile(file);
      } else {
        throw new Error('不支持的文件格式');
      }
      
      const { orders: processedOrders, errors } = processImportData(rawData);
      
      if (errors.length > 0) {
        const errorMessages = errors.map(err => `${err.row}行: ${err.message}`).join('\n');
        setImportStatus({ 
          message: `导入失败，发现 ${errors.length} 个错误:\n${errorMessages}`, 
          type: 'error' 
        });
      } else if (processedOrders.length > 0) {
        const result = await importOrders(processedOrders, 'admin');
        setImportStatus({ 
          message: result.message, 
          type: result.success ? 'success' : 'error' 
        });
        fetchLogs();
      } else {
        setImportStatus({ 
          message: '没有可导入的有效数据', 
          type: 'error' 
        });
      }
    } catch (error) {
      setImportStatus({ 
        message: `文件处理失败: ${(error as Error).message}`, 
        type: 'error' 
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newOrder.order_number) {
      alert('物流单号不能为空');
      return;
    }
    if (newOrder.customer_name.length < 3) {
      alert('客户名称必须至少包含3个字符');
      return;
    }
    if (!newOrder.phone) {
      alert('电话不能为空');
      return;
    }
    if (!newOrder.destination) {
      alert('收货地址不能为空');
      return;
    }
    if (!newOrder.productInfo) {
      alert('产品信息不能为空');
      return;
    }
    if (!newOrder.carrier) {
      alert('请选择承运商');
      return;
    }

    const result = await addOrder({
      order_number: newOrder.order_number,
      customer_name: newOrder.customer_name,
      department_key: newOrder.department_key,
      user_id: useLogisticsStore.getState().auth.user?.id || 1,
      status: OrderStatus.PENDING,
      warning_status: WarningStatus.NONE,
      details: {
        carrier: newOrder.carrier,
        order_date: newOrder.orderDate,
        planned_ship_date: newOrder.plannedShipDate,
        destination: newOrder.destination,
        product_info: newOrder.productInfo,
        phone: newOrder.phone
      }
    });

    if (result.success) {
      setNewOrder({
        order_number: '',
        customer_name: '',
        phone: '',
        department_key: DEPARTMENTS[0].key,
        carrier: '',
        orderDate: '',
        plannedShipDate: '',
        destination: '',
        productInfo: ''
      });
      setRecognitionError('');
      
      fetchLogs();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6 flex-shrink-0">
        <Terminal className="text-cyan-400" size={24} />
        <h2 className="text-2xl font-bold text-white tracking-widest font-mono">数据中台 // DATA CENTER</h2>
      </div>
      
      {/* 录入成功提示 */}
      {submitSuccess && (
        <div className="fixed top-4 right-4 bg-green-900/80 text-green-400 p-4 rounded border border-green-500">
          录入成功: 订单已添加至数据库。
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-700 mb-6 flex-shrink-0">
        {[
          {id: 'manage', label: '数据维护', icon: <Database size={14} className="mr-1"/>},
          {id: 'entry', label: '手工录入', icon: <Plus size={14} className="mr-1"/>},
          {id: 'import', label: '批量导入', icon: <Upload size={14} className="mr-1"/>},
          {id: 'users', label: '用户管理', icon: <Users size={14} className="mr-1"/>},
          {id: 'system', label: '系统日志', icon: <FileText size={14} className="mr-1"/>},
          {id: 'config', label: '系统设置', icon: <Settings size={14} className="mr-1"/>}
        ].map(tab => (
          <button 
            key={tab.id}
            className={`pb-2 px-4 text-sm font-bold tracking-wider transition-colors font-mono flex items-center ${activeTab === tab.id ? 'border-b-2 border-cyan-400 text-cyan-400 bg-cyan-900/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="tech-card tech-border p-6 flex-1 overflow-y-auto relative min-h-0">
        {/* Tab 1: Manage */}
        {activeTab === 'manage' && (
          <div className="h-full flex flex-col">
            <div className="mb-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-slate-300 font-mono">活跃订单列表 ({activeOrders.length})</h3>
              <span className="text-xs text-red-900 bg-red-900/20 px-2 py-1 border border-red-900/50 font-mono">管理员权限区域</span>
            </div>
            
            <div className="flex-1 overflow-y-auto border border-slate-700 bg-black/40 min-h-0">
              <table className="w-full text-left">
                <thead className="bg-slate-900 sticky top-0 text-slate-500 text-xs uppercase font-mono z-10">
                  <tr>
                    <th className="p-3 bg-slate-900">单号</th>
                    <th className="p-3 bg-slate-900">客户/项目</th>
                    <th className="p-3 bg-slate-900">状态</th>
                    <th className="p-3 bg-slate-900">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm font-mono">
                  {activeOrders.slice(0, 50).map(o => (
                    <tr key={o.id} className="hover:bg-slate-800">
                      <td className="p-3 text-cyan-600">{o.order_number}</td>
                      <td className="p-3 text-slate-400">{o.customer_name}</td>
                      <td className="p-3 text-slate-400">{ORDER_STATUS_MAP[o.status]}</td>
                      <td className="p-3">
                        <button onClick={() => deleteOrder(o.id)} className="text-red-500 hover:text-red-400 flex items-center space-x-1">
                          <Trash2 size={14} />
                          <span>删除</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex-shrink-0">
              <h3 className="font-bold text-slate-500 text-sm uppercase mb-2 font-mono">回收站 / 归档 ({archivedOrders.length})</h3>
              {archivedOrders.length > 0 && (
                <div className="bg-slate-900/50 p-4 border border-slate-800 max-h-32 overflow-y-auto">
                  {archivedOrders.map(o => (
                    <div key={o.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0 font-mono">
                      <span className="text-xs text-slate-500 line-through">{o.order_number}</span>
                      <div className="space-x-4">
                        <button onClick={() => restoreOrder(o.id)} className="text-xs text-cyan-600 hover:text-cyan-400">[还原]</button>
                        <button onClick={() => hardDeleteOrder(o.id)} className="text-xs text-red-900 hover:text-red-500">[彻底删除]</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Manual Entry */}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto mt-8 h-full overflow-y-auto">
            <div className="border border-cyan-900/50 p-8 bg-slate-900/50 relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-cyan-500"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-cyan-500"></div>
              
              <h3 className="text-lg font-bold text-white mb-6 flex items-center font-mono">
                <Plus size={18} className="mr-2 text-green-400"/>
                新增订单录入
              </h3>
              
              <form onSubmit={handleManualSubmit} className="space-y-6 font-mono">
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">物流单号 (Tracking ID)</label>
                  <div className="flex">
                    <input 
                      type="text" 
                      required
                      value={newOrder.order_number}
                      onChange={e => {
                        setNewOrder({...newOrder, order_number: e.target.value});
                        setRecognitionError('');
                      }}
                      className="flex-1 bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                      placeholder="SF000..."
                    />
                    <button
                          type="button"
                          onClick={async () => {
                            if (!newOrder.order_number) {
                              alert('请先输入物流单号');
                              return;
                            }
                            setIsRecognizing(true);
                            setRecognitionError('');
                            try {
                              // 调用新的API：查询并同步物流信息
                              const recognitionResult = await apiService.queryAndSyncLogistics({
                                kddh: newOrder.order_number,
                                customer_name: newOrder.customer_name || '未知客户',
                                department_key: newOrder.department_key
                              });
                              if (recognitionResult.code === 0 && recognitionResult.msg) {
                                const { order, logisticsInfo } = recognitionResult.msg;
                                
                                // 设置承运商信息
                                setNewOrder(prev => ({
                                  ...prev,
                                  carrier: logisticsInfo.kdgs_name || logisticsInfo.kdgs || '',
                                  // 这里可以根据物流信息设置orderDate和plannedShipDate
                                  // 暂时使用当前日期作为默认值
                                  orderDate: new Date().toISOString(),
                                  plannedShipDate: new Date().toISOString(),
                                  // 如果有客户名称和电话，也设置
                                  customer_name: order.customer_name || prev.customer_name,
                                  phone: order.details?.phone || prev.phone,
                                  destination: order.details?.destination || prev.destination,
                                  productInfo: order.details?.product_info || prev.productInfo
                                }));
                                
                                // 显示成功信息
                                setSubmitSuccess(true);
                                setTimeout(() => setSubmitSuccess(false), 3000);
                                
                                // 刷新订单列表
                                fetchAllOrders();
                              }
                            } catch (error) {
                              console.error('识别物流单号失败:', error);
                              setRecognitionError('识别物流单号失败，请检查单号是否正确');
                            } finally {
                              setIsRecognizing(false);
                            }
                          }}
                          className={`ml-2 px-4 bg-cyan-900/40 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black transition font-bold tracking-widest ${isRecognizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={isRecognizing}
                        >
                          {isRecognizing ? '识别中...' : '识别单号'}
                        </button>
                  </div>
                  {recognitionError && (
                    <p className="text-red-500 text-xs mt-1">{recognitionError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">客户 / 项目名称</label>
                  <input 
                    type="text" 
                    required
                    value={newOrder.customer_name}
                    onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                    placeholder="项目 Alpha..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">电话</label>
                  <input 
                    type="text" 
                    required
                    value={newOrder.phone}
                    onChange={e => setNewOrder({...newOrder, phone: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                    placeholder="13800138000"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">收货地址</label>
                    <input 
                      type="text" 
                      value={newOrder.destination}
                      onChange={e => setNewOrder({...newOrder, destination: e.target.value})}
                      className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                      placeholder="上海市浦东新区"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">产品信息</label>
                    <input 
                      type="text" 
                      value={newOrder.productInfo}
                      onChange={e => setNewOrder({...newOrder, productInfo: e.target.value})}
                      className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                      placeholder="电子元器件"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">所属部门</label>
                    <select 
                      value={newOrder.department_key}
                      onChange={e => setNewOrder({...newOrder, department_key: e.target.value})}
                      className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                    >
                      {DEPARTMENTS.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">承运商</label>
                    <select 
                      value={newOrder.carrier}
                      onChange={e => setNewOrder({...newOrder, carrier: e.target.value})}
                      className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">请选择承运商</option>
                      <option value="顺丰速运">顺丰速运</option>
                      <option value="圆通速递">圆通速递</option>
                      <option value="京东物流">京东物流</option>
                      <option value="跨越速运">跨越速运</option>
                      <option value="中通快递">中通快递</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">下单日期</label>
                    <input 
                      type="text" 
                      value={newOrder.orderDate ? new Date(newOrder.orderDate).toLocaleDateString() : ''}
                      readOnly
                      className="w-full bg-slate-900 border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                      placeholder="系统自动识别"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cyan-600 mb-1 uppercase">计划发货日</label>
                    <input 
                      type="text" 
                      value={newOrder.plannedShipDate ? new Date(newOrder.plannedShipDate).toLocaleDateString() : ''}
                      readOnly
                      className="w-full bg-slate-900 border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none placeholder-slate-700"
                      placeholder="系统自动识别"
                    />
                  </div>
                </div>
                
                <button type="submit" className="w-full bg-cyan-900/40 border border-cyan-500 text-cyan-400 py-3 hover:bg-cyan-500 hover:text-black transition font-bold tracking-widest flex justify-center items-center">
                  <Save size={16} className="mr-2" />
                  提交数据
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Import */}
        {activeTab === 'import' && (
          <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/30 hover:border-cyan-500/50 transition cursor-pointer group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Upload size={48} className="text-slate-600 group-hover:text-cyan-400 transition-colors mb-6" />
            <h3 className="text-xl font-bold text-white mb-2 font-mono">拖拽文件至此</h3>
            <p className="text-slate-500 text-sm mb-8 font-mono">支持格式: .XLSX, .CSV</p>
            <div className="flex space-x-4">
              <button 
                onClick={handleImportClick}
                className="bg-cyan-600 text-black px-8 py-3 font-bold hover:bg-cyan-500 transition shadow-[0_0_15px_rgba(6,182,212,0.5)] font-mono"
              >
                开始上传处理
              </button>
              <button 
                onClick={generateImportTemplate}
                className="bg-slate-700 text-white px-8 py-3 font-bold hover:bg-slate-600 transition font-mono"
              >
                下载导入模板
              </button>
            </div>
            {isProcessing && <p className="mt-4 text-sm text-cyan-400">正在处理文件...</p>}
            {importStatus.message && (
              <div className={`mt-4 text-sm p-3 rounded ${importStatus.type === 'error' ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                {typeof importStatus.message === 'string' ? importStatus.message : JSON.stringify(importStatus.message)}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: System Log */}
        {activeTab === 'system' && (
          <div className="space-y-6 h-full overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white font-mono">系统日志</h3>
              <div className="space-x-2">
                <button 
                  onClick={() => console.log('Store operationLogs:', useLogisticsStore.getState().operationLogs)}
                  className="bg-cyan-600 text-black px-4 py-2 text-sm font-bold hover:bg-cyan-500 transition shadow-[0_0_10px_rgba(6,182,212,0.5)] font-mono"
                >
                  查看Store日志
                </button>
                <button 
                  onClick={() => {
                    const testLog: OperationLog = {
                      id: Math.floor(Math.random() * 1000000),
                      user_id: 1,
                      username: 'test_user',
                      operation_type: OperationType.CREATE,
                      target_type: TargetType.ORDER,
                      target_id: 'test_order',
                      details: {
                        description: '测试日志，检查系统日志是否显示'
                      },
                      ip_address: '127.0.0.1',
                      created_at: new Date().toISOString()
                    };
                    useLogisticsStore.getState().addOperationLog(testLog);
                    console.log('Added test log:', testLog);
                  }}
                  className="bg-green-600 text-black px-4 py-2 text-sm font-bold hover:bg-green-500 transition shadow-[0_0_10px_rgba(16,185,129,0.5)] font-mono"
                >
                  添加测试日志
                </button>
              </div>
            </div>
            <div className="border border-slate-800 bg-black p-2 shadow-inner flex-1 flex flex-col">
              <div className="flex justify-between items-center px-2 py-1 bg-slate-900 border-b border-slate-800 mb-2 font-mono">
                <span className="text-xs text-slate-400 flex items-center"><FileText size={10} className="mr-1"/> operation_logs.log</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="text-green-500 font-mono text-xs p-2 overflow-y-auto leading-relaxed h-full bg-black border border-slate-800">
                <p className="opacity-50">root@logiview:~$ tail -f /var/log/operation_logs.log</p>
                <p className="opacity-70">[DEBUG] 共找到 {operationLogs.length} 条日志</p>
                {loadingLogs ? (
                  <p>[INFO] 正在加载日志...</p>
                ) : operationLogs.length > 0 ? (
                  [...operationLogs].sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  ).map(log => (
                    <p key={log.id} className="mb-1">
                      <span className="text-gray-500">
                        [{new Date(log.created_at).toLocaleDateString()}] 
                        [{new Date(log.created_at).toLocaleTimeString()}]
                      </span>
                      <span className="text-blue-300 ml-2">[{log.username}]</span>
                      <span className={`ml-2 ${getOperationColor(log.operation_type)}`}>
                        [{getOperationDisplayName(log.operation_type)}]
                      </span>
                      <span className="text-purple-300 ml-2">
                        [{getTargetTypeDisplayName(log.target_type)}]
                      </span>
                      <span className="text-gray-300 ml-2">{log.details.description}</span>
                    </p>
                  ))
                ) : (
                  <p>[INFO] 暂无操作日志</p>
                )}
                <p className="animate-pulse">_</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Configuration */}
        {activeTab === 'config' && (
          <div className="max-w-2xl mx-auto h-full space-y-8 font-mono">
            <div className="p-4 bg-amber-900/20 border border-amber-600/50 flex items-start space-x-3">
              <ShieldAlert className="text-amber-500 flex-shrink-0" size={24} />
              <div>
                <h4 className="text-amber-500 font-bold text-sm mb-1">运行环境说明</h4>
                <p className="text-amber-200/70 text-xs leading-relaxed">
                  当前系统处于 <span className="text-white font-bold">本地模拟模式 (Local Mock)</span>。
                  所有数据仅存储在浏览器内存中，刷新页面后数据将重置。
                  如需部署到生产环境，请配置下方真实的 API 服务器地址。
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-b border-slate-700 pb-2">
                <h3 className="text-white font-bold flex items-center">
                  <Server size={18} className="mr-2 text-cyan-500"/>
                  后端服务器配置
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 uppercase">Data Source Mode</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={config.dataSource === 'local_mock'} 
                        onChange={() => setConfig({...config, dataSource: 'local_mock'})}
                        className="text-cyan-500 focus:ring-cyan-500 bg-black"
                      />
                      <span className="text-sm text-white">本地模拟 (Mock)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={config.dataSource === 'remote_server'} 
                        onChange={() => setConfig({...config, dataSource: 'remote_server'})}
                        className="text-cyan-500 focus:ring-cyan-500 bg-black"
                      />
                      <span className="text-sm text-slate-400">远程服务器 (Remote)</span>
                    </label>
                  </div>
                </div>

                <div className={config.dataSource === 'local_mock' ? 'opacity-50 pointer-events-none grayscale transition-all' : 'transition-all'}>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">API Endpoint URL</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 text-slate-600" size={16}/>
                    <input 
                      type="text" 
                      value={config.apiEndpoint}
                      onChange={(e) => setConfig({...config, apiEndpoint: e.target.value})}
                      className="w-full bg-black border border-slate-700 text-white pl-10 pr-3 py-2 focus:border-cyan-500 focus:outline-none font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">Target server must support REST or GraphQL.</p>
                </div>

                <div className={config.dataSource === 'local_mock' ? 'opacity-50 pointer-events-none grayscale transition-all' : 'transition-all'}>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">API Key / Token</label>
                  <input 
                    type="password" 
                    value={config.apiKey}
                    onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white px-3 py-2 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button className="bg-cyan-600 hover:bg-cyan-500 text-black px-6 py-2 font-bold font-mono text-sm shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                  保存配置
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: User Management */}
        {activeTab === 'users' && (
          <div className="h-full flex flex-col font-mono">
            <div className="mb-4 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-slate-300 font-mono flex items-center">
                <Users className="mr-2 text-cyan-400" size={20} />
                用户管理 ({users.length})
              </h3>
              <span className="text-xs text-red-900 bg-red-900/20 px-2 py-1 border border-red-900/50 font-mono">管理员权限区域</span>
            </div>

            {!isAdmin() && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Lock className="mx-auto text-slate-600" size={64} />
                  <h4 className="text-slate-500 text-lg">权限不足</h4>
                  <p className="text-slate-600">只有管理员才能访问用户管理功能</p>
                </div>
              </div>
            )}

            {isAdmin() && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowCreateUserForm(true)}
                    className="bg-cyan-900/40 border border-cyan-500 text-cyan-400 py-2 px-4 hover:bg-cyan-500 hover:text-black transition font-bold tracking-widest flex items-center"
                  >
                    <UserPlus size={16} className="mr-2" />
                    创建用户
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-700 bg-black/40">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-cyan-400">加载中...</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-500">暂无用户数据</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-900 sticky top-0 text-slate-500 text-xs uppercase font-mono z-10">
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">用户名</th>
                          <th className="p-3">邮箱</th>
                          <th className="p-3">角色</th>
                          <th className="p-3">创建时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm font-mono">
                        {users.map(user => (
                          <tr key={user.id} className="hover:bg-slate-800">
                            <td className="p-3 text-cyan-600">{user.id}</td>
                            <td className="p-3 text-white font-bold">{user.username}</td>
                            <td className="p-3 text-slate-400">{user.email || '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${user.role === Role.ADMIN ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                                {user.role === Role.ADMIN ? '管理员' : '普通用户'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 text-xs">
                              {new Date(user.created_at).toLocaleString('zh-CN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {showCreateUserForm && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-slate-900 border border-cyan-500/50 rounded-lg p-8 max-w-md w-full mx-4">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center">
                          <UserPlus className="mr-2 text-cyan-400" size={20} />
                          创建新用户
                        </h3>
                        <button
                          onClick={() => setShowCreateUserForm(false)}
                          className="text-slate-500 hover:text-white transition"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {userFormError && (
                        <div className="mb-4 p-3 bg-red-900/20 text-red-400 border border-red-500/50 text-sm">
                          {userFormError}
                        </div>
                      )}

                      {userFormSuccess && (
                        <div className="mb-4 p-3 bg-green-900/20 text-green-400 border border-green-500/50 text-sm">
                          {userFormSuccess}
                        </div>
                      )}

                      <form onSubmit={handleCreateUser} className="space-y-4">
                        <div>
                          <label className="block text-xs text-cyan-600 mb-1 uppercase">用户名</label>
                          <input
                            type="text"
                            value={newUser.username}
                            onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                            className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                            placeholder="请输入用户名"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-cyan-600 mb-1 uppercase">密码</label>
                          <input
                            type="password"
                            value={newUser.password}
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                            className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                            placeholder="请输入密码"
                            required
                            minLength={6}
                          />
                          <p className="text-slate-600 text-xs mt-1">密码至少6位，且必须包含大小写字母和数字</p>
                        </div>

                        <div>
                          <label className="block text-xs text-cyan-600 mb-1 uppercase">邮箱</label>
                          <input
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                            className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                            placeholder="请输入邮箱（可选）"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-cyan-600 mb-1 uppercase">角色</label>
                          <select
                            value={newUser.role}
                            onChange={(e) => setNewUser({...newUser, role: e.target.value as Role})}
                            className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                          >
                            <option value={Role.USER}>普通用户</option>
                            <option value={Role.ADMIN}>管理员</option>
                          </select>
                        </div>

                        <div className="flex space-x-4">
                          <button
                            type="button"
                            onClick={() => setShowCreateUserForm(false)}
                            className="flex-1 bg-slate-700 text-white py-3 hover:bg-slate-600 transition"
                            disabled={loadingCreateUser}
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="flex-1 bg-cyan-900/40 border border-cyan-500 text-cyan-400 py-3 hover:bg-cyan-500 hover:text-black transition font-bold tracking-widest"
                            disabled={loadingCreateUser}
                          >
                            {loadingCreateUser ? '创建中...' : '创建用户'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};