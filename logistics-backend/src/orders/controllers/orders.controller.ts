import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from '../services/orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Order } from '../entities/order.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
// 恢复JWT认证守卫
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Query() query) {
    const result = await this.ordersService.getOrders(query);
    return { success: true, data: result };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.getOrderById(Number(id));
    return { success: true, data: { order } };
  }

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(createOrderDto);
    return { success: true, data: { order } };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    const order = await this.ordersService.updateOrder(
      Number(id),
      updateOrderDto,
    );
    return { success: true, data: { order } };
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    const order = await this.ordersService.updateOrderStatus(
      Number(id),
      updateStatusDto,
    );
    return { success: true, data: { order } };
  }

  @Put(':id/archive')
  async archive(@Param('id') id: string) {
    const order = await this.ordersService.archiveOrder(Number(id));
    return { success: true, data: { order } };
  }

  @Put(':id/restore')
  async restore(@Param('id') id: string) {
    const order = await this.ordersService.restoreOrder(Number(id));
    return { success: true, data: { order } };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ordersService.deleteOrder(Number(id));
    return { success: true, message: '订单删除成功' };
  }

  @Post('import')
  async import(@Body() body: { orders: any[] }) {
    const result = await this.ordersService.importOrders(body.orders);
    return { success: true, data: result };
  }

  @Get('export')
  async export(@Query() filters) {
    const orders = await this.ordersService.exportOrders(filters);
    return { success: true, data: { orders } };
  }

  @Post('logistics')
  async createWithLogistics(@Body() body: { order: CreateOrderDto; logisticsData: any }) {
    const order = await this.ordersService.createOrderWithLogistics(body.order, body.logisticsData);
    return { success: true, data: { order } };
  }

  @Post('import-logistics')
  async importWithLogistics(@Body() body: { orders: Array<{ order: CreateOrderDto; logisticsData: any }> }) {
    const result = await this.ordersService.importOrdersWithLogistics(body.orders);
    return { success: true, data: result };
  }
}
