export enum OrderStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
}

// 订单状态中文映射
export const ORDER_STATUS_MAP: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待发货',
  [OrderStatus.IN_TRANSIT]: '运输中',
  [OrderStatus.DELIVERED]: '已签收',
  [OrderStatus.RETURNED]: '已退回',
};

export interface TrackingNode {
  id: string;
  timestamp: string;
  location: string;
  description: string;
}

// 部门接口
export interface Department {
  id: number;         // 部门ID
  key: string;        // 部门唯一标识
  name: string;       // 部门名称
  description?: string; // 部门描述（可选）
  created_at?: string; // 创建时间（可选）
}

// 预警状态
export enum WarningStatus {
  NONE = 'none',
  DELAY_SHIPMENT = 'delay_shipment',
  TRANSIT_ABNORMAL = 'transit_abnormal'
}

// 预警状态中文映射
export const WARNING_STATUS_MAP: Record<WarningStatus, string> = {
  [WarningStatus.NONE]: '无预警',
  [WarningStatus.DELAY_SHIPMENT]: '延迟发货',
  [WarningStatus.TRANSIT_ABNORMAL]: '运输异常',
};

export interface Order {
  id: number;
  order_number: string; // 物流单号
  customer_name: string;   // 客户/项目名称
  department_key: string;     // 业务部门（存储部门key）
  user_id?: number;     // 创建订单的用户ID
  status: OrderStatus;
  warning_status: WarningStatus; // 预警状态
  is_archived: boolean;    // 逻辑删除标记
  details?: any; // 存储轨迹、目的地等扩展信息
  created_at: string;     // 创建时间
  updated_at: string;     // 更新时间
}

export interface DepartmentStats {
  key: string;        // 部门key
  name: string;       // 部门名称
  total: number;
  pending: number;
  inTransit: number;
  delivered: number;
  returned: number;
  riskCount: number; // 5天未发货
  warningCount: number; // 总预警数
  delayShipmentCount: number; // 延迟发货预警数
  transitAbnormalCount: number; // 运输异常预警数
}

// 操作日志接口
// 操作类型枚举
export enum OperationType {
  IMPORT = 'import',
  EXPORT = 'export',
  DELETE = 'delete',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  UPDATE = 'update',
  CREATE = 'create',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

// 目标类型枚举
export enum TargetType {
  ORDER = 'order',
  USER = 'user',
  DEPARTMENT = 'department',
  SYSTEM = 'system'
}

export interface OperationLog {
  id: number;
  user_id?: number;
  username?: string;
  operation_type: OperationType;
  target_type?: TargetType;
  target_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

// 筛选条件接口
export interface FilterCriteria {
  department?: string;
  dateRange?: { start: string; end: string };
  status?: OrderStatus;
  carrier?: string;
  warningStatus?: WarningStatus;
  searchTerm?: string; // 搜索关键词（单号/客户）
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
  errors?: Array<{ row: number; message: string }>;
}

// 部门字典维护
export const DEPARTMENT_DICT: Record<string, Department> = {
  'EAST': { id: 1, key: 'EAST', name: '华东事业部', description: '负责华东地区业务' },
  'SOUTH': { id: 2, key: 'SOUTH', name: '华南事业部', description: '负责华南地区业务' },
  'NORTH': { id: 3, key: 'NORTH', name: '华北事业部', description: '负责华北地区业务' },
  'WEST': { id: 4, key: 'WEST', name: '华西事业部', description: '负责华西地区业务' },
  'CENTRAL': { id: 5, key: 'CENTRAL', name: '华中事业部', description: '负责华中地区业务' },
  'OVERSEAS': { id: 6, key: 'OVERSEAS', name: '海外业务部', description: '负责海外业务' },
};

// 部门列表（用于下拉选择等场景）
export const DEPARTMENTS = Object.values(DEPARTMENT_DICT);

// 快递公司代码映射
export const CARRIER_CODES: Record<string, string> = {
  // 主流快递公司
  '顺丰速运': 'shunfeng',
  '顺丰': 'shunfeng',
  '圆通快递': 'yuantong',
  '圆通': 'yuantong',
  '中通快递': 'zhongtong',
  '中通': 'zhongtong',
  '申通快递': 'shentong',
  '申通': 'shentong',
  '韵达快递': 'yunda',
  '韵达': 'yunda',
  '百世快递': 'baishiwuliu',
  '百世': 'baishiwuliu',
  '京东物流': 'jingdong',
  '京东': 'jingdong',
  '邮政快递包裹': 'youzheng',
  '邮政': 'youzheng',
  'ems': 'ems',
  '宅急送': 'zhaijisong',
  '优速快递': 'yousu',
  '优速': 'yousu',
  '天天快递': 'tiantian',
  '天天': 'tiantian',
  '德邦快递': 'debangwuliu',
  '德邦': 'debangwuliu',
  '跨越速运': 'kuayuesuyun',
  '极兔速递': 'jitasudi',
  '极兔': 'jitasudi',
  '安能物流': 'annengwuliu',
  '中铁物流': 'zhongtiewuliu',
  '民航快递': 'minhangkuaidi',
  '速尔快递': 'suoerkuaidi',
  '快捷快递': 'kuaijiekuaidi',
  '全峰快递': 'quanfengkuaidi',
  '国通快递': 'guotongkuaidi',
  '增益速递': 'zengyisudi',
  '汇通快递': 'huitongkuaidi',
  '全一快递': 'quanyikuaidi',
  'fedex': 'fedex',
  'ups': 'ups',
  'dhl': 'dhl',
  'tnt': 'tnt',
  '云鸟': 'yuniao',
  '韵达宝': 'yundabao',
  '汇元速运': 'huiyuansuyun',
  '网赚': 'wangzhuan',
  '三象': 'sanxiang',
  '捷速': 'jiesu',
  '利速': 'lisuo',
  '鸿远': 'hongyuan',
  '安速全': 'ansuquan',

  '全峰': 'quanfengkuaidi',
  '国通': 'guotongkuaidi',
  '增益': 'zengyisudi',
  '汇通': 'huitongkuaidi',
  '全一': 'quanyikuaidi',
  '速尔': 'suoerkuaidi',
  '快捷': 'kuaijiekuaidi',
  '民航': 'minhangkuaidi',
  '中铁': 'zhongtiewuliu',
  '安能': 'annengwuliu',
  '跨越': 'kuayuesuyun',
  '圆通速递': 'yuantong',
  '中通速递': 'zhongtong',
  '邮政快递': 'youzheng',
  'ems特快': 'ems',
  '德邦物流': 'debangwuliu',
  '百世汇通': 'baishihuitong',
  '极兔快递': 'jitasudi',
  '宅急送快递': 'zhaijisong',
  '优速物流': 'yousu',
  '增益快递': 'zengyisudi',
  '中铁快运': 'zhongtiekuyaun',
  'fedex国际': 'fedex',
  'ups国际': 'ups',
  'dhl国际': 'dhl',
  'tnt国际': 'tnt',
  '云鸟物流': 'yuniao',
  '韵达宝物流': 'yundabao',
  '汇元速运物流': 'huiyuansuyun',
  '网赚物流': 'wangzhuan',
  '三象物流': 'sanxiang',
  '捷速物流': 'jiesu',
  '利速物流': 'lisuo',
  '鸿远物流': 'hongyuan',
  '安速全物流': 'ansuquan',
  '通吧': 'tongba',
  '上海城铁快运': 'shanghaichengti',
  '宇鑫物流': 'yuxinwuliu',
  '中城速递': 'zhongchengsudi',
  '速必达': 'subida',
  '迈力': 'maili',
  '安骏': 'anjun',
  '顿发送达': 'dunsongsd',
  '通必达': 'tongbida',
  '思必达': 'sibida',
  'jingle': 'jingle',
  '速通': 'sutong',
  '一快通': 'yikuaitong',
  '万承': 'wancheng',
  '佳速物流': 'jiasusongcheng',
  'JMS EXPRESS': 'jms',
  '国通速递': 'guotongsudi',
  'Acme': 'acme',
  'Air21': 'air21',
  'Alza': 'alza',
  'Aramex': 'aramex',
  'Atos': 'atos',
  '巴西邮政': 'baxizhengyou',
  '斑马': 'banma',
  '奔腾': 'benteng',
  '比优速': 'biyousu',
  '便利快递': 'bianlike',
  'CCES': 'cces',
  'City-Link': 'citylink',
  'Daewoo': 'daewoo',
  'DPEX': 'dpex',
  'E-Packet': 'epacket',
  'Fedex IP': 'fedexip',
  'Fedex IE': 'fedexie',
  'Firstflight': 'firstflight',
  'Force': 'force',
  'GLS': 'gls',
  'Globeflight': 'globeflight',
  'Gogoxpress': 'gogoxpress',
  'GT Express': 'gtexpress',
  'Hermes': 'hermes',
  'Hong Kong Post': 'hkpost',
  'India Post': 'indiapost',
  'Indah': 'indah',
  'Interparcel': 'interparcel',
  'JNE': 'jne',
  'Kerry Express': 'kerryexpress',
  'Korea Post': 'koreapost',
  'LBC': 'lbc',
  'Lion Parcel': 'lionparcel',
  'Mail Boxes Etc.': 'mailboxet',
  'Mondial Relay': 'mondialrelay',
  'Ninja Van': 'ninjavan',
  'NZ Post': 'nzpost',
  'Pakistan Post': 'pakistanpost',
  'Parcel Force': 'parcelforce',
  'Parcelhub': 'parcelhub',
  'Pitney Bowes': 'pitneybowes',
  'Poste Italiane': 'posteitaliane',
  'Poslaju': 'poslaju',
  'Qxpress': 'qxpress',
  'Royal Mail': 'royalmail',
  'Russian Post': 'russianpost',
  'Sagawa': 'sagawa',
  'Sampark': 'sampark',
  'SF Express': 'sf',
  'Sicepat': 'sicepat',
  'SingPost': 'singpost',
  'Skynet': 'skynet',
  'Sri Lanka Post': 'slpost',
  'StarTrack': 'startrack',
  'Swiss Post': 'swisspost',
  'TBS': 'tbs',
  'TNT': 'tnt',
  'Ta-Q-Bin': 'taqbin',
  'Thailand Post': 'thailandpost',
  'Toll': 'toll',
  'Transcorp': 'transcorp',
  'Turkish Post': 'turkishpost',
  'USPS': 'usps',
  'Vietnam Post': 'vnpost',
  'XpressBees': 'xpressbees',
  'Yamato': 'yamato',
  'Yodel': 'yodel',
  'YunExpress': 'yunexpress',
  'ZIM': 'zim',
  'ZTO': 'zto'
};

// 根据快递公司名称获取代码
export const getCarrierCode = (carrierName: string): string => {
  return CARRIER_CODES[carrierName] || carrierName.toLowerCase().replace(/\s/g, '');
};

// 角色枚举
export enum Role {
  ADMIN = 'admin',
  USER = 'user'
}

// 用户接口
export interface User {
  id: number;
  username: string;
  password: string;
  email?: string;
  department?: string;
  phone?: string;
  role: Role;
  created_at: string;
  updated_at?: string;
  last_login?: string;
}

// 认证状态接口
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  csrfToken: string | null;
}