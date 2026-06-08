/// <reference lib="webworker" />
import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';

// ============================================================================
// TIPAGENS DE SUPORTE
// ==========================================================================

interface WorkerMessage {
  id: string;
  action: 'rotatePage' | 'deletePage' | 'movePage' | 'extractPages' | 'mergePdfs' | 'applyAnnotations';
  payload: any;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS DE ALTA PERFORMANCE
// ==========================================================================

/**
 * Converte um DataURL (Base64) para Uint8Array puramente em memória (RAM).
 */
function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * OTIMIZAÇÃO ARCH: Conversor Nativo de Cores CSS Hex para a Matriz RGB do PDF.
 * A pdf-lib exige valores decimais de 0 a 1 em vez de 0 a 255.
 */
function hexToPdfRgb(hex: string | undefined, defaultColor: [number, number, number] = [0, 0, 0]) {
  if (!hex || hex === 'transparent') return undefined;
  
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return rgb(...defaultColor);
  
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  
  return rgb(r, g, b);
}

// ============================================================================
// PROCESSADORES DE MUTAÇÃO (Isolados para otimização JIT do motor V8)
// ==========================================================================

async function processRotatePage(payload: any): Promise<ArrayBuffer> {
  const { buffer, pageIndex, angle } = payload;
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  
  if (pageIndex < 0 || pageIndex >= pages.length) throw new Error('Índice de página inválido.');
  
  const page = pages[pageIndex];
  page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  
  return (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;
}

async function processDeletePage(payload: any): Promise<ArrayBuffer> {
  const { buffer, pageIndex } = payload;
  const pdfDoc = await PDFDocument.load(buffer);
  
  if (pdfDoc.getPageCount() <= 1) throw new Error('Impossível apagar a única página do documento.');
  
  pdfDoc.removePage(pageIndex);
  return (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;
}

async function processMovePage(payload: any): Promise<ArrayBuffer> {
  const { buffer, fromIndex, toIndex } = payload;
  const originalPdf = await PDFDocument.load(buffer);
  const totalPages = originalPdf.getPageCount();

  if (fromIndex < 0 || fromIndex >= totalPages || toIndex < 0 || toIndex >= totalPages) {
    throw new Error('Índices de página inválidos.');
  }

  const newPdf = await PDFDocument.create();
  const indices = Array.from({ length: totalPages }, (_, i) => i);
  
  const [movedIndex] = indices.splice(fromIndex, 1);
  indices.splice(toIndex, 0, movedIndex);

  const copiedPages = await newPdf.copyPages(originalPdf, indices);
  copiedPages.forEach(page => newPdf.addPage(page));

  return (await newPdf.save()).buffer.slice(0) as ArrayBuffer;
}

async function processExtractPages(payload: any): Promise<ArrayBuffer> {
  const { buffer, startPage, endPage } = payload;
  const originalPdf = await PDFDocument.load(buffer);
  const totalPages = originalPdf.getPageCount();

  if (startPage < 1 || endPage > totalPages || startPage > endPage) {
    throw new Error('Intervalo de páginas inválido.');
  }

  const newPdf = await PDFDocument.create();
  const indicesToExtract = Array.from({ length: endPage - startPage + 1 }, (_, i) => (startPage - 1) + i);

  const copiedPages = await newPdf.copyPages(originalPdf, indicesToExtract);
  copiedPages.forEach(page => newPdf.addPage(page));

  return (await newPdf.save()).buffer.slice(0) as ArrayBuffer;
}

async function processMergePdfs(payload: any): Promise<ArrayBuffer> {
  const { buffers } = payload;
  const mergedPdf = await PDFDocument.create();

  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return (await mergedPdf.save()).buffer.slice(0) as ArrayBuffer;
}

async function processApplyAnnotations(payload: any): Promise<ArrayBuffer> {
  const { buffer, documentAnnotations } = payload;
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  
  // OTIMIZAÇÃO ARCH: Injeção proativa de dicionários de Fontes
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  for (const [pageNumberStr, annotations] of Object.entries(documentAnnotations as Record<number, any[]>)) {
    const pageIndex = parseInt(pageNumberStr, 10) - 1; 
    if (pageIndex < 0 || pageIndex >= pages.length || annotations.length === 0) continue;

    const page = pages[pageIndex];
    const { width: pdfWidth, height: pdfHeight } = page.getSize();

    for (const note of annotations) {
      // Eixo X é nativo (Top-Left Web igual ao PDF)
      const elementX = pdfWidth * note.x;

      // ==============================================
      // EXPORTAÇÃO DE TEXTO (Typography & Auto-Sizing)
      // ==============================================
      if (note.type === 'text') {
        const fontSize = note.fontSize || 16;
        const color = hexToPdfRgb(note.color, [0, 0, 0])!;
        const bgColor = hexToPdfRgb(note.backgroundColor);
        
        let selectedFont = fontHelvetica;
        if (note.fontFamily?.includes('Times')) selectedFont = fontTimes;
        if (note.fontFamily?.includes('Courier')) selectedFont = fontCourier;

        // OTIMIZAÇÃO: Cálculo de Bounding Box para Multilinha (Suporte a Enter \n)
        const textLines = note.text.split('\n');
        const lineHeight = fontSize * 1.2;
        const textHeight = textLines.length * lineHeight;

        // Inverte o eixo Y (Web cresce para baixo, PDF cresce para cima)
        // No pdf-lib, o 'y' no drawText refere-se ao Baseline inferior da primeira linha.
        const elementY = pdfHeight - (pdfHeight * note.y) - fontSize; 

        // Se existir cor de Fundo (Whiteout/Color box por trás do texto)
        if (bgColor) {
          const maxLineWidth = Math.max(...textLines.map((line: string) => selectedFont.widthOfTextAtSize(line, fontSize)));
          const padding = 8; // Sincronizado com os 8px de padding da UI (EditorOverlay)
          
          page.drawRectangle({
            x: elementX - padding,
            y: elementY - textHeight + fontSize - padding, 
            width: maxLineWidth + (padding * 2),
            height: textHeight + (padding * 2),
            color: bgColor
          });
        }

        page.drawText(note.text, {
          x: elementX,
          y: elementY,
          size: fontSize,
          font: selectedFont,
          color: color,
          lineHeight: lineHeight
        });
      } 
      // ==============================================
      // EXPORTAÇÃO DE IMAGEM / ASSINATURA
      // ==============================================
      else if (note.type === 'image') {
        const imageBytes = base64ToUint8Array(note.dataUrl);
        const imageEmbed = note.dataUrl.includes('image/jpeg') 
          ? await pdfDoc.embedJpg(imageBytes) 
          : await pdfDoc.embedPng(imageBytes);
        
        // Proteção contra undefined herdando os fallbacks da UI
        const w = (note.width || 0.25) * pdfWidth;
        const h = (note.height || 0.12) * pdfHeight;
        const elementY = pdfHeight - (pdfHeight * note.y) - h;

        page.drawImage(imageEmbed, { x: elementX, y: elementY, width: w, height: h });
      }
      // ==============================================
      // EXPORTAÇÃO DE TARJA (Whiteout/Redact Colorido)
      // ==============================================
      else if (note.type === 'whiteout') {
        const w = (note.width || 0.15) * pdfWidth;
        const h = (note.height || 0.05) * pdfHeight;
        const elementY = pdfHeight - (pdfHeight * note.y) - h;
        
        const bgColor = hexToPdfRgb(note.backgroundColor, [1, 1, 1])!;

        page.drawRectangle({ x: elementX, y: elementY, width: w, height: h, color: bgColor });
      }
    }
  }
  
  return (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;
}

// ============================================================================
// CONTROLADOR PRINCIPAL DO WORKER (Router)
// ==========================================================================

addEventListener('message', async ({ data }: MessageEvent<WorkerMessage>) => {
  const { id, action, payload } = data;

  try {
    let resultBuffer: ArrayBuffer;

    switch (action) {
      case 'rotatePage':
        resultBuffer = await processRotatePage(payload);
        break;
      case 'deletePage':
        resultBuffer = await processDeletePage(payload);
        break;
      case 'movePage':
        resultBuffer = await processMovePage(payload);
        break;
      case 'extractPages':
        resultBuffer = await processExtractPages(payload);
        break;
      case 'mergePdfs':
        resultBuffer = await processMergePdfs(payload);
        break;
      case 'applyAnnotations':
        resultBuffer = await processApplyAnnotations(payload);
        break;
      default:
        throw new Error(`Ação não reconhecida pelo worker: ${action}`);
    }

    // Retorna o ArrayBuffer para a Main Thread informando o transfer pass por referência (Zero-Copy)
    postMessage({ id, success: true, result: resultBuffer }, [resultBuffer]);

  } catch (error: any) {
    console.error(`[Worker Error] Falha na ação '${action}':`, error);
    postMessage({ id, success: false, error: error.message || 'Erro interno no Worker de PDF' });
  }
});