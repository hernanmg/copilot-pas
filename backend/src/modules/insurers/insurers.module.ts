import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insurer } from './insurer.entity';
import { InsurersController } from './insurers.controller';
import { InsurersService } from './insurers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Insurer])],
  controllers: [InsurersController],
  providers: [InsurersService],
  exports: [InsurersService],
})
export class InsurersModule {}

