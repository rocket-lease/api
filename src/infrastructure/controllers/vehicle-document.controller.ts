import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from '@/application/auth.service';
import { VehicleDocumentService } from '@/application/vehicle-document.service';
import type { SubmitVehicleDocumentsRequest } from '@rocket-lease/contracts';
import {
  RequiredDocumentsResponseSchema,
  SubmitVehicleDocumentsRequestSchema,
} from '@rocket-lease/contracts';

type UploadedVehicleFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

function fileToDocument(file: UploadedVehicleFile) {
  return {
    filename: file.originalname,
    mimeType: file.mimetype,
    data: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
  };
}

@Controller('vehicle')
export class VehicleDocumentController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(VehicleDocumentService)
    private readonly vehicleDocumentService: VehicleDocumentService,
  ) {}

  private async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }
    try {
      return await this.authService.getUserIdFromToken(authorization);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  @Get(':id/documents/required')
  @HttpCode(HttpStatus.OK)
  public async getRequiredDocuments() {
    return RequiredDocumentsResponseSchema.parse({
      requiredDocuments: ['title', 'greenCard'],
    });
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'title', maxCount: 1 },
        { name: 'greenCard', maxCount: 1 },
      ],
      {
        limits: { fileSize: 50 * 1024 * 1024, files: 2 },
      },
    ),
  )
  public async submitDocuments(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') vehicleId: string,
    @UploadedFiles()
    files: {
      title?: UploadedVehicleFile[];
      greenCard?: UploadedVehicleFile[];
    },
  ) {
    const rentadorId = await this.resolveUserId(authorization);

    const title = files.title?.[0];
    const greenCard = files.greenCard?.[0];

    if (!title || !greenCard) {
      throw new BadRequestException('Missing vehicle document files');
    }

    const dto: SubmitVehicleDocumentsRequest = {
      title: fileToDocument(title),
      greenCard: fileToDocument(greenCard),
    };

    const parsed = SubmitVehicleDocumentsRequestSchema.parse(dto);
    return this.vehicleDocumentService.submitDocuments(
      rentadorId,
      vehicleId,
      parsed,
    );
  }

  @Get(':id/documents/status')
  @HttpCode(HttpStatus.OK)
  public async getDocumentStatus(
    @Param('id') vehicleId: string,
  ) {
    return this.vehicleDocumentService.getDocumentStatus(vehicleId);
  }

  @Post('documents/process')
  @HttpCode(HttpStatus.OK)
  public async processDocuments() {
    return this.vehicleDocumentService.processPendingVerifications();
  }
}
