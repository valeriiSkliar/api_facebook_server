import { Test, TestingModule } from '@nestjs/testing';
import { EmailAccountService } from './email-account.service';

describe('EmailAccountService', () => {
  let service: EmailAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailAccountService],
    }).compile();

    service = module.get<EmailAccountService>(EmailAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
