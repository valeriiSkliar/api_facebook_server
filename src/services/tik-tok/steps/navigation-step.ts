import { AuthStepType, IAuthenticationStep } from '@src/interfaces';
import { AuthenticatorContext } from '@src/models';

export class NavigationStep implements IAuthenticationStep {
  getType(): AuthStepType {
    throw new Error('Method not implemented.');
  }
  getName(): string {
    throw new Error('Method not implemented.');
  }
  async execute(
    context: AuthenticatorContext,
    // credentials?: AuthCredentials,
  ): Promise<boolean> {
    const page = context.state.page;
    if (!page) {
      throw new Error('Page not found');
    }
    await page.goto(
      'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
    );
    return true;
  }
}
