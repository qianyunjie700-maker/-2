import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { useLogisticsStore } from '../services/store';
import { apiService } from '../services/api';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../services/store');
vi.mock('../services/api');

const mockUseLogisticsStore = useLogisticsStore as any;
const mockApiService = apiService as any;

describe('Dashboard Page', () => {
  const mockOrders = [
    {
      id: 1,
      order_number: 'TRK123456789',
      customer_name: 'Test Customer 1',
      department_key: 'DEP001',
      status: 'pending',
      warning_status: 'none',
      is_archived: false,
    },
    {
      id: 2,
      order_number: 'TRK987654321',
      customer_name: 'Test Customer 2',
      department_key: 'DEP002',
      status: 'in_transit',
      warning_status: 'none',
      is_archived: false,
    },
  ];

  const mockStats = {
    totalOrders: 1234,
    pendingOrders: 456,
    warningOrders: 78,
    deliveredOrders: 890,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogisticsStore.mockReturnValue({
      auth: {
        isAuthenticated: true,
        user: {
          id: 1,
          username: 'adminuser',
          role: 'admin',
        },
        token: 'mock-token',
      },
    } as any);

    // Mock API responses
    mockApiService.get.mockResolvedValue({
      success: true,
      data: {
        orders: mockOrders,
        stats: mockStats,
      },
    });
  });

  it('should render dashboard layout with header and sidebar', () => {
    render(<Dashboard />);

    // Check if dashboard elements are rendered
    expect(screen.getByText('总控看板')).toBeInTheDocument();
    expect(screen.getByText('订单统计')).toBeInTheDocument();
    expect(screen.getByText('预警监控')).toBeInTheDocument();
    expect(screen.getByText('物流信息追踪')).toBeInTheDocument();
  });

  it('should fetch and display order statistics', async () => {
    render(<Dashboard />);

    // Wait for data to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText('总订单数')).toBeInTheDocument();
      expect(screen.getByText('待处理')).toBeInTheDocument();
      expect(screen.getByText('预警订单')).toBeInTheDocument();
      expect(screen.getByText('已完成')).toBeInTheDocument();
    });

    // Check if API call was made
    expect(mockApiService.get).toHaveBeenCalledWith('/orders/dashboard-stats');
  });

  it('should display recent orders table', async () => {
    render(<Dashboard />);

    // Wait for orders to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
      expect(screen.getByText('Test Customer 1')).toBeInTheDocument();
      expect(screen.getByText('TRK987654321')).toBeInTheDocument();
      expect(screen.getByText('Test Customer 2')).toBeInTheDocument();
    });

    // Check if table headers are present
    expect(screen.getByText('订单编号')).toBeInTheDocument();
    expect(screen.getByText('客户名称')).toBeInTheDocument();
    expect(screen.getByText('部门')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('should handle order status filtering', async () => {
    render(<Dashboard />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
    });

    // Click filter dropdown
    const filterButton = screen.getByText('全部');
    fireEvent.click(filterButton);

    // Select "待处理" filter
    const pendingFilter = screen.getByText('待处理');
    fireEvent.click(pendingFilter);

    // Check if API call was made with filter
    expect(mockApiService.get).toHaveBeenCalledWith(
      '/orders/dashboard-stats',
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('should handle order search functionality', async () => {
    render(<Dashboard />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
    });

    // Enter search text
    const searchInput = screen.getByPlaceholderText('搜索订单编号或客户名称');
    fireEvent.change(searchInput, { target: { value: 'TRK123' } });

    // Click search button
    const searchButton = screen.getByRole('button', { name: /搜索/ });
    fireEvent.click(searchButton);

    // Check if API call was made with search term
    expect(mockApiService.get).toHaveBeenCalledWith(
      '/orders/dashboard-stats',
      expect.objectContaining({ search: 'TRK123' }),
    );
  });

  it('should handle refresh button click', async () => {
    render(<Dashboard />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /刷新/ });
    fireEvent.click(refreshButton);

    // Check if API call was made again
    expect(mockApiService.get).toHaveBeenCalledTimes(2);
  });

  it('should display loading state while fetching data', () => {
    // Mock loading state by delaying the API response
    const mockPromise = new Promise(() => {});
    mockApiService.get.mockReturnValue(mockPromise as any);

    render(<Dashboard />);

    // Check if loading indicator is displayed
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should display error message when data fetch fails', async () => {
    // Mock API error
    mockApiService.get.mockRejectedValue(new Error('Failed to fetch data'));

    render(<Dashboard />);

    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText('数据加载失败，请稍后重试')).toBeInTheDocument();
    });
  });

  it('should show empty state when no orders are available', async () => {
    // Mock empty orders response
    mockApiService.get.mockResolvedValue({
      success: true,
      data: {
        orders: [],
        stats: mockStats,
      },
    });

    render(<Dashboard />);

    // Check if empty state is displayed
    await waitFor(() => {
      expect(screen.getByText('暂无订单数据')).toBeInTheDocument();
    });
  });

  it('should handle order status change correctly', async () => {
    render(<Dashboard />);

    // Wait for orders to be fetched
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
    });

    // Mock updateOrderStatus API
    mockApiService.put.mockResolvedValue({
      success: true,
      data: {
        ...mockOrders[0],
        status: 'in_transit',
      },
    });

    // Find and click status change button for first order
    const statusButtons = screen.getAllByRole('button', { name: /状态/ });
    fireEvent.click(statusButtons[0]);

    // Select new status
    const newStatusOption = screen.getByText('运输中');
    fireEvent.click(newStatusOption);

    // Check if API call was made
    await waitFor(() => {
      expect(mockApiService.put).toHaveBeenCalledWith(
        '/orders/1/status',
        expect.objectContaining({ status: 'in_transit' }),
      );
    });

    // Check if success message is displayed
    expect(await screen.findByText('订单状态更新成功')).toBeInTheDocument();
  });
});
