import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from './Layout';
import { useLogisticsStore } from '../services/store';
import { useLocation, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../services/store');
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
}));

const mockUseLogisticsStore = useLogisticsStore as any;
const mockUseLocation = useLocation as any;
const mockUseNavigate = useNavigate as any;

describe('Layout Component', () => {
  const mockNavigate = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/' } as any);
    mockUseNavigate.mockReturnValue(mockNavigate);
  });

  it('should render with user information and navigation for admin user', () => {
    mockUseLogisticsStore.mockReturnValue({
      auth: {
        isAuthenticated: true,
        user: {
          id: 1,
          username: 'adminuser',
          role: 'admin',
          email: 'admin@example.com',
        },
        token: 'mock-token',
      },
      logout: mockLogout,
    } as any);

    render(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    );

    // Check if logo and brand name are rendered
    expect(screen.getByText(/LOGI/)).toBeInTheDocument();
    expect(screen.getByText(/VIEW/)).toBeInTheDocument();
    expect(screen.getByText(/智能物流全景管控平台/)).toBeInTheDocument();

    // Check if admin user information is rendered
    expect(screen.getByText('adminuser')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();

    // Check if all navigation items are rendered for admin
    expect(screen.getByText('总控看板')).toBeInTheDocument();
    expect(screen.getByText('业务明细')).toBeInTheDocument();
    expect(screen.getByText('数据中台')).toBeInTheDocument();
    expect(screen.getByText('个人信息')).toBeInTheDocument();
    expect(screen.getByText('退出登录')).toBeInTheDocument();

    // Check if content is rendered
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render without admin navigation for regular user', () => {
    mockUseLogisticsStore.mockReturnValue({
      auth: {
        isAuthenticated: true,
        user: {
          id: 2,
          username: 'user',
          role: 'user',
          email: 'user@example.com',
        },
        token: 'mock-token',
      },
      logout: mockLogout,
    } as any);

    render(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    );

    // Check if regular user information is rendered
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('普通用户')).toBeInTheDocument();

    // Check if navigation items are rendered for regular user
    expect(screen.getByText('总控看板')).toBeInTheDocument();
    expect(screen.getByText('业务明细')).toBeInTheDocument();
    expect(screen.getByText('个人信息')).toBeInTheDocument();

    // Check if admin-only navigation is not rendered
    expect(screen.queryByText('数据中台')).not.toBeInTheDocument();
  });

  it('should highlight active navigation item', () => {
    // Set location to /departments
    mockUseLocation.mockReturnValue({ pathname: '/departments' } as any);
    
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
      logout: mockLogout,
    } as any);

    render(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    );

    // Check if '业务明细' link has active styling
    const departmentsLink = screen.getByText('业务明细').closest('a');
    expect(departmentsLink).toHaveClass('text-cyan-400');

    // Check if '总控看板' link does not have active styling
    const dashboardLink = screen.getByText('总控看板').closest('a');
    expect(dashboardLink).toHaveClass('text-slate-400');
  });

  it('should handle logout correctly', () => {
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
      logout: mockLogout,
    } as any);

    render(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    );

    // Click logout button
    const logoutButton = screen.getByText('退出登录');
    fireEvent.click(logoutButton);

    // Check if logout function is called and navigation happens
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should display system status indicator', () => {
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
      logout: mockLogout,
    } as any);

    render(
      <Layout>
        <div>Test Content</div>
      </Layout>,
    );

    // Check if system status is displayed
    expect(screen.getByText('系统运行中')).toBeInTheDocument();
    // Check if status indicator is present
    const statusIndicator = screen.getByRole('img'); // Assuming the status dot is rendered as an image
    expect(statusIndicator).toBeInTheDocument();
  });
});
