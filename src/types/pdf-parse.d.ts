declare module 'pdf-parse' {
  type PdfParseResult = {
    numpages: number
    numrender: number
    info: any
    metadata: any
    text: string
    version: string
  }

  const pdfParse: (buffer: Buffer, options?: any) => Promise<PdfParseResult>
  export default pdfParse
}


declare module 'pdf-parse/lib/pdf-parse.js' {
  type PdfParseResult = {
    numpages: number
    numrender: number
    info: any
    metadata: any
    text: string
    version: string
  }

  const pdfParse: (buffer: Buffer, options?: any) => Promise<PdfParseResult>
  export default pdfParse
}
