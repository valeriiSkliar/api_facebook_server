import { Test, TestingModule } from '@nestjs/testing';
import { TiktokAccountController } from './tiktok-account.controller';
import { TiktokAccountService } from './tiktok-account.service';

describe('TiktokAccountController', () => {
  let controller: TiktokAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TiktokAccountController],
      providers: [TiktokAccountService],
    }).compile();

    controller = module.get<TiktokAccountController>(TiktokAccountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
