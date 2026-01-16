import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';
import { vi } from 'vitest';


vi.mock('lucide-react', () => ({
  BarChart3: vi.fn(() => <div data-testid="bar-chart-icon" />),
  Package: vi.fn(() => <div data-testid="package-icon" />),
  AlertTriangle: vi.fn(() => <div data-testid="alert-triangle-icon" />),
  CheckCircle2: vi.fn(() => <div data-testid="check-circle-icon" />),
}));

describe('StatCard Component', () => {
  it('should render StatCard with all required props', () => {
    render(
      <StatCard
        title="总订单数"
        value="1,234"
        icon="Package"
        trend={12.5}
        trendType="percentage"
        size="large"
        color="blue"
      />,
    );


    expect(screen.getByText('总订单数')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByTestId('package-icon')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('should render with different icon types', () => {
    render(
      <StatCard
        title="警告订单"
        value="45"
        icon="AlertTriangle"
        trend={-5.2}
        trendType="percentage"
        size="medium"
        color="orange"
      />,
    );

    expect(screen.getByText('警告订单')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });

  it('should render with number trend type', () => {
    render(
      <StatCard
        title="新增用户"
        value="234"
        icon="CheckCircle2"
        trend={15}
        trendType="number"
        size="small"
        color="green"
      />,
    );

    expect(screen.getByText('新增用户')).toBeInTheDocument();
    expect(screen.getByText('234')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
  });

  it('should render without trend information', () => {
    render(
      <StatCard
        title="总销售额"
        value="¥56,789"
        icon="BarChart3"
        size="large"
        color="purple"
      />,
    );

    expect(screen.getByText('总销售额')).toBeInTheDocument();
    expect(screen.getByText('¥56,789')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart-icon')).toBeInTheDocument();
    expect(screen.queryByText(/\+|%/)).not.toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    // Large size
    const { container: largeContainer } = render(
      <StatCard
        title="Large Card"
        value="100"
        icon="Package"
        size="large"
        color="blue"
      />,
    );
    expect(largeContainer.firstChild).toHaveClass('text-3xl');

    // Medium size
    const { container: mediumContainer } = render(
      <StatCard
        title="Medium Card"
        value="100"
        icon="Package"
        size="medium"
        color="blue"
      />,
    );
    expect(mediumContainer.firstChild).toHaveClass('text-2xl');

    // Small size
    const { container: smallContainer } = render(
      <StatCard
        title="Small Card"
        value="100"
        icon="Package"
        size="small"
        color="blue"
      />,
    );
    expect(smallContainer.firstChild).toHaveClass('text-xl');
  });

  it('should render with different colors', () => {
    // Blue color
    const { container: blueContainer } = render(
      <StatCard
        title="Blue Card"
        value="100"
        icon="Package"
        size="medium"
        color="blue"
      />,
    );
    expect(blueContainer.firstChild).toHaveClass('bg-blue-50');

    // Green color
    const { container: greenContainer } = render(
      <StatCard
        title="Green Card"
        value="100"
        icon="Package"
        size="medium"
        color="green"
      />,
    );
    expect(greenContainer.firstChild).toHaveClass('bg-green-50');

    // Orange color
    const { container: orangeContainer } = render(
      <StatCard
        title="Orange Card"
        value="100"
        icon="Package"
        size="medium"
        color="orange"
      />,
    );
    expect(orangeContainer.firstChild).toHaveClass('bg-orange-50');

    // Purple color
    const { container: purpleContainer } = render(
      <StatCard
        title="Purple Card"
        value="100"
        icon="Package"
        size="medium"
        color="purple"
      />,
    );
    expect(purpleContainer.firstChild).toHaveClass('bg-purple-50');
  });
});
