import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { StartClaimIntakeDto, SubmitClaimIntakeStepDto } from './dto/claim-intake.dto';
import { PatchClaimDraftDto } from './dto/patch-claim-draft.dto';
import { PatchClaimDto } from './dto/patch-claim.dto';
import { PutClaimIntakeConfigDto } from './dto/put-claim-intake-config.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  async list(@CurrentTenant() tenantId: string) {
    return this.claimsService.listClaims(tenantId);
  }

  @Get('intake/config')
  async getIntakeConfig(@CurrentTenant() tenantId: string) {
    return this.claimsService.getIntakeConfig(tenantId);
  }

  @Patch('intake/config')
  async putIntakeConfig(
    @Body() dto: PutClaimIntakeConfigDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.putIntakeConfig(tenantId, dto);
  }

  @Post('intake/start')
  async start(@Body() dto: StartClaimIntakeDto, @CurrentTenant() tenantId: string) {
    return this.claimsService.startIntake(tenantId, dto);
  }

  @Get('intake/:sessionId')
  async get(@Param('sessionId') sessionId: string, @CurrentTenant() tenantId: string) {
    return this.claimsService.getIntake(tenantId, sessionId);
  }

  @Post('intake/:sessionId/step')
  async step(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitClaimIntakeStepDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.submitIntakeStep(tenantId, sessionId, dto as any);
  }

  @Post('intake/:sessionId/complete')
  async complete(
    @Param('sessionId') sessionId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.completeIntake(tenantId, sessionId);
  }

  @Post('drafts/from-conversation/:conversationId')
  async createDraftFromConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.createDraftFromConversation(tenantId, conversationId);
  }

  @Get('drafts')
  async listDrafts(@CurrentTenant() tenantId: string) {
    return this.claimsService.listDrafts(tenantId);
  }

  @Get('drafts/by-conversation/:conversationId')
  async getDraftByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.getActiveDraftForConversation(tenantId, conversationId);
  }

  @Get('drafts/:id')
  async getDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.getDraft(tenantId, id);
  }

  @Patch('drafts/:id')
  async patchDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchClaimDraftDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.patchDraft(tenantId, id, dto);
  }

  @Post('drafts/:id/approve')
  async approveDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.approveDraft(tenantId, id);
  }

  @Post('drafts/:id/intake/prompt-next')
  async promptNextDraftQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.promptNextDraftQuestion(tenantId, id);
  }

  @Get(':id/detail')
  async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.getClaimDetail(tenantId, id);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchClaimDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.patchClaim(tenantId, id, dto);
  }

  @Get(':id')
  async getClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.claimsService.getClaim(tenantId, id);
  }
}
