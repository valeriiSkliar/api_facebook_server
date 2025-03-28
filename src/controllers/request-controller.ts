import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  Request,
} from '@nestjs/common';
import { RequestManagerService } from '../services/request-manager-service';
import { CreateRequestDto } from '@src/dto/create-request.dto';
import { UpdateRequestStatusDto } from '@src/dto/update-request-status.dto';
import { AuthenticatedRequest } from '../interfaces/auth.interface';

@Controller('requests')
export class RequestController {
  private readonly logger = new Logger(RequestController.name);

  constructor(private readonly requestManager: RequestManagerService) {}

  @Post()
  async createRequest(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateRequestDto,
  ) {
    this.logger.debug('Raw request body:', createDto);
    this.logger.debug('Parameters type:', typeof createDto.parameters);
    this.logger.debug(
      'Parameters content:',
      JSON.stringify(createDto.parameters, null, 2),
    );

    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const request = await this.requestManager.createRequest(
        userId,
        userEmail,
        createDto.requestType,
        createDto.parameters,
        createDto.priority,
        createDto.webhookUrl,
      );

      return {
        success: true,
        requestId: request.id,
        status: request.status,
      };
    } catch (error) {
      this.logger.error('Error creating request', error);
      throw new HttpException(
        'Failed to create request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getRequest(@Param('id') requestId: string) {
    try {
      const request = await this.requestManager.getRequest(requestId);

      if (!request) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        request: {
          id: request.id,
          type: request.requestType,
          status: request.status,
          createdAt: request.createdAt,
          processedAt: request.processedAt,
          lastActivityAt: request.lastActivityAt,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting request ${requestId}`, error);
      throw new HttpException(
        'Failed to retrieve request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/status')
  async updateRequestStatus(
    @Param('id') requestId: string,
    @Body() updateDto: UpdateRequestStatusDto,
  ) {
    try {
      const updatedRequest = await this.requestManager.updateRequestStatus(
        requestId,
        updateDto.status,
        updateDto.result,
      );

      if (!updatedRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        requestId: updatedRequest.id,
        status: updatedRequest.status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error updating request status ${requestId}`, error);
      throw new HttpException(
        'Failed to update request status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/activity')
  async recordActivity(@Param('id') requestId: string) {
    try {
      const success = await this.requestManager.recordActivity(requestId);

      if (!success) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Activity recorded successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error recording activity for request ${requestId}`,
        error,
      );
      throw new HttpException(
        'Failed to record activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async cancelRequest(@Param('id') requestId: string) {
    try {
      const success = await this.requestManager.cancelRequest(requestId);

      if (!success) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Request cancelled successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error cancelling request ${requestId}`, error);
      throw new HttpException(
        'Failed to cancel request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async listRequests(@Query('status') status?: string) {
    try {
      // In a real scenario, get user ID from authenticated request
      const userId = 'user@example.com';

      const requests = await this.requestManager.listUserRequests(userId);

      // Filter by status if provided
      const filteredRequests = status
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
          requests.filter((r) => r.status === status)
        : requests;

      return {
        success: true,
        requests: filteredRequests.map((r) => ({
          id: r.id,
          type: r.requestType,
          status: r.status,
          createdAt: r.createdAt,
          processedAt: r.processedAt,
        })),
      };
    } catch (error) {
      this.logger.error('Error listing requests', error);
      throw new HttpException(
        'Failed to list requests',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
