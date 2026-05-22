import { IsEmail, IsUUID, MinLength } from 'class-validator';

export class LoginDto {
  /** Acepta UUID nil del tenant demo y cualquier UUID estándar (no solo v4). */
  @IsUUID('all')
  tenantId!: string;

  @IsEmail()
  email!: string;

  @MinLength(4)
  password!: string;
}
