import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLogisticsStore } from '../services/store';
import { Trash2, Upload, Terminal, FileText, Settings, Database, ShieldAlert, Users, UserPlus, X, Lock } from 'lucide-react';
import { OrderStatus, DEPARTMENTS, Order, WarningStatus, ORDER_STATUS_MAP, WARNING_STATUS_MAP, User, Role, OperationLog, OperationType, TargetType } from '../types';
import { parseExcelFile, parseCSVFile, processImportData, generateImportTemplate } from '../utils/fileParser';
import { apiService } from '../services/api';

// 定义快递公司名称到代码的映射
const CARRIER_NAME_TO_CODE: Record<string, string> = {
  '顺丰速运': 'shunfeng',
  '圆通速递': 'yuantong',
  '京东物流': 'jingdong',
  '跨越速运': 'kuayuesuyun',
  '中通快递': 'zhongtong',
  '韵达快递': 'yunda',
  '申通快递': 'shentong',
  '极兔速递': 'jtexpress',
  '邮政': 'youzhengguonei',
  'EMS': 'ems',
};

export const Admin: React.FC = () => {
  const { orders, deleteOrder, restoreOrder, hardDeleteOrder, importOrders, addOrder, isAdmin, users, fetchAllUsers, createUser, deleteUser, fetchAllOrders, taskProgress, taskStatus } = useLogisticsStore();
  const operationLogs = useLogisticsStore(state => state.operationLogs);
  const isLoadingUsers = useLogisticsStore(state => state.loading.fetchAllUsers);
  const [activeTab, setActiveTab] = useState<'manage' | 'import' | 'system' | 'config' | 'users'>('manage');

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
        
        if (result.success) {
          setImportStatus({ 
            message: `导入成功，正在同步物流信息...`, 
            type: 'success' 
          });
          
          // 遍历每个订单，调用apiService.queryAndSyncLogistics同步物流信息
          for (const order of processedOrders) {
            try {
              // 映射快递公司名称到代码
              const carrierName = order.details?.carrier || '';
              const carrierCode = CARRIER_NAME_TO_CODE[carrierName] || '';
              
              // 调用apiService.queryAndSyncLogistics同步物流信息
              // 确保customer_name长度至少为2个字符
              const customerName = order.customer_name || '';
              await apiService.queryAndSyncLogistics({
                kddh: order.details?.tracking_number || '',
                customer_name: customerName.length >= 2 ? customerName : '未知',
                department_key: order.department_key,
                phone: order.details?.phone || '',
                kdgs: carrierCode
              });
            } catch (syncError) {
              console.error(`同步物流信息失败 [${order.order_number}]:`, syncError);
              // 继续处理下一个订单，不中断整个流程
            }
          }
          
          setImportStatus({ 
            message: `导入成功，已同步物流信息`, 
            type: 'success' 
          });
          fetchLogs();
        } else {
          setImportStatus({ 
            message: result.message, 
            type: 'error' 
          });
        }
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

  // 添加进度条状态管理
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="p-6 h-full flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6 flex-shrink-0">
        <Terminal className="text-cyan-400" size={24} />
        <h2 className="text-2xl font-bold text-white tracking-widest font-mono">数据中台 // DATA CENTER</h2>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-700 mb-6 flex-shrink-0">
        {
          [
            {id: 'manage', label: '数据维护', icon: <Database size={14} className="mr-1"/>},
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
          ))
        }
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

        {/* Tab 2: Import */}
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
            
            {/* 进度条展示区域 */}
            {(taskStatus === 'polling' || taskStatus === 'creating' || taskStatus === 'saving') && (
              <div className="w-full max-w-md mt-6 bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
                <div
                  className="bg-cyan-500 h-full transition-all duration-500 ease-out flex items-center justify-center text-[10px] text-black font-bold"
                  style={{ width: `${taskProgress}%` }}
                >
                  {taskProgress}%
                </div>
              </div>
            )}
            
            {/* 状态文字提示 */}
            {taskStatus === 'polling' && <p className="mt-2 text-cyan-400 font-mono text-sm animate-pulse">正在从物流公司同步数据...</p>}
            {taskStatus === 'saving' && <p className="mt-2 text-green-400 font-mono text-sm">正在保存订单数据...</p>}
            {taskStatus === 'creating' && <p className="mt-2 text-yellow-400 font-mono text-sm">正在创建查询任务...</p>}
            {taskStatus === 'error' && <p className="mt-2 text-red-400 font-mono text-sm">同步失败，请稍后重试...</p>}
          </div>
        )}

        {/* Tab 3: System Log */}
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

        {/* Tab 4: Users */}
        {activeTab === 'users' && (
          <div className="h-full space-y-6 overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white font-mono">用户管理</h3>
              <button 
                onClick={() => setShowCreateUserForm(true)}
                className="bg-green-600 text-black px-4 py-2 font-bold hover:bg-green-500 transition shadow-[0_0_10px_rgba(16,185,129,0.5)] font-mono flex items-center"
              >
                <UserPlus size={16} className="mr-2" />
                创建用户
              </button>
            </div>
            
            <div className="border border-slate-700 bg-black/40 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 sticky top-0 text-slate-500 text-xs uppercase font-mono">
                  <tr>
                    <th className="p-3">用户名</th>
                    <th className="p-3">邮箱</th>
                    <th className="p-3">角色</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm font-mono">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-800">
                      <td className="p-3 text-cyan-600">{user.username}</td>
                      <td className="p-3 text-slate-400">{user.email}</td>
                      <td className="p-3 text-slate-400">{user.role === Role.ADMIN ? '管理员' : '普通用户'}</td>
                      <td className="p-3">
                        <button 
                          className="text-red-500 hover:text-red-400 flex items-center space-x-1"
                          onClick={() => {
                            if (window.confirm('确定要删除此用户吗？')) {
                              deleteUser(user.id).then(result => {
                                if (result.success) {
                                  alert('删除成功');
                                } else {
                                  alert('删除失败');
                                }
                              });
                            }
                          }}
                        >
                          <Trash2 size={14} />
                          <span>删除</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {showCreateUserForm && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-slate-900 border border-cyan-500 p-6 max-w-md w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white font-mono">创建新用户</h3>
                    <button onClick={() => setShowCreateUserForm(false)} className="text-slate-500 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateUser} className="space-y-4 font-mono">
                    <div>
                      <label className="block text-xs text-cyan-600 mb-1 uppercase">用户名</label>
                      <input 
                        type="text" 
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                        className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                        placeholder="admin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-cyan-600 mb-1 uppercase">邮箱</label>
                      <input 
                        type="email" 
                        value={newUser.email}
                        onChange={e => setNewUser({...newUser, email: e.target.value})}
                        className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-cyan-600 mb-1 uppercase">密码</label>
                      <input 
                        type="password" 
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                        placeholder="********"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-cyan-600 mb-1 uppercase">角色</label>
                      <select 
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
                        className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value={Role.USER}>普通用户</option>
                        <option value={Role.ADMIN}>管理员</option>
                      </select>
                    </div>
                    {userFormError && (
                      <div className="bg-red-900/30 text-red-400 p-2 text-xs">
                        {userFormError}
                      </div>
                    )}
                    {userFormSuccess && (
                      <div className="bg-green-900/30 text-green-400 p-2 text-xs">
                        {userFormSuccess}
                      </div>
                    )}
                    <div className="flex space-x-4">
                      <button 
                        type="submit" 
                        className="flex-1 bg-cyan-600 text-black py-2 font-bold hover:bg-cyan-500 transition font-mono"
                        disabled={loadingCreateUser}
                      >
                        {loadingCreateUser ? '创建中...' : '创建用户'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowCreateUserForm(false)}
                        className="flex-1 bg-slate-700 text-white py-2 font-bold hover:bg-slate-600 transition font-mono"
                      >
                        取消
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
                  <Settings size={18} className="mr-2 text-cyan-400" />
                  系统配置
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">API 端点</label>
                  <input 
                    type="text" 
                    value={config.apiEndpoint}
                    onChange={e => setConfig({...config, apiEndpoint: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">WebSocket 端点</label>
                  <input 
                    type="text" 
                    value={config.wsEndpoint}
                    onChange={e => setConfig({...config, wsEndpoint: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">数据源</label>
                  <select 
                    value={config.dataSource}
                    onChange={e => setConfig({...config, dataSource: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="local_mock">本地模拟</option>
                    <option value="api">API 服务器</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-cyan-600 mb-1 uppercase">API Key</label>
                  <input 
                    type="text" 
                    value={config.apiKey}
                    onChange={e => setConfig({...config, apiKey: e.target.value})}
                    className="w-full bg-black border border-slate-700 text-white p-3 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={config.autoSync}
                    onChange={e => setConfig({...config, autoSync: e.target.checked})}
                    className="rounded border-slate-700 bg-black text-cyan-500 focus:ring-cyan-500"
                  />
                  <label className="text-sm text-slate-400 font-mono">自动同步数据</label>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button 
                  className="flex-1 bg-cyan-600 text-black py-3 font-bold hover:bg-cyan-500 transition shadow-[0_0_15px_rgba(6,182,212,0.5)] font-mono"
                >
                  保存配置
                </button>
                <button 
                  className="flex-1 bg-slate-700 text-white py-3 font-bold hover:bg-slate-600 transition font-mono"
                >
                  恢复默认
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
