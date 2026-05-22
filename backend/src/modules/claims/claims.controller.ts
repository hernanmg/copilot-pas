import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { StartClaimIntakeDto, SubmitClaimIntakeStepDto } from './dto/claim-intake.dto';
import { PatchClaimDraftDto } from './dto/patch-claim-draft.dto';
import { PatchClaimDto } from './dto/patch-claim.dto';
import { PutClaimIntakeConfigDto } from './dto/put-claim-intake-config.dto';

const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId?: string) {
    return this.claimsService.listClaims(tenantId || DUMMY_TENANT_ID);
  }

  @Get('intake/config')
  async getIntakeConfig(@Headers('x-tenant-id') tenantId?: string) {
    return this.claimsService.getIntakeConfig(tenantId || DUMMY_TENANT_ID);
  }

  @Patch('intake/config')
  async putIntakeConfig(
    @Body() dto: PutClaimIntakeConfigDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.putIntakeConfig(tenantId || DUMMY_TENANT_ID, dto);
  }

  @Post('intake/start')
  async start(@Body() dto: StartClaimIntakeDto, @Headers('x-tenant-id') tenantId?: string) {
    return this.claimsService.startIntake(tenantId || DUMMY_TENANT_ID, dto);
  }

  @Get('intake/:sessionId')
  async get(@Param('sessionId') sessionId: string, @Headers('x-tenant-id') tenantId?: string) {
    return this.claimsService.getIntake(tenantId || DUMMY_TENANT_ID, sessionId);
  }

  @Post('intake/:sessionId/step')
  async step(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitClaimIntakeStepDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.submitIntakeStep(tenantId || DUMMY_TENANT_ID, sessionId, dto as any);
  }

  @Post('intake/:sessionId/complete')
  async complete(
    @Param('sessionId') sessionId: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.completeIntake(tenantId || DUMMY_TENANT_ID, sessionId);
  }

  @Post('drafts/from-conversation/:conversationId')
  async createDraftFromConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.createDraftFromConversation(tenantId || DUMMY_TENANT_ID, conversationId);
  }

  @Get('drafts')
  async listDrafts(@Headers('x-tenant-id') tenantId?: string) {
    return this.claimsService.listDrafts(tenantId || DUMMY_TENANT_ID);
  }

  @Get('drafts/by-conversation/:conversationId')
  async getDraftByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.getActiveDraftForConversation(
      tenantId || DUMMY_TENANT_ID,
      conversationId,
    );
  }

  @Get('drafts/:id')
  async getDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.getDraft(tenantId || DUMMY_TENANT_ID, id);
  }

  @Patch('drafts/:id')
  async patchDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchClaimDraftDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.patchDraft(tenantId || DUMMY_TENANT_ID, id, dto);
  }

  @Post('drafts/:id/approve')
  async approveDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.approveDraft(tenantId || DUMMY_TENANT_ID, id);
  }

  @Post('drafts/:id/intake/prompt-next')
  async promptNextDraftQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.promptNextDraftQuestion(tenantId || DUMMY_TENANT_ID, id);
  }

  @Get(':id/detail')
  async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.getClaimDetail(tenantId || DUMMY_TENANT_ID, id);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchClaimDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.patchClaim(tenantId || DUMMY_TENANT_ID, id, dto);
  }

  @Get(':id')
  async getClaim(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    return this.claimsService.getClaim(tenantId || DUMMY_TENANT_ID, id);
  }
}

