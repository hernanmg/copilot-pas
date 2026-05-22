import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInsurerDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  apiKey?: string;
}

