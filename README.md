# 智能物流看板

## 项目介绍
智能物流看板是一个基于前后端分离架构的物流管理系统，提供订单管理、用户管理、部门管理和数据可视化等功能，帮助企业实现物流信息的集中管理和实时监控。

## 技术栈

### 前端
- React 19：UI 框架
- TypeScript 5.8：类型安全
- Vite 6：构建工具
- Zustand 5：状态管理
- Axios：HTTP 客户端
- React Router DOM 7：路由管理
- Recharts：数据可视化

### 后端
- NestJS：Node.js 框架
- TypeScript 5.7：类型安全
- TypeORM：ORM 工具
- MySQL 8.0：数据库
- JWT：认证机制
- Passport：权限控制

## 功能特性

### 用户管理
- 用户注册和登录
- 个人资料管理
- 角色权限控制（普通用户/管理员）

### 订单管理
- 订单列表展示
- 订单详情查看
- 订单状态管理
- 订单数据导出

### 部门管理
- 部门列表展示
- 部门信息查看

### 数据可视化
- 物流数据仪表盘
- 订单数据统计分析
- 实时数据监控

### 系统管理
- 用户管理（管理员权限）
- 系统日志记录
- 系统配置管理

## 安装步骤

### 前置条件
- Node.js 18.x 或更高版本
- npm 或 yarn 包管理器
- MySQL 8.0 数据库
- Docker（可选，用于运行 MySQL 容器）

### 前端安装
1. 进入项目根目录
```bash
cd d:/智能看板
```

2. 安装依赖
```bash
npm install
```

### 后端安装
1. 进入后端目录
```bash
cd d:/智能看板/logistics-backend
```

2. 安装依赖
```bash
npm install
```

## 运行方法

### 1. 启动数据库

#### 方法一：使用 Docker 运行 MySQL
```bash
docker run -d --name logistics-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=logistics mysql:8.0
```

#### 方法二：使用本地 MySQL
- 创建数据库：`logistics`
- 配置数据库用户和密码

### 2. 配置环境变量

#### 后端环境变量
编辑 `logistics-backend/.env` 文件：
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_NAME=logistics

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION_TIME=3600s

# Server Configuration
PORT=3001
```

### 3. 启动后端服务

```bash
# 开发模式
cd d:/智能看板/logistics-backend
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

后端服务默认运行在 `http://localhost:3001`

### 4. 启动前端服务

```bash
# 开发模式
cd d:/智能看板
npm run dev

# 生产模式
npm run build
npm run preview
```

前端服务默认运行在 `http://localhost:3000`

## 项目结构

### 前端结构
```
智能看板/
├── components/         # 通用组件
├── dist/              # 构建输出目录
├── pages/             # 页面组件
├── services/          # 服务层（API、状态管理）
├── styles/            # 样式文件
├── utils/             # 工具函数
├── App.tsx            # 应用入口组件
├── index.tsx          # 项目入口文件
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript 配置
├── vite.config.ts     # Vite 配置
└── types.ts           # 类型定义
```

### 后端结构
```
logistics-backend/
├── src/
│   ├── auth/          # 认证模块
│   ├── departments/   # 部门模块
│   ├── operation-logs/# 操作日志模块
│   ├── orders/        # 订单模块
│   ├── users/         # 用户模块
│   ├── app.module.ts  # 应用主模块
│   └── main.ts        # 应用入口
├── dist/              # 构建输出目录
├── .env               # 环境变量配置
├── package.json       # 项目配置
├── tsconfig.json      # TypeScript 配置
└── nest-cli.json      # NestJS CLI 配置
```

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/profile` - 获取用户资料

### 订单接口
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id` - 更新订单
- `DELETE /api/orders/:id` - 删除订单

### 部门接口
- `GET /api/departments` - 获取部门列表
- `GET /api/departments/:id` - 获取部门详情

### 用户接口（管理员）
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户

## 环境变量说明

### 前端环境变量
- `GEMINI_API_KEY` - Gemini API 密钥（用于智能功能）

### 后端环境变量
- `DB_HOST` - 数据库主机地址
- `DB_PORT` - 数据库端口
- `DB_USERNAME` - 数据库用户名
- `DB_PASSWORD` - 数据库密码
- `DB_NAME` - 数据库名称
- `JWT_SECRET` - JWT 签名密钥
- `JWT_EXPIRATION_TIME` - JWT 过期时间
- `PORT` - 后端服务端口

## 开发指南

### 代码规范
- 使用 TypeScript 编写所有代码
- 遵循 ESLint 和 Prettier 代码规范
- 编写清晰的代码注释

### 提交规范
- 遵循 Conventional Commits 规范
- 提交信息格式：`类型(范围): 描述`
- 类型包括：feat, fix, docs, style, refactor, test, chore

## 测试

### 前端测试

前端使用 **Vitest** 和 **React Testing Library** 进行测试：

#### 测试命令
```bash
# 运行所有测试
npm test

# 交互式运行测试（监听模式）
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 使用 UI 界面运行测试
npm run test:ui
```

#### 测试类型
- **单元测试**：测试组件、函数和服务的单个功能
- **组件测试**：测试 React 组件的渲染和交互
- **API 测试**：测试 API 服务的请求和响应处理

### 后端测试

后端使用 **Jest** 进行测试：

#### 测试命令
```bash
cd logistics-backend

# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:e2e
```

#### 测试类型
- **单元测试**：测试服务、控制器和中间件的功能
- **集成测试**：测试 API 端点的完整流程
- **端到端测试**：测试系统各组件之间的交互

### 集成测试

集成测试位于 `integration-tests/` 目录，测试完整的业务流程：

```bash
# 运行集成测试
cd d:/智能看板
node integration-tests/orders.e2e-spec.js
```

## 部署说明

### 生产环境部署

#### 1. 构建项目
```bash
# 构建前端
cd d:/智能看板
npm run build

# 构建后端
cd d:/智能看板/logistics-backend
npm run build
```

#### 2. 部署前端
将前端 `dist` 目录部署到静态文件服务器或 CDN

#### 3. 部署后端
- 将后端 `dist` 目录和 `package.json` 部署到服务器
- 安装生产依赖：`npm install --production`
- 使用 PM2 运行后端服务：`pm2 start dist/main.js --name logistics-backend`

#### 4. 配置 Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 注意事项

1. 确保数据库服务正常运行
2. 配置正确的环境变量
3. 开发环境下前端会代理 API 请求到后端服务
4. 生产环境下需要配置正确的 API 地址
5. JWT 密钥应使用安全的随机字符串
6. 定期备份数据库数据

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目维护人员。