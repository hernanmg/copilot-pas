import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['BROKER_ADMIN', 'PRODUCER'])
  role!: UserRole;

  @IsString()
  displayName!: string;
}

