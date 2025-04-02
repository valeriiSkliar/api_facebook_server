import { Test, TestingModule } from '@nestjs/testing';
import { TiktokAccountService } from './tiktok-account.service';

describe('TiktokAccountService', () => {
  let service: TiktokAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TiktokAccountService],
    }).compile();

    service = module.get<TiktokAccountService>(TiktokAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
