import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { Repository } from 'typeorm';
import { Order, OrderStatus, WarningStatus } from '../entities/order.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

const mockOrders: Order[] = [
  {
    id: 1,
    order_number: 'TRK123456789',
    customer_name: 'Test Customer 1',
    department_key: 'DEP001',
    status: OrderStatus.PENDING,
    warning_status: WarningStatus.NONE,
    is_archived: false,
    details: null,
    created_at: new Date(),
    updated_at: new Date(),
    user_id: 1,
  },
  {
    id: 2,
    order_number: 'TRK987654321',
    customer_name: 'Test Customer 2',
    department_key: 'DEP002',
    status: OrderStatus.IN_TRANSIT,
    warning_status: WarningStatus.NONE,
    is_archived: false,
    details: null,
    created_at: new Date(),
    updated_at: new Date(),
    user_id: 1,
  },
];

describe('OrdersService', () => {
  let ordersService: OrdersService;
  let ordersRepository: Repository<Order>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useClass: Repository,
        },
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    ordersRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
  });

  describe('getOrders', () => {
    it('should return orders with pagination', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([mockOrders, mockOrders.length]),
      };

      jest
        .spyOn(ordersRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await ordersService.getOrders({ page: 1, limit: 10 });

      expect(ordersRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual({
        orders: mockOrders,
        pagination: {
          total: mockOrders.length,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should filter orders by department', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockOrders[0]], 1]),
      };

      jest
        .spyOn(ordersRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      await ordersService.getOrders({ department_key: 'DEP001' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'order.department_key = :departmentKey',
        { departmentKey: 'DEP001' },
      );
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID', async () => {
      jest.spyOn(ordersRepository, 'findOne').mockResolvedValue(mockOrders[0]);

      const result = await ordersService.getOrderById(1);

      expect(ordersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockOrders[0]);
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(ordersRepository, 'findOne').mockResolvedValue(null);

      await expect(ordersService.getOrderById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createOrder', () => {
    it('should create a new order with default values', async () => {
      const orderData = {
        customer_name: 'New Customer',
        department_key: 'DEP001',
      };

      jest.spyOn(ordersRepository, 'create').mockReturnValue({} as Order);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(mockOrders[0]);

      const result = await ordersService.createOrder(orderData);

      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(orderData),
      );
      expect(ordersRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockOrders[0]);
    });

    it('should use provided values if available', async () => {
      const orderData = {
        customer_name: 'New Customer',
        department_key: 'DEP001',
        order_number: 'CUSTOM123',
        status: OrderStatus.IN_TRANSIT,
      };

      jest.spyOn(ordersRepository, 'create').mockReturnValue({} as Order);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(mockOrders[0]);

      await ordersService.createOrder(orderData);

      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_number: 'CUSTOM123',
          status: OrderStatus.IN_TRANSIT,
        }),
      );
    });
  });

  describe('updateOrder', () => {
    it('should update an existing order', async () => {
      const orderData = { status: OrderStatus.DELIVERED };
      const updatedOrder = { ...mockOrders[0], ...orderData };

      jest
        .spyOn(ordersService, 'getOrderById')
        .mockResolvedValue(mockOrders[0]);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(updatedOrder);

      const result = await ordersService.updateOrder(1, orderData);

      expect(ordersService.getOrderById).toHaveBeenCalledWith(1);
      expect(ordersRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedOrder);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const statusData = {
        status: OrderStatus.DELIVERED,
        warning_status: WarningStatus.TRANSIT_ABNORMAL,
      };
      const updatedOrder = { ...mockOrders[0], ...statusData };

      jest
        .spyOn(ordersService, 'getOrderById')
        .mockResolvedValue(mockOrders[0]);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(updatedOrder);

      const result = await ordersService.updateOrderStatus(1, statusData);

      expect(ordersService.getOrderById).toHaveBeenCalledWith(1);
      expect(ordersRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedOrder);
    });
  });

  describe('archiveOrder', () => {
    it('should archive an order', async () => {
      const archivedOrder = { ...mockOrders[0], is_archived: true };

      jest
        .spyOn(ordersService, 'getOrderById')
        .mockResolvedValue(mockOrders[0]);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(archivedOrder);

      const result = await ordersService.archiveOrder(1);

      expect(result.is_archived).toBe(true);
    });
  });

  describe('restoreOrder', () => {
    it('should restore an archived order', async () => {
      const archivedOrder = { ...mockOrders[0], is_archived: true };
      const restoredOrder = { ...archivedOrder, is_archived: false };

      jest
        .spyOn(ordersService, 'getOrderById')
        .mockResolvedValue(archivedOrder);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(restoredOrder);

      const result = await ordersService.restoreOrder(1);

      expect(result.is_archived).toBe(false);
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order', async () => {
      jest
        .spyOn(ordersRepository, 'delete')
        .mockResolvedValue({ affected: 1, raw: {} });

      await ordersService.deleteOrder(1);

      expect(ordersRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if order not found', async () => {
      jest
        .spyOn(ordersRepository, 'delete')
        .mockResolvedValue({ affected: 0, raw: {} });

      await expect(ordersService.deleteOrder(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('importOrders', () => {
    it('should import multiple orders', async () => {
      const ordersData = [
        { customer_name: 'Import Customer 1', department_key: 'DEP001' },
        { customer_name: 'Import Customer 2', department_key: 'DEP002' },
      ];

      jest.spyOn(ordersRepository, 'create').mockReturnValue({} as Order);
      jest.spyOn(ordersRepository, 'save').mockResolvedValue(mockOrders[0]);

      const result = await ordersService.importOrders(ordersData);

      expect(ordersRepository.create).toHaveBeenCalledTimes(2);
      expect(ordersRepository.save).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should handle errors during import', async () => {
      const ordersData = [
        { customer_name: 'Import Customer 1', department_key: 'DEP001' },
        { customer_name: '', department_key: 'DEP002' }, // Invalid data
      ];

      jest.spyOn(ordersRepository, 'create').mockReturnValue({} as Order);
      jest
        .spyOn(ordersRepository, 'save')
        .mockResolvedValueOnce(mockOrders[0])
        .mockRejectedValueOnce(new Error('Invalid order data'));

      // 由于事务处理，当有一条订单失败时，整个导入应该失败
      await expect(ordersService.importOrders(ordersData)).rejects.toThrow(
        /导入第2条订单时失败/,
      );
    });
  });

  describe('exportOrders', () => {
    it('should export orders with filters', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockOrders[0]]),
      };

      jest
        .spyOn(ordersRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await ordersService.exportOrders({
        department_key: 'DEP001',
      });

      expect(ordersRepository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'order.department_key = :departmentKey',
        { departmentKey: 'DEP001' },
      );
      expect(result).toEqual([mockOrders[0]]);
    });
  });
});
