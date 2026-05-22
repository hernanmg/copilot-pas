import { Global, Module } from '@nestjs/common';
import { RAG_SERVICE } from './contracts/rag.contracts';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Global()
@Module({
  controllers: [RagController],
  providers: [
    RagService,
    {
      provide: RAG_SERVICE,
      useExisting: RagService,
    },
  ],
  exports: [RagService, RAG_SERVICE],
})
export class RagModule {}
