import { Module } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { LlmService } from './llm.service';

@Module({
  controllers: [OrchestratorController],
  providers: [LlmService, OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
