import pdf from 'pdf-parse';

export async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
