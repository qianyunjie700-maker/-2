import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderDetail } from './OrderDetail';
import { useLogisticsStore } from '../services/store';
import { apiService } from '../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../services/store');
vi.mock('../services/api');
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: vi.fn(),
  useNavigate: vi.fn(),
}));

const mockUseLogisticsStore = useLogisticsStore as any;
const mockApiService = apiService as any;
const mockUseParams = useParams as any;
const mockUseNavigate = useNavigate as any;

describe('OrderDetail Page', () => {
  const mockOrder = {
    id: 1,
    order_number: 'TRK123456789',
    customer_name: 'Test Customer',
    department_key: 'DEP001',
    department_name: '测试部门',
    status: 'pending',
    warning_status: 'none',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    details: null,
  };

  const mockNavigate = vi.fn();

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

    // Mock router
    mockUseParams.mockReturnValue({ id: '1' });
    mockUseNavigate.mockReturnValue(mockNavigate);

    // Mock API responses
    mockApiService.get.mockResolvedValue({
      success: true,
      data: mockOrder,
    });
  });

  it('should render order detail page with all sections', async () => {
    render(<OrderDetail />);

    // Wait for order data to be fetched
    await waitFor(() => {
      expect(screen.getByText('订单详情')).toBeInTheDocument();
      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.getByText('状态管理')).toBeInTheDocument();
      expect(screen.getByText('操作日志')).toBeInTheDocument();
    });

    // Check if API call was made to fetch order
    expect(mockApiService.get).toHaveBeenCalledWith('/orders/1');
  });

  it('should display order information correctly', async () => {
    render(<OrderDetail />);

    // Wait for order data to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
      expect(screen.getByText('测试部门')).toBeInTheDocument();
      expect(screen.getByText('待处理')).toBeInTheDocument();
    });
  });

  it('should handle back button click', async () => {
    render(<OrderDetail />);

    // Wait for page to render
    await waitFor(() => {
      expect(screen.getByText('订单详情')).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByText('返回列表');
    fireEvent.click(backButton);

    // Check if navigation occurred
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('should update order status', async () => {
    render(<OrderDetail />);

    // Wait for order data to load
    await waitFor(() => {
      expect(screen.getByText('待处理')).toBeInTheDocument();
    });

    // Mock status update API
    mockApiService.put.mockResolvedValue({
      success: true,
      data: {
        ...mockOrder,
        status: 'in_transit',
      },
    });

    // Click status update button
    const statusButton = screen.getByRole('button', { name: /更新状态/ });
    fireEvent.click(statusButton);

    // Select new status
    const newStatusOption = screen.getByText('运输中');
    fireEvent.click(newStatusOption);

    // Click confirm button
    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

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

  it('should handle order deletion', async () => {
    render(<OrderDetail />);

    // Wait for order data to load
    await waitFor(() => {
      expect(screen.getByText('TRK123456789')).toBeInTheDocument();
    });

    // Mock delete API
    mockApiService.delete.mockResolvedValue({
      success: true,
      message: '订单删除成功',
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /删除订单/ });
    fireEvent.click(deleteButton);

    // Click confirm button in modal
    const confirmButton = screen.getByText('确认删除');
    fireEvent.click(confirmButton);

    // Check if API call was made
    await waitFor(() => {
      expect(mockApiService.delete).toHaveBeenCalledWith('/orders/1');
    });

    // Check if navigation occurred after deletion
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('should display loading state while fetching order', () => {
    // Mock loading state
    const mockPromise = new Promise(() => {});
    mockApiService.get.mockReturnValue(mockPromise as any);

    render(<OrderDetail />);

    // Check if loading indicator is displayed
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should display error message when order fetch fails', async () => {
    // Mock API error
    mockApiService.get.mockRejectedValue(new Error('Order not found'));

    render(<OrderDetail />);

    // Check if error message is displayed
    expect(await screen.findByText('订单信息获取失败')).toBeInTheDocument();
  });

  it('should display not found message for non-existent order', async () => {
    // Mock API response for not found
    mockApiService.get.mockResolvedValue({
      success: false,
      message: '订单不存在',
    });

    render(<OrderDetail />);

    // Check if not found message is displayed
    expect(await screen.findByText('订单不存在')).toBeInTheDocument();
  });

  it('should handle unauthorized access', () => {
    // Mock unauthenticated user
    mockUseLogisticsStore.mockReturnValue({
      auth: {
        isAuthenticated: false,
      },
    } as any);

    render(<OrderDetail />);

    // Check if navigation to login page occurs
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should show warning message when updating status to warning', async () => {
    render(<OrderDetail />);

    // Wait for order data to load
    await waitFor(() => {
      expect(screen.getByText('待处理')).toBeInTheDocument();
    });

    // Click status update button
    const statusButton = screen.getByRole('button', { name: /更新状态/ });
    fireEvent.click(statusButton);

    // Select warning status
    const warningStatusOption = screen.getByText('预警');
    fireEvent.click(warningStatusOption);

    // Click confirm button
    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    // Check if warning message input is displayed
    expect(screen.getByPlaceholderText('请输入预警原因')).toBeInTheDocument();
  });
});
