import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
}

export enum WarningStatus {
  NONE = 'none',
  DELAY_SHIPMENT = 'delay_shipment',
  TRANSIT_ABNORMAL = 'transit_abnormal',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  // 不需要额外的@Index()，因为unique约束已经会创建索引
  order_number: string;

  @Column({ length: 100 })
  @Index() // 客户名称索引
  customer_name: string;

  @Column({ length: 50 })
  @Index() // 部门键索引
  department_key: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  @Index() // 状态索引
  status: OrderStatus;

  @Column({ type: 'enum', enum: WarningStatus, default: WarningStatus.NONE })
  @Index() // 警告状态索引
  warning_status: WarningStatus;

  @Column({ default: false })
  @Index() // 归档状态索引
  is_archived: boolean;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ default: 1 }) // 默认用户ID为1
  user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
