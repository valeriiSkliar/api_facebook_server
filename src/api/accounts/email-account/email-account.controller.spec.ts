import { Test, TestingModule } from '@nestjs/testing';
import { EmailAccountController } from './email-account.controller';
import { EmailAccountService } from './email-account.service';

describe('EmailAccountController', () => {
  let controller: EmailAccountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailAccountController],
      providers: [EmailAccountService],
    }).compile();

    controller = module.get<EmailAccountController>(EmailAccountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
