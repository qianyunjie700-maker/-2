// 简单测试脚本，检查前端API服务配置
console.log('测试前端API服务配置...');

// 检查Vite配置
import fs from 'fs';
import path from 'path';

// 读取Vite配置
const viteConfigPath = path.join('vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  console.log('✅ Vite配置文件存在');
  
  // 检查代理配置
  if (viteConfig.includes('/api')) {
    console.log('✅ API代理配置存在');
    
    // 检查是否有rewrite配置
    if (viteConfig.includes('rewrite')) {
      console.log('⚠️  发现rewrite配置，需要确认是否正确');
    } else {
      console.log('✅ 没有rewrite配置，请求将直接代理到后端');
    }
  } else {
    console.log('❌ 未找到API代理配置');
  }
} else {
  console.log('❌ Vite配置文件不存在');
}

// 读取API服务配置
const apiServicePath = path.join('services', 'api.ts');
if (fs.existsSync(apiServicePath)) {
  const apiService = fs.readFileSync(apiServicePath, 'utf8');
  console.log('✅ API服务文件存在');
  
  // 检查baseURL配置
  if (apiService.includes('baseURL: \'/api\'')) {
    console.log('✅ API服务baseURL配置为/api');
  } else {
    console.log('❌ API服务baseURL配置不正确');
  }
  
  // 检查请求拦截器
  if (apiService.includes('Authorization')) {
    console.log('✅ 请求拦截器包含Authorization头设置');
    
    // 检查token获取逻辑
    if (apiService.includes('useLogisticsStore.getState().auth.token')) {
      console.log('✅ 请求拦截器使用store中的token');
    } else {
      console.log('❌ 请求拦截器未正确从store获取token');
    }
  } else {
    console.log('❌ 请求拦截器未包含Authorization头设置');
  }
  
  // 检查响应拦截器日志
  if (apiService.includes('API请求成功') && apiService.includes('API请求失败')) {
    console.log('✅ 响应拦截器包含详细日志记录');
  } else {
    console.log('❌ 响应拦截器日志记录不完整');
  }
} else {
  console.log('❌ API服务文件不存在');
}

console.log('测试完成！');
