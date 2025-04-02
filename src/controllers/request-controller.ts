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
import {
  RequestManagerService,
  RequestStatus,
} from '../services/request-manager-service';
import { CreateRequestDto } from '@src/dto/create-request.dto';
import { UpdateRequestStatusDto } from '@src/dto/update-request-status.dto';
import { AuthenticatedRequest } from '../interfaces/auth.interface';
import { AdData } from '@src/models/AdData';
import { ScraperResult } from '@src/models/ScraperResult';

// Interface for potential error structures stored in response_data
interface ErrorData {
  error?: string | object; // Can be string or another object
  message?: string;
  // Potentially other fields from Error objects
  [key: string]: any;
}

// Type guard for ScraperResult
function isScraperResult(data: unknown): data is ScraperResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    'ads' in data
  );
}

@Controller('requests')
export class RequestController {
  private readonly logger = new Logger(RequestController.name);

  constructor(private readonly requestManager: RequestManagerService) {}

  @Post()
  async createRequest(
    @Request() req: AuthenticatedRequest,
    @Body() createDto: CreateRequestDto,
  ) {
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
      // Get the full request record from the database
      const dbRequest =
        await this.requestManager.getRequestWithResults(requestId);

      if (!dbRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      // Prepare the base response structure
      const response: {
        success: boolean;
        request: {
          id: string;
          type: string;
          status: string; // Will reflect the actual DB status
          createdAt: Date;
          processedAt: Date | null;
          outputPath?: string | null;
        };
        results?: AdData[] | null;
        error?: string | ErrorData | null; // For storing user-friendly error messages or structured errors
      } = {
        success: true, // Assume success initially
        request: {
          id: dbRequest.external_request_id,
          type: dbRequest.request_type,
          status: dbRequest.status, // Reflect actual DB status
          createdAt: dbRequest.created_at,
          processedAt: dbRequest.processed_at,
          outputPath: null,
        },
        results: null,
        error: null,
      };

      const currentStatus = dbRequest.status as RequestStatus;

      // --- Handle COMPLETED status ---
      if (currentStatus === RequestStatus.COMPLETED) {
        if (dbRequest.response_data) {
          try {
            // Handle both string and object response_data
            const parsedData: unknown =
              typeof dbRequest.response_data === 'string'
                ? JSON.parse(dbRequest.response_data)
                : dbRequest.response_data;

            if (isScraperResult(parsedData)) {
              response.results = parsedData.ads || [];
              response.request.outputPath = parsedData.outputPath;
              response.success = parsedData.success;

              if (!parsedData.success && parsedData.errors?.length > 0) {
                response.error = parsedData.errors.map(
                  // Try to get meaningful message, fallback to string representation
                  (e) =>
                    typeof e === 'object' && e !== null && 'message' in e
                      ? e.message
                      : String(e),
                );
              }
            } else {
              const errorMessage = `Request completed, but stored result data does not match expected ScraperResult format.`;
              this.logger.error(`${errorMessage} RequestID: ${requestId}`);
              // Report the parsing failure, but keep success=true because the request *did* complete.
              // The client needs to know the job finished, but results are unavailable via API.
              response.success = true; // Keep true as the job itself finished
              response.error = errorMessage;
              response.results = null; // Results are unreadable
            }
          } catch (parseError) {
            const errorMessage = `Request completed, but failed to parse stored result data.`;
            this.logger.error(
              `${errorMessage} RequestID: ${requestId}`,
              parseError,
            );
            // Report the parsing failure, but keep success=true because the request *did* complete.
            // The client needs to know the job finished, but results are unavailable via API.
            response.success = true; // Keep true as the job itself finished
            response.error = errorMessage;
            response.results = null; // Results are unreadable
          }
        } else {
          // Completed but no data - could be valid if scraper found nothing, or an issue.
          this.logger.warn(
            `Request ${requestId} is COMPLETED but has no response_data.`,
          );
          // Indicate completion but maybe warn about missing data.
          response.success = true; // Job completed.
          response.error = 'Request completed, but no result data was stored.';
        }
      }
      // --- Handle FAILED status ---
      else if (currentStatus === RequestStatus.FAILED) {
        response.success = false; // Mark response as unsuccessful
        if (dbRequest.response_data) {
          try {
            let parsedError: ErrorData | string;
            // Check if it's already a string, avoid double parsing
            if (typeof dbRequest.response_data === 'string') {
              parsedError = JSON.parse(dbRequest.response_data) as ErrorData;
            } else {
              parsedError = dbRequest.response_data as ErrorData; // Assume it might already be an object
            }

            // Extract a meaningful error message
            if (typeof parsedError === 'object' && parsedError !== null) {
              response.error =
                parsedError.error ||
                parsedError.message ||
                JSON.stringify(parsedError);
            } else {
              // Fallback for non-object errors or simple strings
              response.error = String(parsedError);
            }
          } catch (parseError) {
            this.logger.error(
              `Failed to parse error JSON for failed request ${requestId}. Raw data: ${JSON.stringify(dbRequest.response_data)}`,
              parseError,
            );
            response.error = 'Processing failed with unspecified error.';
          }
        } else {
          response.error =
            dbRequest.error_details ??
            'Processing failed with no specific error details recorded.';
        }
      }
      // --- Handle PENDING or PROCESSING status ---
      // For these statuses, results and error remain null, success remains true (as the request is ongoing or queued)

      return response;
    } catch (error) {
      // Handle general errors like DB connection issues or HttpExceptions
      if (error instanceof HttpException) {
        throw error; // Re-throw known HTTP exceptions
      }
      // Log unexpected errors
      this.logger.error(`Unhandled error getting request ${requestId}`, error);
      throw new HttpException(
        'Failed to retrieve request due to an internal error.',
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
