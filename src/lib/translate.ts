import translate from 'translate';

// Configure translate to use Google engine
translate.engine = 'google';

/**
 * Translates English text to Tamil
 * @param text The english text to translate
 * @returns The translated Tamil text, or an empty string if failed
 */
export async function translateToTamil(text: string): Promise<string> {
  if (!text || !text.trim()) return '';
  
  try {
    const result = await translate(text, { from: 'en', to: 'ta' });
    return result;
  } catch (error) {
    console.error('Translation error:', error);
    return ''; // Fails safely
  }
}
