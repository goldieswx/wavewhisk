import { randomBytes } from 'crypto';

class TokenGenerator {
    private static readonly TOKEN_LENGTH = 8; // 64 bits / 8 = 8 bytes

    public generateToken(): string {
        return randomBytes(TokenGenerator.TOKEN_LENGTH).toString('hex');
    }
}

export const tokenGenerator = new TokenGenerator();

/*
    // Usage example:
    const tokenGen = new TokenGenerator();
    const token = tokenGen.generateToken();
    console.log('Generated Token:', token.toString('hex')); // Convert buffer to hex string for display
*/
