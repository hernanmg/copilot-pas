import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from './infra/redis/redis.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ProducersModule } from './modules/producers/producers.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { InsurersModule } from './modules/insurers/insurers.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { RagModule } from './modules/rag/rag.module';
import { ProducerWorkflowModule } from './modules/producer-workflow/producer-workflow.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    RedisModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5433),
        username: process.env.DB_USER || 'copilot',
        password: process.env.DB_PASSWORD || 'copilot_pass',
        database: process.env.DB_NAME || 'copilot_seguros',
        autoLoadEntities: true,
        synchronize: false
      })
    }),
    TenantsModule,
    UsersModule,
    AuthModule,
    ProducersModule,
    CustomersModule,
    InsurersModule,
    PoliciesModule,
    ClaimsModule,
    ConversationsModule,
    OrchestratorModule,
    RagModule,
    ProducerWorkflowModule
  ]
})
export class AppModule {}

