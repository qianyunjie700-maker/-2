import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, WarningStatus } from '../entities/order.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async getOrders(query: any): Promise<any> {
    const {
      page = 1,
      limit = 10,
      department_key,
      status,
      is_archived = false,
      search,
    } = query;
    const offset = (page - 1) * limit;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.is_archived = :isArchived', {
        isArchived: is_archived === 'true' || false,
      });

    // 部门筛选
    if (department_key) {
      queryBuilder.andWhere('order.department_key = :departmentKey', {
        departmentKey: department_key,
      });
    }

    // 状态筛选
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    // 搜索功能
    if (search) {
      queryBuilder.andWhere(
        'order.order_number LIKE :search OR order.customer_name LIKE :search',
        { search: `%${search}%` },
      );
    }

    // 分页
    const [orders, total] = await queryBuilder
      .skip(offset)
      .take(Number(limit))
      .orderBy('order.created_at', 'DESC')
      .getManyAndCount();

    return {
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getOrderById(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`ID为${id}的订单不存在`);
    }
    return order;
  }

  async createOrder(orderData: any): Promise<Order> {
    // 生成唯一物流单号
    const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const newOrder = this.ordersRepository.create({
      ...orderData,
      order_number: orderData.order_number || trackingNumber,
      status: orderData.status || OrderStatus.PENDING,
      warning_status: orderData.warning_status || WarningStatus.NONE,
    });

    const savedOrders = await this.ordersRepository.save(newOrder);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单创建失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async updateOrder(id: number, orderData: any): Promise<Order> {
    const order = await this.getOrderById(id);

    // 更新订单信息
    Object.assign(order, orderData);

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单更新失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async updateOrderStatus(id: number, statusData: any): Promise<Order> {
    const order = await this.getOrderById(id);

    // 更新订单状态
    if (statusData.status) {
      order.status = statusData.status;
    }

    if (statusData.warning_status) {
      order.warning_status = statusData.warning_status;
    }

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单状态更新失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async archiveOrder(id: number): Promise<Order> {
    const order = await this.getOrderById(id);
    order.is_archived = true;

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单归档失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async restoreOrder(id: number): Promise<Order> {
    const order = await this.getOrderById(id);
    order.is_archived = false;

    const savedOrders = await this.ordersRepository.save(order);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单恢复失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async deleteOrder(id: number): Promise<void> {
    const result = await this.ordersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
  }

  async importOrders(ordersData: any[]): Promise<any> {
    // 检查是否有manager对象且支持transaction方法
    if (
      this.ordersRepository.manager &&
      typeof this.ordersRepository.manager.transaction === 'function'
    ) {
      // 生产环境：使用事务确保批量导入的原子性
      return await this.ordersRepository.manager.transaction(
        async (transactionalEntityManager) => {
          return this.importOrdersWithTransaction(
            ordersData,
            transactionalEntityManager,
          );
        },
      );
    } else {
      // 测试环境：不使用事务，直接导入
      // 注意：测试环境可能没有完整的TypeORM事务支持
      return this.importOrdersWithTransaction(
        ordersData,
        this.ordersRepository,
      );
    }
  }

  // 内部方法：实际执行订单导入逻辑
  private async importOrdersWithTransaction(
    ordersData: any[],
    entityManager: any,
  ): Promise<any> {
    const createdOrders: Order[] = [];
    const errors: Array<{ index: number; error: string; data: any }> = [];

    for (let i = 0; i < ordersData.length; i++) {
      try {
        const orderData = ordersData[i];
        
        // 验证必填字段
        if (!orderData.customer_name || orderData.customer_name.trim() === '') {
          throw new Error('客户名称(customer_name)不能为空');
        }
        
        if (!orderData.department_key || orderData.department_key.trim() === '') {
          throw new Error('部门键(department_key)不能为空');
        }

        // 生成唯一物流单号
        const trackingNumber = `TRK${Date.now()}${i}${Math.floor(Math.random() * 100)}`;

        const newOrder = entityManager.create(Order, {
          ...orderData,
          order_number: orderData.order_number || trackingNumber,
          status: orderData.status || OrderStatus.PENDING,
          warning_status: orderData.warning_status || WarningStatus.NONE,
        });

        // 使用传入的实体管理器保存订单
        const savedOrders = await entityManager.save(newOrder);
        // 安全处理TypeORM可能返回的数组结果
        const createdOrder = Array.isArray(savedOrders)
          ? savedOrders[0]
          : savedOrders;
        if (createdOrder) {
          createdOrders.push(createdOrder);
        } else {
          throw new Error('订单导入失败，未返回有效的订单数据');
        }
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          data: ordersData[i],
        });
      }
    }

    return {
      successCount: createdOrders.length,
      errorCount: errors.length,
      errors,
      createdOrders,
    };
  }

  async exportOrders(filters?: any): Promise<Order[]> {
    const queryBuilder = this.ordersRepository.createQueryBuilder('order');

    // 应用筛选条件
    if (filters?.department_key) {
      queryBuilder.where('order.department_key = :departmentKey', {
        departmentKey: filters.department_key,
      });
    }

    if (filters?.status) {
      if (queryBuilder.getParameters().departmentKey) {
        queryBuilder.andWhere('order.status = :status', { status: filters.status });
      } else {
        queryBuilder.where('order.status = :status', { status: filters.status });
      }
    }

    if (filters?.date_range) {
      if (queryBuilder.getParameters().departmentKey || queryBuilder.getParameters().status) {
        queryBuilder.andWhere('order.created_at BETWEEN :start AND :end', {
          start: filters.date_range.start,
          end: filters.date_range.end,
        });
      } else {
        queryBuilder.where('order.created_at BETWEEN :start AND :end', {
          start: filters.date_range.start,
          end: filters.date_range.end,
        });
      }
    }

    return queryBuilder.orderBy('order.created_at', 'DESC').getMany();
  }

  async createOrderWithLogistics(orderData: any, logisticsData: any): Promise<Order> {
    // 根据物流状态设置订单状态
    let orderStatus = OrderStatus.PENDING;
    if (logisticsData.wuliuzhuangtai === '已签收') {
      orderStatus = OrderStatus.DELIVERED;
    } else if (logisticsData.wuliuzhuangtai === '运输中') {
      orderStatus = OrderStatus.IN_TRANSIT;
    }

    const newOrder = this.ordersRepository.create({
      ...orderData,
      order_number: orderData.order_number,
      status: orderStatus,
      warning_status: orderData.warning_status || WarningStatus.NONE,
      details: {
        ...orderData.details,
        logisticsData: logisticsData,
        tracking: orderData.details?.tracking || []
      }
    });

    const savedOrders = await this.ordersRepository.save(newOrder);
    // 安全处理TypeORM可能返回的数组结果
    const savedOrder = Array.isArray(savedOrders)
      ? savedOrders[0]
      : savedOrders;
    if (!savedOrder) {
      throw new Error('订单创建失败，未返回有效的订单数据');
    }
    return savedOrder;
  }

  async importOrdersWithLogistics(ordersData: Array<{ order: any; logisticsData: any }>): Promise<any> {
    // 检查是否有manager对象且支持transaction方法
    if (
      this.ordersRepository.manager &&
      typeof this.ordersRepository.manager.transaction === 'function'
    ) {
      // 生产环境：使用事务确保批量导入的原子性
      return await this.ordersRepository.manager.transaction(
        async (transactionalEntityManager) => {
          return this.importOrdersWithLogisticsTransaction(
            ordersData,
            transactionalEntityManager,
          );
        },
      );
    } else {
      // 测试环境：不使用事务，直接导入
      // 注意：测试环境可能没有完整的TypeORM事务支持
      return this.importOrdersWithLogisticsTransaction(
        ordersData,
        this.ordersRepository,
      );
    }
  }

  // 内部方法：实际执行包含物流信息的订单导入逻辑
  private async importOrdersWithLogisticsTransaction(
    ordersData: Array<{ order: any; logisticsData: any }>,
    entityManager: any,
  ): Promise<any> {
    const createdOrders: Order[] = [];
    const errors: Array<{ index: number; error: string; data: any }> = [];

    for (let i = 0; i < ordersData.length; i++) {
      try {
        const { order: orderData, logisticsData } = ordersData[i];
        
        // 验证必填字段
        if (!orderData.customer_name || orderData.customer_name.trim() === '') {
          throw new Error('客户名称(customer_name)不能为空');
        }
        
        if (!orderData.department_key || orderData.department_key.trim() === '') {
          throw new Error('部门键(department_key)不能为空');
        }

        if (!orderData.order_number || orderData.order_number.trim() === '') {
          throw new Error('物流单号(order_number)不能为空');
        }

        // 根据物流状态设置订单状态
        let orderStatus = OrderStatus.PENDING;
        if (logisticsData.wuliuzhuangtai === '已签收') {
          orderStatus = OrderStatus.DELIVERED;
        } else if (logisticsData.wuliuzhuangtai === '运输中') {
          orderStatus = OrderStatus.IN_TRANSIT;
        }

        const newOrder = entityManager.create(Order, {
          ...orderData,
          order_number: orderData.order_number,
          status: orderStatus,
          warning_status: orderData.warning_status || WarningStatus.NONE,
          details: {
            ...orderData.details,
            logisticsData: logisticsData,
            tracking: orderData.details?.tracking || []
          }
        });

        // 使用传入的实体管理器保存订单
        const savedOrders = await entityManager.save(newOrder);
        // 安全处理TypeORM可能返回的数组结果
        const createdOrder = Array.isArray(savedOrders)
          ? savedOrders[0]
          : savedOrders;
        if (createdOrder) {
          createdOrders.push(createdOrder);
        } else {
          throw new Error('订单导入失败，未返回有效的订单数据');
        }
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          data: ordersData[i],
        });
      }
    }

    return {
      successCount: createdOrders.length,
      errorCount: errors.length,
      errors,
      createdOrders,
    };
  }
}
