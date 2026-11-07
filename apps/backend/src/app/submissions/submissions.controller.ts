import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  CreateKioskSubmissionDto,
  UpdateSubmissionDto,
  VenueSubmission,
} from '@sundayleague/shared-types';
import { AdminApiGuard } from '../scraper/admin-api.guard';
import { SubmissionsService, verifyAdminToken } from './submissions.service';

@Controller(['submissions', 'admin/submissions'])
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  /**
   * Public user submission endpoint for crowd-sourced kiosk & venue information.
   * Rate-limited to max 5 submissions per 10 minutes per IP.
   */
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @Post()
  async createSubmission(
    @Body() dto: CreateKioskSubmissionDto
  ): Promise<VenueSubmission> {
    return this.submissionsService.createSubmission(dto);
  }

  /**
   * Admin endpoint to list all submissions, optionally filtered by status ('pending' | 'approved' | 'rejected' | 'all').
   */
  @Get()
  @UseGuards(AdminApiGuard)
  async getSubmissions(
    @Query('status') status?: string
  ): Promise<VenueSubmission[]> {
    return this.submissionsService.getSubmissions(status);
  }

  /**
   * Admin endpoint to get a single submission by ID with joined match and venue details.
   */
  @Get(':id')
  @UseGuards(AdminApiGuard)
  async getSubmissionById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<VenueSubmission> {
    return this.submissionsService.getSubmissionById(id);
  }

  /**
   * Admin endpoint to approve a submission and cascade changes to match and venue records.
   */
  @Post(':id/approve')
  @UseGuards(AdminApiGuard)
  async approveSubmission(
    @Param('id', ParseIntPipe) id: number
  ): Promise<VenueSubmission> {
    return this.submissionsService.approveSubmission(id);
  }

  /**
   * Telegram One-Click approval link with admin token query parameter or bearer header.
   */
  @Get(':id/approve')
  @UseGuards(AdminApiGuard)
  async approveSubmissionGet(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token?: string,
    @Headers('authorization') authHeader?: string
  ): Promise<VenueSubmission> {
    verifyAdminToken(token, authHeader);

    return this.submissionsService.approveSubmission(id);
  }

  /**
   * Admin endpoint to reject a submission.
   */
  @Post(':id/reject')
  @UseGuards(AdminApiGuard)
  async rejectSubmission(
    @Param('id', ParseIntPipe) id: number
  ): Promise<VenueSubmission> {
    return this.submissionsService.rejectSubmission(id);
  }

  /**
   * Telegram One-Click rejection link with admin token query parameter or bearer header.
   */
  @Get(':id/reject')
  @UseGuards(AdminApiGuard)
  async rejectSubmissionGet(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token?: string,
    @Headers('authorization') authHeader?: string
  ): Promise<VenueSubmission> {
    verifyAdminToken(token, authHeader);

    return this.submissionsService.rejectSubmission(id);
  }

  /**
   * Admin endpoint to update and optionally cascade submission fields.
   */
  @Patch(':id')
  @UseGuards(AdminApiGuard)
  async updateSubmission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubmissionDto
  ): Promise<VenueSubmission> {
    return this.submissionsService.updateSubmission(id, dto);
  }

  /**
   * Admin endpoint to delete a submission.
   */
  @Delete(':id')
  @UseGuards(AdminApiGuard)
  async deleteSubmission(
    @Param('id', ParseIntPipe) id: number
  ): Promise<{ id: number; deleted: boolean }> {
    return this.submissionsService.deleteSubmission(id);
  }
}
