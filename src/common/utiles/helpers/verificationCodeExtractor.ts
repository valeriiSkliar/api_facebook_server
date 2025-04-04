/**
 * Type definition for a verification code extraction pattern function
 */
type VerificationCodePattern = (body: string) => string | null;

/**
 * Extracts verification code from email body using multiple patterns
 * @param emailBody The full email body content
 * @returns The extracted verification code or null if not found
 */
export function extractVerificationCode(emailBody: string): string | null {
  const patterns: VerificationCodePattern[] = [
    // Pattern 1: Look for code after "Verification Code" text and near "Creative Center login page"
    (body: string) => {
      if (body.includes('Creative Center login page')) {
        const verificationSection = body.substring(
          body.indexOf('Creative Center login page') - 100,
          body.indexOf('Creative Center login page') + 500,
        );
        const match = verificationSection.match(
          /[^a-zA-Z0-9]([A-Z0-9]{6})[^a-zA-Z0-9]/,
        );
        return match?.[1] || null;
      }
      return null;
    },

    // Pattern 2: Look for code in a paragraph with background-color: #fafafa
    (body: string) => {
      const pattern =
        /background-color:\s*#fafafa[^>]*>[\s\n]*([A-Z0-9]{6})[\s\n]*</i;
      const match = body.match(pattern);
      return match?.[1] || null;
    },

    // Pattern 3: Look for code after "text-align: center" and "margin-top: 24px"
    (body: string) => {
      const pattern = /text-align:\s*center[^>]*>\s*([A-Z0-9]{6})\s*</i;
      const match = body.match(pattern);
      return match?.[1] || null;
    },

    // Pattern 4: Look for code in a paragraph with padding
    (body: string) => {
      const pattern = /padding:[^>]*>\s*([A-Z0-9]{6})\s*</i;
      const match = body.match(pattern);
      return match?.[1] || null;
    },

    // Pattern 5: Extract all 6-character alphanumeric codes
    (body: string) => {
      const allCodes: string[] = [];
      const codePattern = /[^a-zA-Z0-9>]([A-Z0-9]{6})[^a-zA-Z0-9<]/g;
      let match: RegExpExecArray | null;

      while ((match = codePattern.exec(body)) !== null) {
        // Skip common false positives
        if (
          match[1].toLowerCase().startsWith('em') ||
          body.includes(`@${match[1].toLowerCase()}.`) ||
          body.includes(`@${match[1].toLowerCase()}@`)
        ) {
          continue;
        }
        allCodes.push(match[1]);
      }

      if (allCodes.length === 1) {
        return allCodes[0];
      }

      // If multiple codes found, prefer ones that appear after "verification code" text
      if (allCodes.length > 1) {
        const verificationCodeIndex = body
          .toLowerCase()
          .indexOf('verification code');
        if (verificationCodeIndex !== -1) {
          const bodyAfterVerificationText = body.substring(
            verificationCodeIndex,
          );
          for (const code of allCodes) {
            if (bodyAfterVerificationText.includes(code)) {
              return code;
            }
          }
        }
        // If still no code found, use the first one
        return allCodes[0];
      }

      return null;
    },
  ];

  // Try each pattern in sequence until we find a code
  for (const pattern of patterns) {
    const code = pattern(emailBody);
    if (code) {
      return code;
    }
  }

  return null;
}
