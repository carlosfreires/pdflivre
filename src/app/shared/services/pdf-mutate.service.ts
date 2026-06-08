import { Injectable, OnDestroy } from '@angular/core';

// ============================================================================
// TIPAGENS DE ANOTAÇÕES (State Model Global)
// ==========================================================================

/** OTIMIZAÇÃO ARCH: Base comum aplicando o princípio DRY (Don't Repeat Yourself) */
export interface PdfAnnotationBase {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface PdfTextAnnotation extends PdfAnnotationBase {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

export interface PdfImageAnnotation extends PdfAnnotationBase {
  type: 'image';
  dataUrl: string; 
}

export interface PdfWhiteoutAnnotation extends PdfAnnotationBase {
  type: 'whiteout';
  backgroundColor?: string;
}

export type PdfAnnotation = PdfTextAnnotation | PdfImageAnnotation | PdfWhiteoutAnnotation;

// ============================================================================
// SERVIÇO PROXY DO WORKER
// ==========================================================================

@Injectable({
  providedIn: 'root'
})
export class PdfMutateService implements OnDestroy {
  private worker: Worker;
  
  /** * Mapa de promessas pendentes fortemente tipado. 
   * O(1) de complexidade para resolução assíncrona concorrente.
   */
  private pendingTasks = new Map<string, { 
    resolve: (value: ArrayBuffer) => void, 
    reject: (reason?: Error) => void 
  }>();

  constructor() {
    // Inicializa o Web Worker nativamente integrado com o Angular CLI (Webpack/Vite)
    this.worker = new Worker(new URL('../workers/pdf-mutate.worker', import.meta.url), { type: 'module' });
    
    // Handler de Sucesso/Erro Lógico vindo do Worker
    this.worker.onmessage = ({ data }) => {
      const { id, success, result, error } = data;
      const task = this.pendingTasks.get(id);
      
      if (task) {
        success ? task.resolve(result) : task.reject(new Error(error));
        this.pendingTasks.delete(id);
      }
    };

    // Handler Crítico: Captura falhas catastróficas na Thread do Worker (ex: Out of Memory)
    this.worker.onerror = (errorEvent) => {
      console.error('[Worker Crash] Falha crítica na thread de mutação:', errorEvent);
      // Rejeita TODAS as tarefas pendentes para não congelar a UI com spinners infinitos
      this.pendingTasks.forEach(task => task.reject(new Error('Falha crítica no processador de PDF.')));
      this.pendingTasks.clear();
    };
  }

  /**
   * Previne memory leaks garantindo que a Thread nativa do SO seja destruída
   * caso o serviço Angular seja descartado.
   */
  ngOnDestroy(): void {
    this.worker.terminate();
    this.pendingTasks.clear();
  }

  /**
   * Core Engine: Delega a tarefa pesada para a Background Thread.
   * Utiliza Transferable Objects (Zero-Copy) para performance extrema na RAM.
   */
  private runWorkerTask(action: string, payload: any, transferables: Transferable[] = []): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingTasks.set(id, { resolve, reject });
      
      // Envia a mensagem transferindo o ownership dos ArrayBuffers
      this.worker.postMessage({ id, action, payload }, transferables);
    });
  }

  // ======================================================================
  // MUTAÇÕES DELEGADAS AO WEB WORKER
  // ======================================================================

  rotatePage(buffer: ArrayBuffer, pageIndex: number, angle: number = 90): Promise<ArrayBuffer> {
    const bufferCopy = buffer.slice(0); 
    return this.runWorkerTask('rotatePage', { buffer: bufferCopy, pageIndex, angle }, [bufferCopy]);
  }

  deletePage(buffer: ArrayBuffer, pageIndex: number): Promise<ArrayBuffer> {
    const bufferCopy = buffer.slice(0);
    return this.runWorkerTask('deletePage', { buffer: bufferCopy, pageIndex }, [bufferCopy]);
  }

  movePage(buffer: ArrayBuffer, fromIndex: number, toIndex: number): Promise<ArrayBuffer> {
    const bufferCopy = buffer.slice(0);
    return this.runWorkerTask('movePage', { buffer: bufferCopy, fromIndex, toIndex }, [bufferCopy]);
  }

  applyAnnotations(buffer: ArrayBuffer, documentAnnotations: Record<number, PdfAnnotation[]>): Promise<ArrayBuffer> {
    const bufferCopy = buffer.slice(0);
    return this.runWorkerTask('applyAnnotations', { buffer: bufferCopy, documentAnnotations }, [bufferCopy]);
  }

  extractPages(buffer: ArrayBuffer, startPage: number, endPage: number): Promise<ArrayBuffer> {
    const bufferCopy = buffer.slice(0);
    return this.runWorkerTask('extractPages', { buffer: bufferCopy, startPage, endPage }, [bufferCopy]);
  }

  mergePdfs(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
    const bufferCopies = buffers.map(b => b.slice(0));
    return this.runWorkerTask('mergePdfs', { buffers: bufferCopies }, bufferCopies);
  }

  // ======================================================================
  // OPERAÇÕES LOCAIS (DOM API)
  // ======================================================================

  /**
   * Força o download do buffer processado diretamente para a máquina do utilizador.
   */
  saveDocumentLocally(buffer: ArrayBuffer, filename: string = 'documento-editado.pdf'): void {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
}