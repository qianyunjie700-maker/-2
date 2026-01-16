import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Length,
  IsObject,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, WarningStatus } from '../entities/order.entity';
import { OrderDetailsDto } from './order-details.dto';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  customer_name: string;
  @IsString()
  @IsNotEmpty()
  department_key: string;
  @IsOptional()
  @IsString()
  order_number?: string;
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
  @IsOptional()
  @IsEnum(WarningStatus)
  warning_status?: WarningStatus;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrderDetailsDto)
  details?: OrderDetailsDto;

  @IsOptional()
  @IsNumber()
  user_id?: number;
}
