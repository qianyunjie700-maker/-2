import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from './Login';
import { useLogisticsStore } from '../services/store';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../services/store');
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn(),
}));
vi.mock('../services/api');

const mockUseLogisticsStore = useLogisticsStore as any;
const mockUseNavigate = useNavigate as any;
const mockApiService = apiService as any;

describe('Login Component', () => {
  const mockNavigate = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseLogisticsStore.mockReturnValue({
      login: mockLogin,
    } as any);
  });

  it('should render the login form with all elements', () => {
    render(<Login />);

    // Check if logo and brand name are rendered
    expect(screen.getByText(/LOGI/)).toBeInTheDocument();
    expect(screen.getByText(/VIEW/)).toBeInTheDocument();
    expect(screen.getByText(/智能物流全景管控平台/)).toBeInTheDocument();

    // Check if form elements are rendered
    expect(screen.getByLabelText(/用户名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument();
    expect(screen.getByText(/还没有账号？/)).toBeInTheDocument();
    expect(screen.getByText(/立即注册/)).toBeInTheDocument();
  });

  it('should validate form fields and show errors when empty', async () => {
    render(<Login />);

    // Submit empty form
    const submitButton = screen.getByRole('button', { name: /登录/ });
    fireEvent.click(submitButton);

    // Check if validation errors are shown
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument();
    expect(await screen.findByText('请输入密码')).toBeInTheDocument();
  });

  it('should clear validation errors when fields are filled', async () => {
    render(<Login />);

    // Submit empty form to show errors
    const submitButton = screen.getByRole('button', { name: /登录/ });
    fireEvent.click(submitButton);

    // Check if errors are shown initially
    expect(await screen.findByText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByText('请输入密码')).toBeInTheDocument();

    // Fill in the fields
    const usernameInput = screen.getByLabelText(/用户名/);
    const passwordInput = screen.getByLabelText(/密码/);

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'password123' } });

    // Check if errors are cleared
    await waitFor(() => {
      expect(screen.queryByText('请输入用户名')).not.toBeInTheDocument();
      expect(screen.queryByText('请输入密码')).not.toBeInTheDocument();
    });
  });

  it('should handle successful login and navigate to dashboard', async () => {
    const mockLoginResponse = {
      success: true,
      data: {
        user: {
          id: 1,
          username: 'testuser',
          role: 'user',
          email: 'test@example.com',
        },
        access_token: 'mock-jwt-token',
      },
    };

    mockApiService.post.mockResolvedValue(mockLoginResponse);

    render(<Login />);

    // Fill in the form
    const usernameInput = screen.getByLabelText(/用户名/);
    const passwordInput = screen.getByLabelText(/密码/);
    const submitButton = screen.getByRole('button', { name: /登录/ });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'password123' } });
    fireEvent.click(submitButton);

    // Check if loading state is displayed
    expect(await screen.findByText('登录中...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Check if login function is called and navigation happens
    await waitFor(() => {
      expect(mockApiService.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password123',
      });
      expect(mockLogin).toHaveBeenCalledWith(
        mockLoginResponse.data.user,
        mockLoginResponse.data.access_token,
      );
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // Check if loading state is removed after login
    expect(await screen.findByText('登录')).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });

  it('should handle login failure and show error message', async () => {
    const mockLoginError = new Error('Invalid credentials');
    mockApiService.post.mockRejectedValue(mockLoginError);

    render(<Login />);

    // Fill in the form
    const usernameInput = screen.getByLabelText(/用户名/);
    const passwordInput = screen.getByLabelText(/密码/);
    const submitButton = screen.getByRole('button', { name: /登录/ });

    fireEvent.change(usernameInput, { target: { name: 'username', value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { name: 'password', value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    // Check if loading state is displayed
    expect(await screen.findByText('登录中...')).toBeInTheDocument();

    // Check if error message is shown
    expect(await screen.findByText('登录失败，请检查用户名和密码')).toBeInTheDocument();

    // Check if loading state is removed after error
    expect(screen.getByText('登录')).toBeInTheDocument();
  });

  it('should navigate to register page when register link is clicked', () => {
    render(<Login />);

    // Click register link
    const registerLink = screen.getByText(/立即注册/);
    fireEvent.click(registerLink);

    // Check if navigation happens
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });
});
